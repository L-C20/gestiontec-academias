/**
 * Pedagogía musical: evaluaciones por grupo, habilitación a examen y cierres.
 *
 * Por qué se rehace `evaluaciones`:
 *
 * Hasta acá una evaluación era una fila por alumno (inscripcion_id + nota).
 * Con ese modelo no se puede saber si a un alumno le falta rendir algo: si
 * no hay fila, no hay evaluación, y "no la rindió" es indistinguible de
 * "no existe". La habilitación a examen depende justamente de esa
 * diferencia, así que la evaluación pasa a definirse una sola vez para todo
 * el grupo (`evaluaciones`) y el resultado de cada alumno va aparte
 * (`evaluacion_resultados`). Una obligatoria sin resultado = adeuda.
 *
 * La tabla vieja se borra en lugar de migrarse porque todavía no tiene
 * datos (0 filas, ningún tenant registrado). El `down` la reconstruye.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

const TABLAS_TENANT = [
  'evaluaciones',
  'evaluacion_resultados',
  'cierres',
  'excepciones_examen',
];

function activarRls(pgm, tablas) {
  for (const tabla of tablas) {
    pgm.sql(`ALTER TABLE ${tabla} ENABLE ROW LEVEL SECURITY;`);
    pgm.sql(`ALTER TABLE ${tabla} FORCE ROW LEVEL SECURITY;`);
    pgm.sql(`
      CREATE POLICY tenant_isolation_${tabla} ON ${tabla}
      USING (tenant_id = current_setting('app.current_tenant', true)::integer);
    `);
  }
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.dropTable('evaluaciones');

  // --- evaluaciones (la consigna, definida una vez para todo el grupo) ---
  pgm.createTable('evaluaciones', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    grupo_id: { type: 'integer', notNull: true, references: 'grupos', onDelete: 'CASCADE' },
    tipo_evaluacion_id: {
      type: 'integer',
      notNull: true,
      references: 'tipos_evaluacion',
      onDelete: 'RESTRICT',
    },
    periodo_academico_id: {
      type: 'integer',
      notNull: true,
      references: 'periodos_academicos',
      onDelete: 'RESTRICT',
    },
    nombre: { type: 'varchar(150)', notNull: true }, // "Lección 1", "TP de intervalos"
    consigna: { type: 'text' },
    fecha: { type: 'date' },
    // Una obligatoria sin resultado frena la habilitación al examen.
    obligatoria: { type: 'boolean', notNull: true, default: true },
    // Hay evaluaciones que se toman pero no promedian (diagnósticos, ensayos).
    computa_promedio: { type: 'boolean', notNull: true, default: true },
    // El examen es aquello para lo que el alumno se habilita, así que no
    // puede contarse entre los requisitos que lo habilitan.
    es_examen: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('evaluaciones', 'tenant_id');
  pgm.createIndex('evaluaciones', 'grupo_id');
  pgm.createIndex('evaluaciones', 'periodo_academico_id');

  // --- evaluacion_resultados (cómo le fue a cada alumno) ---
  pgm.createTable('evaluacion_resultados', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    evaluacion_id: {
      type: 'integer',
      notNull: true,
      references: 'evaluaciones',
      onDelete: 'CASCADE',
    },
    inscripcion_id: {
      type: 'integer',
      notNull: true,
      references: 'inscripciones',
      onDelete: 'CASCADE',
    },
    // Cuál de los dos se usa lo define tipos_evaluacion.escala: una academia
    // pone 8.50 y otra "Aprobado" sin que cambie el modelo.
    resultado_numerico: { type: 'numeric(6,2)' },
    resultado_texto: { type: 'varchar(50)' },
    // Ausente no es lo mismo que sin corregir: deja constancia de que se tomó
    // y el alumno no estaba. Sigue adeudando la obligatoria.
    ausente: { type: 'boolean', notNull: true, default: false },
    observaciones: { type: 'text' },
    cargado_por: { type: 'integer', references: 'usuarios', onDelete: 'RESTRICT' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    'evaluacion_resultados',
    'evaluacion_resultados_unico',
    'UNIQUE(evaluacion_id, inscripcion_id)'
  );
  pgm.createIndex('evaluacion_resultados', 'tenant_id');
  pgm.createIndex('evaluacion_resultados', 'inscripcion_id');

  // --- excepciones_examen (habilita a quien no cumple los requisitos) ---
  pgm.createTable('excepciones_examen', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    inscripcion_id: {
      type: 'integer',
      notNull: true,
      references: 'inscripciones',
      onDelete: 'CASCADE',
    },
    periodo_academico_id: {
      type: 'integer',
      notNull: true,
      references: 'periodos_academicos',
      onDelete: 'RESTRICT',
    },
    // Obligatorio a propósito: una excepción sin motivo escrito no sirve
    // para rendir cuentas después.
    motivo: { type: 'text', notNull: true },
    autorizado_por: {
      type: 'integer',
      notNull: true,
      references: 'usuarios',
      onDelete: 'RESTRICT',
    },
    fecha: { type: 'date', notNull: true, default: pgm.func('current_date') },
  });
  pgm.addConstraint(
    'excepciones_examen',
    'excepciones_examen_unica',
    'UNIQUE(inscripcion_id, periodo_academico_id)'
  );
  pgm.createIndex('excepciones_examen', 'tenant_id');

  // --- cierres (cierre de período: lo firma una persona) ---
  pgm.createTable('cierres', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    inscripcion_id: {
      type: 'integer',
      notNull: true,
      references: 'inscripciones',
      onDelete: 'CASCADE',
    },
    // Puede ser el cuatrimestre del grupo o el ciclo anual: alcanza con que
    // exista el período. Así el cierre de ciclo no necesita tabla aparte.
    periodo_academico_id: {
      type: 'integer',
      notNull: true,
      references: 'periodos_academicos',
      onDelete: 'RESTRICT',
    },
    nota_final: { type: 'numeric(6,2)' },
    // La condición la decide una persona; el sistema solo sugiere el promedio.
    condicion: { type: 'varchar(30)' },
    observaciones: { type: 'text' },
    cerrado_por: {
      type: 'integer',
      notNull: true,
      references: 'usuarios',
      onDelete: 'RESTRICT',
    },
    fecha: { type: 'date', notNull: true, default: pgm.func('current_date') },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('cierres', 'cierres_unico', 'UNIQUE(inscripcion_id, periodo_academico_id)');
  pgm.createIndex('cierres', 'tenant_id');

  // --- ¿este resultado está aprobado? ---
  //
  // Vive en la base, y no repartido por las consultas, porque lo preguntan
  // el promedio, la habilitación al examen, el cierre y el reporte. Si cada
  // uno lo resolviera por su cuenta, dos pantallas podrían discrepar sobre
  // si un alumno aprobó, y ese es el tipo de diferencia que nadie encuentra
  // hasta que alguien reclama una nota.
  //
  // El umbral sale de tipos_evaluacion.configuracion, así cada academia
  // pone el suyo:
  //   numerica_10   {"nota_aprobacion": 7}       (7 si no se define)
  //   numerica_100  {"nota_aprobacion": 60}      (60 si no se define)
  //   letras / aprobado_no_aprobado
  //                 {"valores_aprobados": ["Aprobado", "B"]}
  //
  // Ausente nunca está aprobado, incluso si quedó una nota cargada.
  pgm.sql(`
    CREATE FUNCTION evaluacion_aprobada(
      p_escala  text,
      p_config  jsonb,
      p_numero  numeric,
      p_texto   text,
      p_ausente boolean
    ) RETURNS boolean AS $$
      SELECT CASE
        WHEN p_ausente THEN false
        WHEN p_escala IN ('numerica_10', 'numerica_100', 'personalizada') THEN
          p_numero IS NOT NULL
          AND p_numero >= COALESCE(
            (p_config ->> 'nota_aprobacion')::numeric,
            CASE p_escala WHEN 'numerica_100' THEN 60 ELSE 7 END
          )
        ELSE
          p_texto IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(
              COALESCE(p_config -> 'valores_aprobados', '["Aprobado"]'::jsonb)
            ) AS valor
            WHERE lower(btrim(valor)) = lower(btrim(p_texto))
          )
      END
    $$ LANGUAGE sql IMMUTABLE;
  `);

  activarRls(pgm, TABLAS_TENANT);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql('DROP FUNCTION IF EXISTS evaluacion_aprobada(text, jsonb, numeric, text, boolean);');

  pgm.dropTable('cierres');
  pgm.dropTable('excepciones_examen');
  pgm.dropTable('evaluacion_resultados');
  pgm.dropTable('evaluaciones');

  // Reconstruye la evaluación por alumno que había antes.
  pgm.createTable('evaluaciones', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    inscripcion_id: {
      type: 'integer',
      notNull: true,
      references: 'inscripciones',
      onDelete: 'CASCADE',
    },
    tipo_evaluacion_id: {
      type: 'integer',
      notNull: true,
      references: 'tipos_evaluacion',
      onDelete: 'RESTRICT',
    },
    periodo_academico_id: {
      type: 'integer',
      notNull: true,
      references: 'periodos_academicos',
      onDelete: 'RESTRICT',
    },
    fecha: { type: 'date', notNull: true, default: pgm.func('current_date') },
    resultado_numerico: { type: 'numeric(6,2)' },
    resultado_texto: { type: 'varchar(50)' },
    observaciones: { type: 'text' },
  });
  pgm.createIndex('evaluaciones', 'tenant_id');
  pgm.createIndex('evaluaciones', 'inscripcion_id');

  activarRls(pgm, ['evaluaciones']);
};

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

const TABLAS_TENANT = ['asistencias', 'tipos_evaluacion', 'evaluaciones', 'seguimiento', 'documentos'];

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  // --- asistencias ---
  pgm.createTable('asistencias', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    inscripcion_id: { type: 'integer', notNull: true, references: 'inscripciones', onDelete: 'CASCADE' },
    fecha: { type: 'date', notNull: true },
    estado: { type: 'varchar(20)', notNull: true }, // presente/ausente/justificado
    observaciones: { type: 'text' },
  });
  pgm.addConstraint(
    'asistencias',
    'asistencias_inscripcion_fecha_unique',
    'UNIQUE(inscripcion_id, fecha)'
  );
  pgm.createIndex('asistencias', 'tenant_id');

  // --- tipos_evaluacion ---
  // "escala" define cómo interpretar evaluaciones.resultado_numerico / resultado_texto,
  // así una academia puede usar 10/10 y otra Aprobado/No aprobado sin cambiar el modelo.
  pgm.createTable('tipos_evaluacion', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    nombre: { type: 'varchar(100)', notNull: true },
    escala: { type: 'varchar(30)', notNull: true }, // numerica_10/numerica_100/letras/aprobado_no_aprobado/personalizada
    configuracion: { type: 'jsonb' },
  });
  pgm.createIndex('tipos_evaluacion', 'tenant_id');

  // --- evaluaciones ---
  pgm.createTable('evaluaciones', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    inscripcion_id: { type: 'integer', notNull: true, references: 'inscripciones', onDelete: 'CASCADE' },
    tipo_evaluacion_id: { type: 'integer', notNull: true, references: 'tipos_evaluacion', onDelete: 'RESTRICT' },
    periodo_academico_id: { type: 'integer', notNull: true, references: 'periodos_academicos', onDelete: 'RESTRICT' },
    fecha: { type: 'date', notNull: true, default: pgm.func('current_date') },
    resultado_numerico: { type: 'numeric(6,2)' },
    resultado_texto: { type: 'varchar(50)' },
    observaciones: { type: 'text' },
  });
  pgm.createIndex('evaluaciones', 'tenant_id');
  pgm.createIndex('evaluaciones', 'inscripcion_id');

  // --- seguimiento ---
  pgm.createTable('seguimiento', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    alumno_id: { type: 'integer', notNull: true, references: 'alumnos', onDelete: 'CASCADE' },
    inscripcion_id: { type: 'integer', references: 'inscripciones', onDelete: 'SET NULL' },
    autor_usuario_id: { type: 'integer', notNull: true, references: 'usuarios', onDelete: 'RESTRICT' },
    fecha: { type: 'date', notNull: true, default: pgm.func('current_date') },
    tipo: { type: 'varchar(30)', notNull: true }, // evolucion/fortaleza/mejora/cambio_nivel/recomendacion/otro
    descripcion: { type: 'text', notNull: true },
  });
  pgm.createIndex('seguimiento', 'tenant_id');
  pgm.createIndex('seguimiento', 'alumno_id');

  // --- documentos ---
  pgm.createTable('documentos', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    alumno_id: { type: 'integer', notNull: true, references: 'alumnos', onDelete: 'CASCADE' },
    tipo: { type: 'varchar(30)', notNull: true }, // autorizacion/certificado/administrativo/otro
    nombre: { type: 'varchar(150)', notNull: true },
    url: { type: 'text' },
    observaciones: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('documentos', 'tenant_id');
  pgm.createIndex('documentos', 'alumno_id');

  for (const tabla of TABLAS_TENANT) {
    pgm.sql(`ALTER TABLE ${tabla} ENABLE ROW LEVEL SECURITY;`);
    pgm.sql(`ALTER TABLE ${tabla} FORCE ROW LEVEL SECURITY;`);
    pgm.sql(`
      CREATE POLICY tenant_isolation_${tabla} ON ${tabla}
      USING (tenant_id = current_setting('app.current_tenant', true)::integer);
    `);
  }
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.dropTable('documentos');
  pgm.dropTable('seguimiento');
  pgm.dropTable('evaluaciones');
  pgm.dropTable('tipos_evaluacion');
  pgm.dropTable('asistencias');
};

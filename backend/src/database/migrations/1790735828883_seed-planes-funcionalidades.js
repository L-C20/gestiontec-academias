/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

// Funcionalidades "extra" (más allá del núcleo CRUD que tienen todos los planes)
const FUNCIONALIDADES = [
  ['evaluaciones', 'Evaluaciones y notas'],
  ['seguimiento', 'Seguimiento académico'],
  ['pagos', 'Registro y control de pagos'],
  ['reportes_basicos', 'Reportes básicos'],
  ['reportes_avanzados', 'Reportes y estadísticas avanzadas'],
  ['personalizacion_basica', 'Personalización básica de la academia'],
  ['personalizacion_avanzada', 'Personalización avanzada de identidad visual'],
  ['pagina_web', 'Página web promocional'],
];

const FUNCIONALIDADES_POR_PLAN = {
  basico: [],
  profesional: [
    'evaluaciones',
    'seguimiento',
    'pagos',
    'reportes_basicos',
    'personalizacion_basica',
  ],
  premium: [
    'evaluaciones',
    'seguimiento',
    'pagos',
    'reportes_basicos',
    'reportes_avanzados',
    'personalizacion_basica',
    'personalizacion_avanzada',
    'pagina_web',
  ],
};

// null = sin límite práctico
const LIMITES_POR_PLAN = {
  basico: { max_alumnos: 50, max_profesores: 5, max_grupos: 10 },
  profesional: { max_alumnos: 200, max_profesores: 20, max_grupos: 50 },
  premium: { max_alumnos: null, max_profesores: null, max_grupos: null },
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  for (const [clave, nombre] of FUNCIONALIDADES) {
    pgm.sql(
      `INSERT INTO funcionalidades (clave, nombre) VALUES ('${clave}', '${nombre}');`
    );
  }

  for (const [planNombre, claves] of Object.entries(FUNCIONALIDADES_POR_PLAN)) {
    for (const clave of claves) {
      pgm.sql(`
        INSERT INTO plan_funcionalidades (plan_id, funcionalidad_id)
        SELECT p.id, f.id FROM planes p, funcionalidades f
        WHERE p.nombre = '${planNombre}' AND f.clave = '${clave}';
      `);
    }
  }

  for (const [planNombre, limites] of Object.entries(LIMITES_POR_PLAN)) {
    for (const [clave, valor] of Object.entries(limites)) {
      const valorSql = valor === null ? 'NULL' : valor;
      pgm.sql(`
        INSERT INTO plan_limites (plan_id, clave, valor)
        SELECT id, '${clave}', ${valorSql} FROM planes WHERE nombre = '${planNombre}';
      `);
    }
  }
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql('DELETE FROM plan_limites;');
  pgm.sql('DELETE FROM plan_funcionalidades;');
  pgm.sql('DELETE FROM funcionalidades;');
};

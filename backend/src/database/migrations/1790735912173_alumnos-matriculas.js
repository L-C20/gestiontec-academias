/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

const TABLAS_TENANT = ['alumnos', 'matriculas', 'inscripciones'];

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  // --- alumnos ---
  pgm.createTable('alumnos', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    nombre: { type: 'varchar(100)', notNull: true },
    apellido: { type: 'varchar(100)', notNull: true },
    documento: { type: 'varchar(30)' },
    fecha_nacimiento: { type: 'date' },
    telefono: { type: 'varchar(30)' },
    email: { type: 'varchar(150)' },
    direccion: { type: 'text' },
    contacto_emergencia_nombre: { type: 'varchar(150)' },
    contacto_emergencia_telefono: { type: 'varchar(30)' },
    observaciones: { type: 'text' },
    estado: { type: 'varchar(20)', notNull: true, default: 'activo' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('alumnos', 'tenant_id');

  // --- matriculas ---
  pgm.createTable('matriculas', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    alumno_id: { type: 'integer', notNull: true, references: 'alumnos', onDelete: 'CASCADE' },
    periodo_academico_id: { type: 'integer', notNull: true, references: 'periodos_academicos', onDelete: 'RESTRICT' },
    numero_matricula: { type: 'varchar(50)', notNull: true },
    fecha_alta: { type: 'date', notNull: true, default: pgm.func('current_date') },
    fecha_baja: { type: 'date' },
    estado: { type: 'varchar(20)', notNull: true, default: 'activa' },
    observaciones: { type: 'text' },
  });
  pgm.addConstraint(
    'matriculas',
    'matriculas_tenant_numero_unique',
    'UNIQUE(tenant_id, numero_matricula)'
  );
  pgm.createIndex('matriculas', 'tenant_id');
  pgm.createIndex('matriculas', 'alumno_id');

  // --- inscripciones ---
  pgm.createTable('inscripciones', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    alumno_id: { type: 'integer', notNull: true, references: 'alumnos', onDelete: 'CASCADE' },
    grupo_id: { type: 'integer', notNull: true, references: 'grupos', onDelete: 'RESTRICT' },
    fecha_inscripcion: { type: 'date', notNull: true, default: pgm.func('current_date') },
    estado: { type: 'varchar(20)', notNull: true, default: 'activa' }, // activa/finalizada/cancelada
  });
  pgm.createIndex('inscripciones', 'tenant_id');
  pgm.createIndex('inscripciones', 'alumno_id');
  pgm.createIndex('inscripciones', 'grupo_id');

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
  pgm.dropTable('inscripciones');
  pgm.dropTable('matriculas');
  pgm.dropTable('alumnos');
};

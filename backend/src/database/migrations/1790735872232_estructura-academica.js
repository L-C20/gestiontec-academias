/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

const TABLAS_TENANT = [
  'periodos_academicos',
  'disciplinas',
  'cursos',
  'niveles',
  'profesores',
  'grupos',
  'horarios',
];

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  // --- periodos_academicos ---
  pgm.createTable('periodos_academicos', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    nombre: { type: 'varchar(100)', notNull: true },
    fecha_inicio: { type: 'date', notNull: true },
    fecha_fin: { type: 'date', notNull: true },
    activo: { type: 'boolean', notNull: true, default: true },
  });
  pgm.createIndex('periodos_academicos', 'tenant_id');

  // --- disciplinas ---
  pgm.createTable('disciplinas', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    nombre: { type: 'varchar(100)', notNull: true },
    descripcion: { type: 'text' },
    estado: { type: 'varchar(20)', notNull: true, default: 'activo' },
  });
  pgm.createIndex('disciplinas', 'tenant_id');

  // --- cursos ---
  pgm.createTable('cursos', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    disciplina_id: { type: 'integer', notNull: true, references: 'disciplinas', onDelete: 'CASCADE' },
    nombre: { type: 'varchar(100)', notNull: true },
    descripcion: { type: 'text' },
    estado: { type: 'varchar(20)', notNull: true, default: 'activo' },
  });
  pgm.createIndex('cursos', 'tenant_id');
  pgm.createIndex('cursos', 'disciplina_id');

  // --- niveles ---
  pgm.createTable('niveles', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    nombre: { type: 'varchar(100)', notNull: true },
    orden: { type: 'integer', notNull: true, default: 0 },
    estado: { type: 'varchar(20)', notNull: true, default: 'activo' },
  });
  pgm.createIndex('niveles', 'tenant_id');

  // --- profesores ---
  pgm.createTable('profesores', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    usuario_id: { type: 'integer', references: 'usuarios', onDelete: 'SET NULL' },
    nombre: { type: 'varchar(100)', notNull: true },
    apellido: { type: 'varchar(100)', notNull: true },
    documento: { type: 'varchar(30)' },
    telefono: { type: 'varchar(30)' },
    email: { type: 'varchar(150)' },
    especialidad: { type: 'varchar(150)' },
    observaciones: { type: 'text' },
    estado: { type: 'varchar(20)', notNull: true, default: 'activo' },
  });
  pgm.createIndex('profesores', 'tenant_id');

  // --- grupos ---
  pgm.createTable('grupos', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    nombre: { type: 'varchar(100)', notNull: true },
    disciplina_id: { type: 'integer', notNull: true, references: 'disciplinas', onDelete: 'RESTRICT' },
    curso_id: { type: 'integer', notNull: true, references: 'cursos', onDelete: 'RESTRICT' },
    nivel_id: { type: 'integer', references: 'niveles', onDelete: 'RESTRICT' },
    profesor_id: { type: 'integer', references: 'profesores', onDelete: 'SET NULL' },
    periodo_academico_id: { type: 'integer', notNull: true, references: 'periodos_academicos', onDelete: 'RESTRICT' },
    capacidad: { type: 'integer' },
    estado: { type: 'varchar(20)', notNull: true, default: 'activo' },
  });
  pgm.createIndex('grupos', 'tenant_id');
  pgm.createIndex('grupos', 'profesor_id');
  pgm.createIndex('grupos', 'periodo_academico_id');

  // --- horarios ---
  pgm.createTable('horarios', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    grupo_id: { type: 'integer', notNull: true, references: 'grupos', onDelete: 'CASCADE' },
    dia_semana: { type: 'smallint', notNull: true }, // 0=domingo ... 6=sábado
    hora_inicio: { type: 'time', notNull: true },
    hora_fin: { type: 'time', notNull: true },
    aula: { type: 'varchar(50)' },
  });
  pgm.createIndex('horarios', 'tenant_id');
  pgm.createIndex('horarios', 'grupo_id');

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
  pgm.dropTable('horarios');
  pgm.dropTable('grupos');
  pgm.dropTable('profesores');
  pgm.dropTable('niveles');
  pgm.dropTable('cursos');
  pgm.dropTable('disciplinas');
  pgm.dropTable('periodos_academicos');
};

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  // --- tenants ---
  pgm.createTable('tenants', {
    id: 'id',
    nombre: { type: 'varchar(150)', notNull: true },
    slug: { type: 'varchar(80)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('tenants', 'tenants_slug_unique', 'UNIQUE(slug)');

  // --- roles (catálogo global, no pertenece a un tenant) ---
  pgm.createTable('roles', {
    id: 'id',
    nombre: { type: 'varchar(50)', notNull: true },
    descripcion: { type: 'text' },
  });
  pgm.addConstraint('roles', 'roles_nombre_unique', 'UNIQUE(nombre)');
  pgm.sql(`
    INSERT INTO roles (nombre, descripcion) VALUES
      ('admin', 'Administrador de la academia'),
      ('profesor', 'Profesor / instructor');
  `);

  // --- planes ---
  pgm.createTable('planes', {
    id: 'id',
    nombre: { type: 'varchar(50)', notNull: true },
    descripcion: { type: 'text' },
    activo: { type: 'boolean', notNull: true, default: true },
  });
  pgm.addConstraint('planes', 'planes_nombre_unique', 'UNIQUE(nombre)');
  pgm.sql(`
    INSERT INTO planes (nombre, descripcion) VALUES
      ('basico', 'Plan Básico'),
      ('profesional', 'Plan Profesional'),
      ('premium', 'Plan Premium');
  `);

  // --- funcionalidades ---
  pgm.createTable('funcionalidades', {
    id: 'id',
    clave: { type: 'varchar(80)', notNull: true },
    nombre: { type: 'varchar(150)', notNull: true },
    descripcion: { type: 'text' },
  });
  pgm.addConstraint('funcionalidades', 'funcionalidades_clave_unique', 'UNIQUE(clave)');

  // --- plan_funcionalidades ---
  pgm.createTable('plan_funcionalidades', {
    id: 'id',
    plan_id: {
      type: 'integer',
      notNull: true,
      references: 'planes',
      onDelete: 'CASCADE',
    },
    funcionalidad_id: {
      type: 'integer',
      notNull: true,
      references: 'funcionalidades',
      onDelete: 'CASCADE',
    },
  });
  pgm.addConstraint(
    'plan_funcionalidades',
    'plan_funcionalidades_unique',
    'UNIQUE(plan_id, funcionalidad_id)'
  );

  // --- plan_limites ---
  pgm.createTable('plan_limites', {
    id: 'id',
    plan_id: {
      type: 'integer',
      notNull: true,
      references: 'planes',
      onDelete: 'CASCADE',
    },
    clave: { type: 'varchar(80)', notNull: true },
    valor: { type: 'integer' }, // NULL = sin límite práctico
  });
  pgm.addConstraint('plan_limites', 'plan_limites_unique', 'UNIQUE(plan_id, clave)');

  // --- usuarios ---
  pgm.createTable('usuarios', {
    id: 'id',
    tenant_id: {
      type: 'integer',
      notNull: true,
      references: 'tenants',
      onDelete: 'CASCADE',
    },
    rol_id: {
      type: 'integer',
      notNull: true,
      references: 'roles',
      onDelete: 'RESTRICT',
    },
    email: { type: 'varchar(150)', notNull: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    estado: { type: 'varchar(20)', notNull: true, default: 'activo' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('usuarios', 'usuarios_tenant_email_unique', 'UNIQUE(tenant_id, email)');
  pgm.createIndex('usuarios', 'tenant_id');

  // --- suscripciones ---
  pgm.createTable('suscripciones', {
    id: 'id',
    tenant_id: {
      type: 'integer',
      notNull: true,
      references: 'tenants',
      onDelete: 'CASCADE',
    },
    plan_id: {
      type: 'integer',
      notNull: true,
      references: 'planes',
      onDelete: 'RESTRICT',
    },
    estado: { type: 'varchar(20)', notNull: true, default: 'prueba' }, // prueba/activo/suspendido/cancelado
    fecha_inicio: { type: 'date', notNull: true, default: pgm.func('current_date') },
    fecha_vencimiento: { type: 'date' },
    periodo_facturacion: { type: 'varchar(20)' }, // mensual/anual
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('suscripciones', 'tenant_id');

  // --- Row-Level Security (segunda capa de aislamiento multitenant) ---
  // planes/funcionalidades/plan_funcionalidades/plan_limites/roles son catálogos
  // globales (sin tenant_id), no llevan RLS. tenants tampoco (es la tabla raíz).
  // FORCE es necesario porque nuestra app se conecta con el mismo rol que es
  // owner de las tablas (gestiontec_app); sin FORCE, Postgres ignora RLS para
  // el owner y la política quedaría sin efecto real.
  for (const tabla of ['usuarios', 'suscripciones']) {
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
  pgm.dropTable('suscripciones');
  pgm.dropTable('usuarios');
  pgm.dropTable('plan_limites');
  pgm.dropTable('plan_funcionalidades');
  pgm.dropTable('funcionalidades');
  pgm.dropTable('planes');
  pgm.dropTable('roles');
  pgm.dropTable('tenants');
};

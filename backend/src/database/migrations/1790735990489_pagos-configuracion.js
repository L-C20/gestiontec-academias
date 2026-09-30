/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

const TABLAS_TENANT = ['pagos', 'configuracion_tenant', 'configuracion_web_publica'];

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  // --- pagos ---
  pgm.createTable('pagos', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    alumno_id: { type: 'integer', notNull: true, references: 'alumnos', onDelete: 'CASCADE' },
    concepto: { type: 'varchar(150)', notNull: true },
    monto: { type: 'numeric(12,2)', notNull: true },
    metodo: { type: 'varchar(30)', notNull: true }, // efectivo/transferencia/mercadopago/tarjeta/otro
    fecha: { type: 'date', notNull: true, default: pgm.func('current_date') },
    estado: { type: 'varchar(20)', notNull: true, default: 'pagado' }, // pagado/pendiente/anulado
    observaciones: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('pagos', 'tenant_id');
  pgm.createIndex('pagos', 'alumno_id');

  // --- configuracion_tenant (1-1 con tenants) ---
  pgm.createTable('configuracion_tenant', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    nombre_comercial: { type: 'varchar(150)' },
    logo_url: { type: 'text' },
    descripcion: { type: 'text' },
    email_contacto: { type: 'varchar(150)' },
    telefono_contacto: { type: 'varchar(30)' },
    direccion: { type: 'text' },
    redes_sociales: { type: 'jsonb' },
    identidad_visual: { type: 'jsonb' },
  });
  pgm.addConstraint('configuracion_tenant', 'configuracion_tenant_tenant_unique', 'UNIQUE(tenant_id)');

  // --- configuracion_web_publica (1-1 con tenants, solo aplica si el plan incluye 'pagina_web') ---
  pgm.createTable('configuracion_web_publica', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    habilitada: { type: 'boolean', notNull: true, default: false },
    mostrar_disciplinas: { type: 'boolean', notNull: true, default: true },
    mostrar_cursos: { type: 'boolean', notNull: true, default: true },
    mostrar_profesores: { type: 'boolean', notNull: true, default: true },
    mostrar_horarios: { type: 'boolean', notNull: true, default: true },
    mostrar_contacto: { type: 'boolean', notNull: true, default: true },
    mostrar_redes_sociales: { type: 'boolean', notNull: true, default: true },
    texto_bienvenida: { type: 'text' },
    imagen_portada_url: { type: 'text' },
    slug_publico: { type: 'varchar(80)' },
  });
  pgm.addConstraint('configuracion_web_publica', 'configuracion_web_publica_tenant_unique', 'UNIQUE(tenant_id)');
  pgm.addConstraint('configuracion_web_publica', 'configuracion_web_publica_slug_unique', 'UNIQUE(slug_publico)');

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
  pgm.dropTable('configuracion_web_publica');
  pgm.dropTable('configuracion_tenant');
  pgm.dropTable('pagos');
};

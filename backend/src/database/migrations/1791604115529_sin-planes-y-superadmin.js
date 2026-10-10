/**
 * Fuera el autoservicio: las academias las da de alta el proveedor.
 *
 * El modelo cambia, no se ajusta. No hay registro público ni planes: cuando
 * alguien quiere usar el sistema se contacta en privado, y el superadmin le
 * crea la academia con su primer administrador. Cada academia tiene todo
 * desde el día uno, como en SIGEM.
 *
 * Qué entra en lugar de los planes:
 *
 * - `tenants.activo`: para suspender una academia. Es lo que reemplaza a
 *   `suscripciones.estado`, sin necesitar planes ni facturación.
 * - datos de contacto en `tenants`: si el alta es por privado, en algún lado
 *   hay que anotar con quién se habló.
 * - rol `superadmin`.
 * - `auditoria`: lo que el superadmin modifica dentro de una academia ajena
 *   queda registrado. Entrar a los datos de otro no debería ser invisible.
 *
 * Sobre el `down`: recrea las cinco tablas y sus catálogos, pero no puede
 * devolver qué plan tenía cada academia; esa información se pierde al
 * borrar `suscripciones` y no hay de dónde reconstruirla.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  /* ---------- se va el SaaS ---------- */

  // En este orden por las claves foráneas: primero lo que apunta, después
  // lo apuntado.
  pgm.dropTable('suscripciones');
  pgm.dropTable('plan_funcionalidades');
  pgm.dropTable('plan_limites');
  pgm.dropTable('funcionalidades');
  pgm.dropTable('planes');

  /* ---------- la academia como cuenta ---------- */

  pgm.addColumns('tenants', {
    // Una academia suspendida existe y conserva sus datos, pero su gente
    // no entra. Borrarla sería perder el historial.
    activo: { type: 'boolean', notNull: true, default: true },
    contacto_nombre: { type: 'varchar(150)' },
    contacto_email: { type: 'varchar(150)' },
    contacto_telefono: { type: 'varchar(30)' },
    observaciones: { type: 'text' },
  });

  /* ---------- el proveedor ---------- */

  pgm.sql(`
    INSERT INTO roles (nombre, descripcion)
    VALUES ('superadmin', 'Proveedor del sistema: da de alta y suspende academias')
    ON CONFLICT (nombre) DO NOTHING;
  `);

  /* ---------- auditoría ---------- */

  // A propósito SIN Row Level Security: el superadmin escribe acá estando
  // dentro de una academia ajena y después lo lee desde la suya. Con una
  // política por tenant no podría leer lo que él mismo registró.
  //
  // El email y el nombre se guardan copiados, no solo por clave foránea:
  // si después se borra el usuario o la academia, el registro tiene que
  // seguir diciendo quién hizo qué. Un historial que se vacía solo no
  // sirve para rendir cuentas.
  pgm.createTable('auditoria', {
    id: 'id',
    usuario_id: { type: 'integer', references: 'usuarios', onDelete: 'SET NULL' },
    usuario_email: { type: 'varchar(150)' },
    tenant_id: { type: 'integer', references: 'tenants', onDelete: 'SET NULL' },
    tenant_nombre: { type: 'varchar(150)' },
    accion: { type: 'varchar(50)', notNull: true },
    detalle: { type: 'text' },
    creado_en: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('auditoria', [{ name: 'creado_en', sort: 'DESC' }]);
  pgm.createIndex('auditoria', 'tenant_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.dropTable('auditoria');

  pgm.dropColumns('tenants', [
    'activo',
    'contacto_nombre',
    'contacto_email',
    'contacto_telefono',
    'observaciones',
  ]);

  pgm.sql("DELETE FROM roles WHERE nombre = 'superadmin';");

  /* ---------- vuelven los planes (estructura y catálogos) ---------- */

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

  pgm.createTable('funcionalidades', {
    id: 'id',
    clave: { type: 'varchar(80)', notNull: true },
    nombre: { type: 'varchar(150)', notNull: true },
    descripcion: { type: 'text' },
  });
  pgm.addConstraint('funcionalidades', 'funcionalidades_clave_unique', 'UNIQUE(clave)');
  pgm.sql(`
    INSERT INTO funcionalidades (clave, nombre) VALUES
      ('evaluaciones', 'Evaluaciones y notas'),
      ('seguimiento', 'Seguimiento académico'),
      ('pagos', 'Registro y control de pagos'),
      ('reportes_basicos', 'Reportes básicos'),
      ('reportes_avanzados', 'Reportes y estadísticas avanzadas'),
      ('personalizacion_basica', 'Personalización básica de la academia'),
      ('personalizacion_avanzada', 'Personalización avanzada de identidad visual'),
      ('pagina_web', 'Página web promocional');
  `);

  pgm.createTable('plan_funcionalidades', {
    id: 'id',
    plan_id: { type: 'integer', notNull: true, references: 'planes', onDelete: 'CASCADE' },
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

  pgm.createTable('plan_limites', {
    id: 'id',
    plan_id: { type: 'integer', notNull: true, references: 'planes', onDelete: 'CASCADE' },
    clave: { type: 'varchar(80)', notNull: true },
    valor: { type: 'integer' },
  });
  pgm.addConstraint('plan_limites', 'plan_limites_unique', 'UNIQUE(plan_id, clave)');

  pgm.createTable('suscripciones', {
    id: 'id',
    tenant_id: { type: 'integer', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    plan_id: { type: 'integer', notNull: true, references: 'planes', onDelete: 'RESTRICT' },
    estado: { type: 'varchar(20)', notNull: true, default: 'prueba' },
    fecha_inicio: { type: 'date', notNull: true, default: pgm.func('current_date') },
    fecha_vencimiento: { type: 'date' },
    periodo_facturacion: { type: 'varchar(20)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('suscripciones', 'tenant_id');

  pgm.sql('ALTER TABLE suscripciones ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE suscripciones FORCE ROW LEVEL SECURITY;');
  pgm.sql(`
    CREATE POLICY tenant_isolation_suscripciones ON suscripciones
    USING (tenant_id = current_setting('app.current_tenant', true)::integer);
  `);
};

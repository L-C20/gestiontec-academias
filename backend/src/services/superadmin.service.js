const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../database/pool');
const { AppError } = require('../utils/errors');
const { invalidarCache } = require('../middleware/tenant.middleware');

const SALT_ROUNDS = 10;

/**
 * Lo que hace el proveedor: dar de alta academias cuando alguien se contacta,
 * suspenderlas, y entrar a una para ayudar.
 *
 * Nota sobre lo que esta pantalla NO muestra: cuántos alumnos o profesores
 * tiene cada academia. Esos datos están detrás de FORCE ROW LEVEL SECURITY,
 * y contarlos desde afuera obligaría a agregarle a las quince políticas una
 * excepción para el superadmin. No vale la pena debilitar el aislamiento
 * entero por una columna de la tabla: entrando a la academia se ve todo.
 */

const CAMPOS = `
  id, nombre, slug, activo,
  contacto_nombre, contacto_email, contacto_telefono,
  observaciones, created_at
`;

// `tenants` no tiene RLS (es la tabla raíz), así que esto se consulta con el
// pool y no con la conexión del request.
async function listarAcademias() {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS} FROM tenants ORDER BY activo DESC, nombre`
  );
  return rows;
}

async function obtenerAcademia(id) {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM tenants WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Crea la academia junto con su primer administrador.
 *
 * Las dos cosas en una transacción a propósito: una academia sin nadie que
 * pueda entrar no le sirve a nadie, y habría que borrarla a mano.
 */
async function crearAcademia({
  nombre,
  slug,
  contactoNombre,
  contactoEmail,
  contactoTelefono,
  observaciones,
  adminEmail,
  adminPassword,
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO tenants
         (nombre, slug, contacto_nombre, contacto_email, contacto_telefono, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${CAMPOS}`,
      [
        nombre,
        slug,
        contactoNombre || null,
        contactoEmail || null,
        contactoTelefono || null,
        observaciones || null,
      ]
    );

    const academia = rows[0];

    // De acá en adelante cualquier tabla con RLS exige este contexto.
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [
      String(academia.id),
    ]);

    const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

    const { rows: usuarios } = await client.query(
      `INSERT INTO usuarios (tenant_id, rol_id, email, password_hash)
       SELECT $1, r.id, $2, $3 FROM roles r WHERE r.nombre = 'admin'
       RETURNING id, email`,
      [academia.id, adminEmail, passwordHash]
    );

    await client.query('COMMIT');

    return { academia, admin: usuarios[0] };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});

    if (err.code === '23505') {
      throw new AppError(409, 'Ya existe una academia con ese identificador (slug)');
    }
    throw err;
  } finally {
    client.release();
  }
}

async function actualizarAcademia(id, datos) {
  const { nombre, contactoNombre, contactoEmail, contactoTelefono, observaciones } = datos;

  const { rows } = await pool.query(
    `UPDATE tenants
     SET nombre = $1, contacto_nombre = $2, contacto_email = $3,
         contacto_telefono = $4, observaciones = $5
     WHERE id = $6
     RETURNING ${CAMPOS}`,
    [nombre, contactoNombre || null, contactoEmail || null, contactoTelefono || null, observaciones || null, id]
  );

  return rows[0] || null;
}

/**
 * Suspender no borra: la academia conserva sus alumnos, sus notas y su
 * historial, simplemente su gente no entra. Borrarla sería perder todo eso,
 * y una suspensión casi siempre es temporal.
 */
async function cambiarEstado(id, activo, usuarioQueActua) {
  const { rows } = await pool.query(
    `UPDATE tenants SET activo = $1 WHERE id = $2 RETURNING ${CAMPOS}`,
    [activo, id]
  );

  if (rows.length === 0) return null;

  await registrar({
    usuarioId: usuarioQueActua.userId,
    usuarioEmail: usuarioQueActua.email,
    tenantId: rows[0].id,
    tenantNombre: rows[0].nombre,
    accion: activo ? 'academia_reactivada' : 'academia_suspendida',
    detalle: null,
  });

  // Las sesiones abiertas de esa academia tienen el estado viejo en caché.
  invalidarCache();

  return rows[0];
}

/**
 * Entra a una academia ajena: emite un token con la academia de destino,
 * manteniendo cuál es la academia propia para que el middleware sepa que
 * esto es modo soporte y lo audite.
 */
async function tokenDeSoporte(usuario, tenantDestinoId) {
  const academia = await obtenerAcademia(tenantDestinoId);
  if (!academia) {
    throw new AppError(404, 'La academia no existe');
  }

  await registrar({
    usuarioId: usuario.userId,
    usuarioEmail: usuario.email,
    tenantId: academia.id,
    tenantNombre: academia.nombre,
    accion: 'soporte_ingreso',
    detalle: null,
  });

  const token = jwt.sign(
    {
      userId: usuario.userId,
      tenantId: academia.id,
      tenantPropioId: usuario.tenantPropioId,
      rol: 'superadmin',
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return { token, academia };
}

/** Vuelve a la academia propia del superadmin. */
function tokenDeVuelta(usuario) {
  return jwt.sign(
    {
      userId: usuario.userId,
      tenantId: usuario.tenantPropioId,
      tenantPropioId: usuario.tenantPropioId,
      rol: 'superadmin',
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

/* ---------- auditoría ---------- */

// `auditoria` no tiene RLS: el superadmin escribe estando dentro de una
// academia ajena y lo lee desde la suya.
async function registrar({ usuarioId, usuarioEmail, tenantId, tenantNombre, accion, detalle }) {
  await pool
    .query(
      `INSERT INTO auditoria
         (usuario_id, usuario_email, tenant_id, tenant_nombre, accion, detalle)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [usuarioId, usuarioEmail || null, tenantId || null, tenantNombre || null, accion, detalle || null]
    )
    .catch((error) => console.error('No se pudo registrar la auditoría:', error.message));
}

async function listarAuditoria({ tenantId, limite = 100 }) {
  const condicion = tenantId ? 'WHERE tenant_id = $2' : '';
  const parametros = tenantId ? [limite, tenantId] : [limite];

  const { rows } = await pool.query(
    `SELECT id, usuario_email, tenant_id, tenant_nombre, accion, detalle, creado_en
     FROM auditoria
     ${condicion}
     ORDER BY creado_en DESC
     LIMIT $1`,
    parametros
  );
  return rows;
}

module.exports = {
  listarAcademias,
  obtenerAcademia,
  crearAcademia,
  actualizarAcademia,
  cambiarEstado,
  tokenDeSoporte,
  tokenDeVuelta,
  listarAuditoria,
};

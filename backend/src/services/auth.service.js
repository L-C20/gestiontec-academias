const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../database/pool');
const { AppError } = require('../utils/errors');

/**
 * Login por academia: el slug identifica a la academia y el email a la
 * persona dentro de ella. Dos academias pueden tener el mismo email sin
 * pisarse (`usuarios_tenant_email_unique`).
 *
 * El superadmin entra igual que todos, con el slug de su propia academia.
 */
async function login({ slug, email, password }) {
  const tenantResult = await pool.query(
    'SELECT id, nombre, activo FROM tenants WHERE slug = $1',
    [slug]
  );

  // Mismo mensaje que una contraseña equivocada: decir "esa academia no
  // existe" le confirma a cualquiera qué slugs son válidos.
  if (tenantResult.rows.length === 0) {
    throw new AppError(401, 'Credenciales inválidas');
  }

  const academia = tenantResult.rows[0];

  const client = await pool.connect();
  let usuario;
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [
      String(academia.id),
    ]);

    const usuarioResult = await client.query(
      `SELECT u.id, u.password_hash, u.estado, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.tenant_id = $1 AND u.email = $2`,
      [academia.id, email]
    );
    await client.query('COMMIT');
    usuario = usuarioResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  if (!usuario) {
    throw new AppError(401, 'Credenciales inválidas');
  }

  // La contraseña se verifica antes de contar cualquier cosa sobre el estado
  // de la cuenta o de la academia: si no, quien no sabe la contraseña igual
  // averiguaría que la academia existe y está suspendida.
  const passwordValida = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValida) {
    throw new AppError(401, 'Credenciales inválidas');
  }

  if (usuario.estado !== 'activo') {
    throw new AppError(403, 'El usuario está inactivo');
  }

  // Una academia suspendida no deja entrar a su gente. El superadmin sí,
  // porque tiene que poder revisarla para decidir si la reactiva.
  if (!academia.activo && usuario.rol !== 'superadmin') {
    throw new AppError(403, 'La academia está suspendida. Contactate con el administrador.');
  }

  const token = jwt.sign(
    {
      userId: usuario.id,
      tenantId: academia.id,
      tenantPropioId: academia.id,
      rol: usuario.rol,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return token;
}

module.exports = { login };

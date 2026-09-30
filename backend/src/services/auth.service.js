const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../database/pool');
const { AppError } = require('../utils/errors');

const SALT_ROUNDS = 10;

async function registrarTenant({ nombreAcademia, slug, email, password }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tenantResult = await client.query(
      'INSERT INTO tenants (nombre, slug) VALUES ($1, $2) RETURNING id, nombre, slug',
      [nombreAcademia, slug]
    );
    const tenant = tenantResult.rows[0];

    // A partir de acá cualquier tabla con RLS exige este contexto seteado.
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [String(tenant.id)]);

    const rolResult = await client.query("SELECT id FROM roles WHERE nombre = 'admin'");
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const usuarioResult = await client.query(
      `INSERT INTO usuarios (tenant_id, rol_id, email, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, email`,
      [tenant.id, rolResult.rows[0].id, email, passwordHash]
    );

    await client.query(
      `INSERT INTO suscripciones (tenant_id, plan_id, estado)
       SELECT $1, id, 'prueba' FROM planes WHERE nombre = 'basico'`,
      [tenant.id]
    );

    await client.query('COMMIT');
    return { tenant, usuario: usuarioResult.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      // unique_violation (slug de tenant o email repetido)
      throw new AppError(409, 'Ya existe un registro con esos datos (slug o email duplicado)');
    }
    throw err;
  } finally {
    client.release();
  }
}

async function login({ slug, email, password }) {
  const tenantResult = await pool.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
  if (tenantResult.rows.length === 0) {
    throw new AppError(401, 'Credenciales inválidas');
  }
  const tenantId = tenantResult.rows[0].id;

  const client = await pool.connect();
  let usuario;
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [String(tenantId)]);

    const usuarioResult = await client.query(
      `SELECT u.id, u.password_hash, u.estado, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.tenant_id = $1 AND u.email = $2`,
      [tenantId, email]
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
  if (usuario.estado !== 'activo') {
    throw new AppError(403, 'El usuario está inactivo');
  }

  const passwordValida = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValida) {
    throw new AppError(401, 'Credenciales inválidas');
  }

  const token = jwt.sign(
    { userId: usuario.id, tenantId, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return token;
}

module.exports = { registrarTenant, login };

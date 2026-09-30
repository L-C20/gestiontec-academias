const CAMPOS = `id, nombre, apellido, documento, fecha_nacimiento, telefono, email, direccion,
  contacto_emergencia_nombre, contacto_emergencia_telefono, observaciones, estado, created_at`;

function datosDesdeBody(body) {
  return [
    body.nombre,
    body.apellido,
    body.documento || null,
    body.fechaNacimiento || null,
    body.telefono || null,
    body.email || null,
    body.direccion || null,
    body.contactoEmergenciaNombre || null,
    body.contactoEmergenciaTelefono || null,
    body.observaciones || null,
  ];
}

async function listar(db) {
  const { rows } = await db.query(`SELECT ${CAMPOS} FROM alumnos ORDER BY apellido, nombre`);
  return rows;
}

async function buscar(db, texto) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM alumnos
     WHERE nombre ILIKE $1 OR apellido ILIKE $1 OR documento ILIKE $1
     ORDER BY apellido, nombre`,
    [`%${texto}%`]
  );
  return rows;
}

async function obtenerPorId(db, id) {
  const { rows } = await db.query(`SELECT ${CAMPOS} FROM alumnos WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function crear(db, tenantId, body) {
  const { rows } = await db.query(
    `INSERT INTO alumnos (
       tenant_id, nombre, apellido, documento, fecha_nacimiento, telefono, email, direccion,
       contacto_emergencia_nombre, contacto_emergencia_telefono, observaciones
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${CAMPOS}`,
    [tenantId, ...datosDesdeBody(body)]
  );
  return rows[0];
}

async function actualizar(db, id, body) {
  const { rows } = await db.query(
    `UPDATE alumnos SET
       nombre = $1, apellido = $2, documento = $3, fecha_nacimiento = $4, telefono = $5,
       email = $6, direccion = $7, contacto_emergencia_nombre = $8,
       contacto_emergencia_telefono = $9, observaciones = $10
     WHERE id = $11
     RETURNING ${CAMPOS}`,
    [...datosDesdeBody(body), id]
  );
  return rows[0] || null;
}

async function cambiarEstado(db, id, estado) {
  const { rows } = await db.query(
    `UPDATE alumnos SET estado = $1 WHERE id = $2 RETURNING ${CAMPOS}`,
    [estado, id]
  );
  return rows[0] || null;
}

async function contar(db) {
  const { rows } = await db.query('SELECT count(*)::int AS total FROM alumnos');
  return rows[0].total;
}

module.exports = { listar, buscar, obtenerPorId, crear, actualizar, cambiarEstado, contar };

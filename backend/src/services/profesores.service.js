const CAMPOS = 'id, nombre, apellido, documento, telefono, email, especialidad, observaciones, estado';

async function listar(db) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM profesores ORDER BY apellido, nombre`
  );
  return rows;
}

async function obtenerPorId(db, id) {
  const { rows } = await db.query(`SELECT ${CAMPOS} FROM profesores WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function crear(db, tenantId, datos) {
  const { nombre, apellido, documento, telefono, email, especialidad, observaciones } = datos;
  const { rows } = await db.query(
    `INSERT INTO profesores (tenant_id, nombre, apellido, documento, telefono, email, especialidad, observaciones)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${CAMPOS}`,
    [tenantId, nombre, apellido, documento || null, telefono || null, email || null, especialidad || null, observaciones || null]
  );
  return rows[0];
}

async function actualizar(db, id, datos) {
  const { nombre, apellido, documento, telefono, email, especialidad, observaciones } = datos;
  const { rows } = await db.query(
    `UPDATE profesores
     SET nombre = $1, apellido = $2, documento = $3, telefono = $4, email = $5, especialidad = $6, observaciones = $7
     WHERE id = $8
     RETURNING ${CAMPOS}`,
    [nombre, apellido, documento || null, telefono || null, email || null, especialidad || null, observaciones || null, id]
  );
  return rows[0] || null;
}

async function cambiarEstado(db, id, estado) {
  const { rows } = await db.query(
    `UPDATE profesores SET estado = $1 WHERE id = $2 RETURNING ${CAMPOS}`,
    [estado, id]
  );
  return rows[0] || null;
}

async function contar(db) {
  const { rows } = await db.query('SELECT count(*)::int AS total FROM profesores');
  return rows[0].total;
}

module.exports = { listar, obtenerPorId, crear, actualizar, cambiarEstado, contar };

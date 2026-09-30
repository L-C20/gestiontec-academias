const CAMPOS = 'id, nombre, fecha_inicio, fecha_fin, activo';

async function listar(db) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM periodos_academicos ORDER BY fecha_inicio DESC`
  );
  return rows;
}

async function obtenerPorId(db, id) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM periodos_academicos WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function crear(db, tenantId, { nombre, fechaInicio, fechaFin }) {
  const { rows } = await db.query(
    `INSERT INTO periodos_academicos (tenant_id, nombre, fecha_inicio, fecha_fin)
     VALUES ($1, $2, $3, $4)
     RETURNING ${CAMPOS}`,
    [tenantId, nombre, fechaInicio, fechaFin]
  );
  return rows[0];
}

async function actualizar(db, id, { nombre, fechaInicio, fechaFin }) {
  const { rows } = await db.query(
    `UPDATE periodos_academicos SET nombre = $1, fecha_inicio = $2, fecha_fin = $3
     WHERE id = $4
     RETURNING ${CAMPOS}`,
    [nombre, fechaInicio, fechaFin, id]
  );
  return rows[0] || null;
}

async function cambiarActivo(db, id, activo) {
  const { rows } = await db.query(
    `UPDATE periodos_academicos SET activo = $1 WHERE id = $2 RETURNING ${CAMPOS}`,
    [activo, id]
  );
  return rows[0] || null;
}

module.exports = { listar, obtenerPorId, crear, actualizar, cambiarActivo };

async function listar(db) {
  const { rows } = await db.query(
    'SELECT id, nombre, orden, estado FROM niveles ORDER BY orden, nombre'
  );
  return rows;
}

async function obtenerPorId(db, id) {
  const { rows } = await db.query(
    'SELECT id, nombre, orden, estado FROM niveles WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function crear(db, tenantId, { nombre, orden }) {
  const { rows } = await db.query(
    `INSERT INTO niveles (tenant_id, nombre, orden)
     VALUES ($1, $2, $3)
     RETURNING id, nombre, orden, estado`,
    [tenantId, nombre, orden ?? 0]
  );
  return rows[0];
}

async function actualizar(db, id, { nombre, orden }) {
  const { rows } = await db.query(
    `UPDATE niveles SET nombre = $1, orden = $2
     WHERE id = $3
     RETURNING id, nombre, orden, estado`,
    [nombre, orden ?? 0, id]
  );
  return rows[0] || null;
}

async function cambiarEstado(db, id, estado) {
  const { rows } = await db.query(
    'UPDATE niveles SET estado = $1 WHERE id = $2 RETURNING id, nombre, orden, estado',
    [estado, id]
  );
  return rows[0] || null;
}

module.exports = { listar, obtenerPorId, crear, actualizar, cambiarEstado };

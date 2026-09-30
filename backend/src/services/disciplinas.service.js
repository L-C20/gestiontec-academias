async function listar(db) {
  const { rows } = await db.query(
    'SELECT id, nombre, descripcion, estado FROM disciplinas ORDER BY nombre'
  );
  return rows;
}

async function obtenerPorId(db, id) {
  const { rows } = await db.query(
    'SELECT id, nombre, descripcion, estado FROM disciplinas WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function crear(db, tenantId, { nombre, descripcion }) {
  const { rows } = await db.query(
    `INSERT INTO disciplinas (tenant_id, nombre, descripcion)
     VALUES ($1, $2, $3)
     RETURNING id, nombre, descripcion, estado`,
    [tenantId, nombre, descripcion || null]
  );
  return rows[0];
}

async function actualizar(db, id, { nombre, descripcion }) {
  const { rows } = await db.query(
    `UPDATE disciplinas SET nombre = $1, descripcion = $2
     WHERE id = $3
     RETURNING id, nombre, descripcion, estado`,
    [nombre, descripcion || null, id]
  );
  return rows[0] || null;
}

async function cambiarEstado(db, id, estado) {
  const { rows } = await db.query(
    'UPDATE disciplinas SET estado = $1 WHERE id = $2 RETURNING id, nombre, descripcion, estado',
    [estado, id]
  );
  return rows[0] || null;
}

async function contar(db) {
  const { rows } = await db.query('SELECT count(*)::int AS total FROM disciplinas');
  return rows[0].total;
}

module.exports = { listar, obtenerPorId, crear, actualizar, cambiarEstado, contar };

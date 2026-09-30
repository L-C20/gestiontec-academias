async function listar(db) {
  const { rows } = await db.query(
    `SELECT c.id, c.nombre, c.descripcion, c.estado, c.disciplina_id, d.nombre AS disciplina_nombre
     FROM cursos c
     JOIN disciplinas d ON d.id = c.disciplina_id
     ORDER BY d.nombre, c.nombre`
  );
  return rows;
}

async function obtenerPorId(db, id) {
  const { rows } = await db.query(
    `SELECT c.id, c.nombre, c.descripcion, c.estado, c.disciplina_id, d.nombre AS disciplina_nombre
     FROM cursos c
     JOIN disciplinas d ON d.id = c.disciplina_id
     WHERE c.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Importante: las FK de Postgres NO respetan RLS. Esta consulta sí, porque
// pasa por `db` (la conexión con el tenant seteado) — es la que realmente
// garantiza que la disciplina sea de este tenant.
async function existeDisciplina(db, disciplinaId) {
  const { rows } = await db.query('SELECT 1 FROM disciplinas WHERE id = $1', [disciplinaId]);
  return rows.length > 0;
}

async function crear(db, tenantId, { nombre, descripcion, disciplinaId }) {
  const { rows } = await db.query(
    `INSERT INTO cursos (tenant_id, disciplina_id, nombre, descripcion)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, descripcion, estado, disciplina_id`,
    [tenantId, disciplinaId, nombre, descripcion || null]
  );
  return rows[0];
}

async function actualizar(db, id, { nombre, descripcion, disciplinaId }) {
  const { rows } = await db.query(
    `UPDATE cursos SET nombre = $1, descripcion = $2, disciplina_id = $3
     WHERE id = $4
     RETURNING id, nombre, descripcion, estado, disciplina_id`,
    [nombre, descripcion || null, disciplinaId, id]
  );
  return rows[0] || null;
}

async function cambiarEstado(db, id, estado) {
  const { rows } = await db.query(
    'UPDATE cursos SET estado = $1 WHERE id = $2 RETURNING id, nombre, descripcion, estado, disciplina_id',
    [estado, id]
  );
  return rows[0] || null;
}

module.exports = { listar, obtenerPorId, existeDisciplina, crear, actualizar, cambiarEstado };

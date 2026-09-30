async function existe(db, tabla, id) {
  const { rows } = await db.query(`SELECT 1 FROM ${tabla} WHERE id = $1`, [id]);
  return rows.length > 0;
}

const existeDisciplina = (db, id) => existe(db, 'disciplinas', id);
const existeNivel = (db, id) => existe(db, 'niveles', id);
const existeProfesor = (db, id) => existe(db, 'profesores', id);
const existePeriodo = (db, id) => existe(db, 'periodos_academicos', id);

// No alcanza con que el curso exista: tiene que pertenecer a la disciplina
// elegida (si no, "Piano Inicial" podría terminar colgado de "Inglés").
async function cursoPerteneceADisciplina(db, cursoId, disciplinaId) {
  const { rows } = await db.query(
    'SELECT 1 FROM cursos WHERE id = $1 AND disciplina_id = $2',
    [cursoId, disciplinaId]
  );
  return rows.length > 0;
}

const CAMPOS_SELECT = `
  g.id, g.nombre, g.capacidad, g.estado,
  g.disciplina_id, d.nombre AS disciplina_nombre,
  g.curso_id, c.nombre AS curso_nombre,
  g.nivel_id, n.nombre AS nivel_nombre,
  g.profesor_id, p.nombre AS profesor_nombre, p.apellido AS profesor_apellido,
  g.periodo_academico_id, pa.nombre AS periodo_nombre
`;

const JOINS = `
  FROM grupos g
  JOIN disciplinas d ON d.id = g.disciplina_id
  JOIN cursos c ON c.id = g.curso_id
  LEFT JOIN niveles n ON n.id = g.nivel_id
  LEFT JOIN profesores p ON p.id = g.profesor_id
  JOIN periodos_academicos pa ON pa.id = g.periodo_academico_id
`;

async function listar(db) {
  const { rows } = await db.query(`SELECT ${CAMPOS_SELECT} ${JOINS} ORDER BY g.nombre`);
  return rows;
}

async function obtenerPorId(db, id) {
  const { rows } = await db.query(`SELECT ${CAMPOS_SELECT} ${JOINS} WHERE g.id = $1`, [id]);
  return rows[0] || null;
}

async function crear(db, tenantId, datos) {
  const { nombre, disciplinaId, cursoId, nivelId, profesorId, periodoAcademicoId, capacidad } = datos;
  const { rows } = await db.query(
    `INSERT INTO grupos (tenant_id, nombre, disciplina_id, curso_id, nivel_id, profesor_id, periodo_academico_id, capacidad)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [tenantId, nombre, disciplinaId, cursoId, nivelId || null, profesorId || null, periodoAcademicoId, capacidad || null]
  );
  return obtenerPorId(db, rows[0].id);
}

async function actualizar(db, id, datos) {
  const { nombre, disciplinaId, cursoId, nivelId, profesorId, periodoAcademicoId, capacidad } = datos;
  const { rows } = await db.query(
    `UPDATE grupos
     SET nombre = $1, disciplina_id = $2, curso_id = $3, nivel_id = $4,
         profesor_id = $5, periodo_academico_id = $6, capacidad = $7
     WHERE id = $8
     RETURNING id`,
    [nombre, disciplinaId, cursoId, nivelId || null, profesorId || null, periodoAcademicoId, capacidad || null, id]
  );
  if (rows.length === 0) return null;
  return obtenerPorId(db, id);
}

async function cambiarEstado(db, id, estado) {
  const { rows } = await db.query('UPDATE grupos SET estado = $1 WHERE id = $2 RETURNING id', [
    estado,
    id,
  ]);
  if (rows.length === 0) return null;
  return obtenerPorId(db, id);
}

async function contar(db) {
  const { rows } = await db.query('SELECT count(*)::int AS total FROM grupos');
  return rows[0].total;
}

module.exports = {
  existeDisciplina,
  existeNivel,
  existeProfesor,
  existePeriodo,
  cursoPerteneceADisciplina,
  listar,
  obtenerPorId,
  crear,
  actualizar,
  cambiarEstado,
  contar,
};

const CAMPOS_SELECT = `
  i.id, i.fecha_inscripcion, i.estado,
  i.alumno_id, a.nombre AS alumno_nombre, a.apellido AS alumno_apellido,
  i.grupo_id, g.nombre AS grupo_nombre
`;
const JOINS = `
  FROM inscripciones i
  JOIN alumnos a ON a.id = i.alumno_id
  JOIN grupos g ON g.id = i.grupo_id
`;

async function existeAlumno(db, alumnoId) {
  const { rows } = await db.query('SELECT 1 FROM alumnos WHERE id = $1', [alumnoId]);
  return rows.length > 0;
}

async function obtenerGrupo(db, grupoId) {
  const { rows } = await db.query('SELECT id, capacidad FROM grupos WHERE id = $1', [grupoId]);
  return rows[0] || null;
}

async function contarActivasPorGrupo(db, grupoId) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS total FROM inscripciones WHERE grupo_id = $1 AND estado = 'activa'`,
    [grupoId]
  );
  return rows[0].total;
}

async function existeInscripcionActiva(db, alumnoId, grupoId) {
  const { rows } = await db.query(
    `SELECT 1 FROM inscripciones WHERE alumno_id = $1 AND grupo_id = $2 AND estado = 'activa'`,
    [alumnoId, grupoId]
  );
  return rows.length > 0;
}

async function listar(db) {
  const { rows } = await db.query(`SELECT ${CAMPOS_SELECT} ${JOINS} ORDER BY i.fecha_inscripcion DESC`);
  return rows;
}

async function listarPorAlumno(db, alumnoId) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS_SELECT} ${JOINS} WHERE i.alumno_id = $1 ORDER BY i.fecha_inscripcion DESC`,
    [alumnoId]
  );
  return rows;
}

async function listarPorGrupo(db, grupoId) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS_SELECT} ${JOINS} WHERE i.grupo_id = $1 ORDER BY i.fecha_inscripcion DESC`,
    [grupoId]
  );
  return rows;
}

async function obtenerPorId(db, id) {
  const { rows } = await db.query(`SELECT ${CAMPOS_SELECT} ${JOINS} WHERE i.id = $1`, [id]);
  return rows[0] || null;
}

async function crear(db, tenantId, { alumnoId, grupoId }) {
  const { rows } = await db.query(
    `INSERT INTO inscripciones (tenant_id, alumno_id, grupo_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [tenantId, alumnoId, grupoId]
  );
  return obtenerPorId(db, rows[0].id);
}

async function cambiarEstado(db, id, estado) {
  const { rows } = await db.query(
    `UPDATE inscripciones SET estado = $1 WHERE id = $2 RETURNING id`,
    [estado, id]
  );
  if (rows.length === 0) return null;
  return obtenerPorId(db, id);
}

module.exports = {
  existeAlumno,
  obtenerGrupo,
  contarActivasPorGrupo,
  existeInscripcionActiva,
  listar,
  listarPorAlumno,
  listarPorGrupo,
  obtenerPorId,
  crear,
  cambiarEstado,
};

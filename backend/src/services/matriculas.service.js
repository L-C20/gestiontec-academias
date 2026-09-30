const CAMPOS_SELECT = `
  m.id, m.numero_matricula, m.fecha_alta, m.fecha_baja, m.estado, m.observaciones,
  m.alumno_id, a.nombre AS alumno_nombre, a.apellido AS alumno_apellido,
  m.periodo_academico_id, p.nombre AS periodo_nombre
`;
const JOINS = `
  FROM matriculas m
  JOIN alumnos a ON a.id = m.alumno_id
  JOIN periodos_academicos p ON p.id = m.periodo_academico_id
`;

async function existeAlumno(db, alumnoId) {
  const { rows } = await db.query('SELECT 1 FROM alumnos WHERE id = $1', [alumnoId]);
  return rows.length > 0;
}

async function existePeriodo(db, periodoId) {
  const { rows } = await db.query('SELECT 1 FROM periodos_academicos WHERE id = $1', [periodoId]);
  return rows.length > 0;
}

async function listar(db) {
  const { rows } = await db.query(`SELECT ${CAMPOS_SELECT} ${JOINS} ORDER BY m.fecha_alta DESC`);
  return rows;
}

async function listarPorAlumno(db, alumnoId) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS_SELECT} ${JOINS} WHERE m.alumno_id = $1 ORDER BY m.fecha_alta DESC`,
    [alumnoId]
  );
  return rows;
}

async function obtenerPorId(db, id) {
  const { rows } = await db.query(`SELECT ${CAMPOS_SELECT} ${JOINS} WHERE m.id = $1`, [id]);
  return rows[0] || null;
}

async function crear(db, tenantId, { alumnoId, periodoAcademicoId, numeroMatricula, observaciones }) {
  const { rows } = await db.query(
    `INSERT INTO matriculas (tenant_id, alumno_id, periodo_academico_id, numero_matricula, observaciones)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [tenantId, alumnoId, periodoAcademicoId, numeroMatricula, observaciones || null]
  );
  return obtenerPorId(db, rows[0].id);
}

async function actualizarObservaciones(db, id, observaciones) {
  const { rows } = await db.query(
    'UPDATE matriculas SET observaciones = $1 WHERE id = $2 RETURNING id',
    [observaciones || null, id]
  );
  if (rows.length === 0) return null;
  return obtenerPorId(db, id);
}

async function darDeBaja(db, id) {
  const { rows } = await db.query(
    `UPDATE matriculas SET estado = 'baja', fecha_baja = CURRENT_DATE WHERE id = $1 RETURNING id`,
    [id]
  );
  if (rows.length === 0) return null;
  return obtenerPorId(db, id);
}

async function reactivar(db, id) {
  const { rows } = await db.query(
    `UPDATE matriculas SET estado = 'activa', fecha_baja = NULL WHERE id = $1 RETURNING id`,
    [id]
  );
  if (rows.length === 0) return null;
  return obtenerPorId(db, id);
}

module.exports = {
  existeAlumno,
  existePeriodo,
  listar,
  listarPorAlumno,
  obtenerPorId,
  crear,
  actualizarObservaciones,
  darDeBaja,
  reactivar,
};

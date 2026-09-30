async function obtenerInscripcion(db, inscripcionId) {
  const { rows } = await db.query('SELECT id, estado FROM inscripciones WHERE id = $1', [
    inscripcionId,
  ]);
  return rows[0] || null;
}

const CAMPOS = 'id, inscripcion_id, fecha, estado, observaciones';

async function listarPorInscripcion(db, inscripcionId) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM asistencias WHERE inscripcion_id = $1 ORDER BY fecha DESC`,
    [inscripcionId]
  );
  return rows;
}

async function obtenerPorId(db, id) {
  const { rows } = await db.query(`SELECT ${CAMPOS} FROM asistencias WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function crear(db, tenantId, { inscripcionId, fecha, estado, observaciones }) {
  const { rows } = await db.query(
    `INSERT INTO asistencias (tenant_id, inscripcion_id, fecha, estado, observaciones)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${CAMPOS}`,
    [tenantId, inscripcionId, fecha, estado, observaciones || null]
  );
  return rows[0];
}

async function actualizar(db, id, { estado, observaciones }) {
  const { rows } = await db.query(
    `UPDATE asistencias SET estado = $1, observaciones = $2 WHERE id = $3 RETURNING ${CAMPOS}`,
    [estado, observaciones || null, id]
  );
  return rows[0] || null;
}

// Porcentaje de asistencia: presentes / (presentes + ausentes). Los
// justificados no cuentan como falta pero tampoco suman como presencia.
async function resumenPorInscripcion(db, inscripcionId) {
  const { rows } = await db.query(
    `SELECT
       count(*) FILTER (WHERE estado = 'presente')::int AS presentes,
       count(*) FILTER (WHERE estado = 'ausente')::int AS ausentes,
       count(*) FILTER (WHERE estado = 'justificado')::int AS justificados,
       count(*)::int AS total
     FROM asistencias WHERE inscripcion_id = $1`,
    [inscripcionId]
  );
  const { presentes, ausentes, justificados, total } = rows[0];
  const base = presentes + ausentes;
  const porcentajePresente = base > 0 ? Math.round((presentes / base) * 10000) / 100 : null;
  return { presentes, ausentes, justificados, total, porcentajePresente };
}

module.exports = {
  obtenerInscripcion,
  listarPorInscripcion,
  obtenerPorId,
  crear,
  actualizar,
  resumenPorInscripcion,
};

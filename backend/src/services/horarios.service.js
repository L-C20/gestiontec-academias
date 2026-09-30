const CAMPOS = 'id, grupo_id, dia_semana, hora_inicio, hora_fin, aula';

async function existeGrupo(db, grupoId) {
  const { rows } = await db.query('SELECT 1 FROM grupos WHERE id = $1', [grupoId]);
  return rows.length > 0;
}

async function listarPorGrupo(db, grupoId) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM horarios WHERE grupo_id = $1 ORDER BY dia_semana, hora_inicio`,
    [grupoId]
  );
  return rows;
}

async function obtenerPorId(db, id) {
  const { rows } = await db.query(`SELECT ${CAMPOS} FROM horarios WHERE id = $1`, [id]);
  return rows[0] || null;
}

// Un profesor no puede tener dos clases que se pisen en el mismo día y horario,
// sin importar de qué grupo sean. `excluirHorarioId` sirve para no chocar
// contra sí mismo cuando se está editando un horario existente.
async function buscarConflictoProfesor(db, { grupoId, diaSemana, horaInicio, horaFin, excluirHorarioId }) {
  const { rows } = await db.query(
    `SELECT h.id, g.nombre AS grupo_nombre
     FROM horarios h
     JOIN grupos g ON g.id = h.grupo_id
     WHERE g.profesor_id = (SELECT profesor_id FROM grupos WHERE id = $1)
       AND g.profesor_id IS NOT NULL
       AND h.dia_semana = $2
       AND h.hora_inicio < $3
       AND $4 < h.hora_fin
       AND ($5::integer IS NULL OR h.id != $5)`,
    [grupoId, diaSemana, horaFin, horaInicio, excluirHorarioId || null]
  );
  return rows[0] || null;
}

async function crear(db, tenantId, { grupoId, diaSemana, horaInicio, horaFin, aula }) {
  const { rows } = await db.query(
    `INSERT INTO horarios (tenant_id, grupo_id, dia_semana, hora_inicio, hora_fin, aula)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${CAMPOS}`,
    [tenantId, grupoId, diaSemana, horaInicio, horaFin, aula || null]
  );
  return rows[0];
}

async function actualizar(db, id, { diaSemana, horaInicio, horaFin, aula }) {
  const { rows } = await db.query(
    `UPDATE horarios SET dia_semana = $1, hora_inicio = $2, hora_fin = $3, aula = $4
     WHERE id = $5
     RETURNING ${CAMPOS}`,
    [diaSemana, horaInicio, horaFin, aula || null, id]
  );
  return rows[0] || null;
}

async function eliminar(db, id) {
  const { rowCount } = await db.query('DELETE FROM horarios WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  existeGrupo,
  listarPorGrupo,
  obtenerPorId,
  buscarConflictoProfesor,
  crear,
  actualizar,
  eliminar,
};

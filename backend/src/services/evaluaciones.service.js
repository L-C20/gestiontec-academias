/**
 * Evaluaciones: la consigna que el profesor define para todo el grupo, y el
 * resultado de cada alumno.
 *
 * Son dos cosas distintas a propósito. La consigna existe desde que el
 * profesor la crea, incluso si todavía no corrigió a nadie; recién así se
 * puede decir "a este alumno le falta rendir la Lección 2" en lugar de no
 * saber que la Lección 2 existe.
 */

/**
 * Un profesor solo opera sobre los grupos que tiene asignados.
 *
 * El aislamiento por academia ya lo hace el Row Level Security de la base,
 * pero dentro de una misma academia nada impide que un profesor toque el
 * grupo de otro: eso se decide acá.
 */
async function grupoAccesible(db, grupoId, usuario) {
  if (usuario.rol !== 'profesor') return true;

  const { rows } = await db.query(
    `SELECT 1
     FROM grupos g
     JOIN profesores p ON p.id = g.profesor_id
     WHERE g.id = $1 AND p.usuario_id = $2`,
    [grupoId, usuario.userId]
  );
  return rows.length > 0;
}

async function grupoDeEvaluacion(db, evaluacionId) {
  const { rows } = await db.query('SELECT grupo_id FROM evaluaciones WHERE id = $1', [
    evaluacionId,
  ]);
  return rows[0] ? rows[0].grupo_id : null;
}

/* ---------- la consigna ---------- */

const CAMPOS = `
  e.id, e.grupo_id, e.tipo_evaluacion_id, e.periodo_academico_id,
  e.nombre, e.consigna, e.fecha,
  e.obligatoria, e.computa_promedio, e.es_examen,
  te.nombre AS tipo_nombre, te.escala, te.configuracion,
  pa.nombre AS periodo_nombre,
  g.nombre AS grupo_nombre
`;

const JOINS = `
  FROM evaluaciones e
  JOIN tipos_evaluacion te ON te.id = e.tipo_evaluacion_id
  JOIN periodos_academicos pa ON pa.id = e.periodo_academico_id
  JOIN grupos g ON g.id = e.grupo_id
`;

// Cuánto hay cargado de cada evaluación, para que el profesor vea de un
// vistazo qué le falta corregir sin abrir la planilla.
const AVANCE = `
  (SELECT count(*)::int FROM inscripciones i
    WHERE i.grupo_id = e.grupo_id AND i.estado = 'activa')          AS alumnos,
  (SELECT count(*)::int FROM evaluacion_resultados r
    WHERE r.evaluacion_id = e.id)                                   AS cargados,
  (SELECT count(*)::int FROM evaluacion_resultados r
    WHERE r.evaluacion_id = e.id
      AND evaluacion_aprobada(te.escala, te.configuracion,
                              r.resultado_numerico, r.resultado_texto, r.ausente)) AS aprobados,
  (SELECT round(avg(r.resultado_numerico), 2) FROM evaluacion_resultados r
    WHERE r.evaluacion_id = e.id
      AND NOT r.ausente
      AND r.resultado_numerico IS NOT NULL)                         AS promedio
`;

async function listarPorGrupo(db, grupoId, periodoAcademicoId) {
  const condicionPeriodo = periodoAcademicoId ? 'AND e.periodo_academico_id = $2' : '';
  const parametros = periodoAcademicoId ? [grupoId, periodoAcademicoId] : [grupoId];

  const { rows } = await db.query(
    `SELECT ${CAMPOS}, ${AVANCE}
     ${JOINS}
     WHERE e.grupo_id = $1 ${condicionPeriodo}
     ORDER BY pa.fecha_inicio DESC, e.fecha NULLS LAST, e.id`,
    parametros
  );
  return rows;
}

async function obtenerPorId(db, id) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS}, ${AVANCE} ${JOINS} WHERE e.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function crear(db, tenantId, datos) {
  const {
    grupoId,
    tipoEvaluacionId,
    periodoAcademicoId,
    nombre,
    consigna,
    fecha,
    obligatoria,
    computaPromedio,
    esExamen,
  } = datos;

  const { rows } = await db.query(
    `INSERT INTO evaluaciones
       (tenant_id, grupo_id, tipo_evaluacion_id, periodo_academico_id,
        nombre, consigna, fecha, obligatoria, computa_promedio, es_examen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      tenantId,
      grupoId,
      tipoEvaluacionId,
      periodoAcademicoId,
      nombre,
      consigna || null,
      fecha || null,
      obligatoria,
      computaPromedio,
      esExamen,
    ]
  );
  return obtenerPorId(db, rows[0].id);
}

async function actualizar(db, id, datos) {
  const {
    tipoEvaluacionId,
    periodoAcademicoId,
    nombre,
    consigna,
    fecha,
    obligatoria,
    computaPromedio,
    esExamen,
  } = datos;

  const { rows } = await db.query(
    `UPDATE evaluaciones
     SET tipo_evaluacion_id = $1, periodo_academico_id = $2, nombre = $3,
         consigna = $4, fecha = $5, obligatoria = $6,
         computa_promedio = $7, es_examen = $8
     WHERE id = $9
     RETURNING id`,
    [
      tipoEvaluacionId,
      periodoAcademicoId,
      nombre,
      consigna || null,
      fecha || null,
      obligatoria,
      computaPromedio,
      esExamen,
      id,
    ]
  );
  return rows[0] ? obtenerPorId(db, id) : null;
}

// Se lleva los resultados con ella (CASCADE). El controlador avisa cuántos
// antes de que alguien lo confirme.
async function eliminar(db, id) {
  const { rowCount } = await db.query('DELETE FROM evaluaciones WHERE id = $1', [id]);
  return rowCount > 0;
}

/* ---------- la planilla ---------- */

/**
 * Todos los alumnos activos del grupo, con su resultado si lo tienen.
 * El LEFT JOIN es el punto: quien no tiene nota también aparece, porque es
 * justamente a quien hay que cargarle algo.
 */
async function listarResultados(db, evaluacionId) {
  const { rows } = await db.query(
    `SELECT
       i.id          AS inscripcion_id,
       a.id          AS alumno_id,
       a.apellido,
       a.nombre,
       r.id          AS resultado_id,
       r.resultado_numerico,
       r.resultado_texto,
       r.ausente,
       r.observaciones,
       evaluacion_aprobada(te.escala, te.configuracion,
                           r.resultado_numerico, r.resultado_texto, r.ausente) AS aprobada
     FROM evaluaciones e
     JOIN tipos_evaluacion te ON te.id = e.tipo_evaluacion_id
     JOIN inscripciones i ON i.grupo_id = e.grupo_id AND i.estado = 'activa'
     JOIN alumnos a ON a.id = i.alumno_id
     LEFT JOIN evaluacion_resultados r
            ON r.evaluacion_id = e.id AND r.inscripcion_id = i.id
     WHERE e.id = $1
     ORDER BY a.apellido, a.nombre`,
    [evaluacionId]
  );
  return rows;
}

function estaVacio(fila) {
  return (
    (fila.resultadoNumerico === null || fila.resultadoNumerico === undefined) &&
    !fila.resultadoTexto &&
    !fila.ausente &&
    !fila.observaciones
  );
}

/**
 * Guarda la planilla completa de una vez: así es como corrige una persona,
 * toda la clase junta, no alumno por alumno.
 *
 * Las filas que quedaron en blanco se borran: el profesor que limpia una
 * nota está diciendo "esto no lo cargué", y hay que distinguirlo de un cero.
 *
 * El JOIN contra `inscripciones` no es decorativo: sin él, una inscripción
 * de otro grupo de la misma academia entraría igual, y quedaría un resultado
 * cargado a un alumno que no cursa esa materia.
 */
async function guardarResultados(db, tenantId, evaluacionId, filas, usuarioId) {
  const aGuardar = filas.filter((f) => !estaVacio(f));
  const aBorrar = filas.filter(estaVacio).map((f) => f.inscripcionId);

  let guardados = 0;

  if (aGuardar.length > 0) {
    const { rowCount } = await db.query(
      `INSERT INTO evaluacion_resultados
         (tenant_id, evaluacion_id, inscripcion_id,
          resultado_numerico, resultado_texto, ausente, observaciones, cargado_por)
       SELECT $1, e.id, d.inscripcion_id, d.numero, d.texto, d.ausente, d.observaciones, $3
       FROM evaluaciones e
       JOIN unnest($4::int[], $5::numeric[], $6::text[], $7::boolean[], $8::text[])
            AS d(inscripcion_id, numero, texto, ausente, observaciones) ON true
       JOIN inscripciones i ON i.id = d.inscripcion_id AND i.grupo_id = e.grupo_id
       WHERE e.id = $2
       ON CONFLICT (evaluacion_id, inscripcion_id) DO UPDATE
         SET resultado_numerico = excluded.resultado_numerico,
             resultado_texto    = excluded.resultado_texto,
             ausente            = excluded.ausente,
             observaciones      = excluded.observaciones,
             cargado_por        = excluded.cargado_por`,
      [
        tenantId,
        evaluacionId,
        usuarioId,
        aGuardar.map((f) => f.inscripcionId),
        aGuardar.map((f) => (f.resultadoNumerico === undefined ? null : f.resultadoNumerico)),
        aGuardar.map((f) => f.resultadoTexto || null),
        aGuardar.map((f) => Boolean(f.ausente)),
        aGuardar.map((f) => f.observaciones || null),
      ]
    );
    guardados = rowCount;
  }

  let borrados = 0;

  if (aBorrar.length > 0) {
    const { rowCount } = await db.query(
      `DELETE FROM evaluacion_resultados
       WHERE evaluacion_id = $1 AND inscripcion_id = ANY($2::int[])`,
      [evaluacionId, aBorrar]
    );
    borrados = rowCount;
  }

  return { guardados, borrados, ignorados: aGuardar.length - guardados };
}

module.exports = {
  grupoAccesible,
  grupoDeEvaluacion,
  listarPorGrupo,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  listarResultados,
  guardarResultados,
};

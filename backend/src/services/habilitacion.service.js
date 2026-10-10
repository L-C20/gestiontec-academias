/**
 * Habilitación al examen.
 *
 * La regla: para rendir el examen de un período, el alumno tiene que tener
 * aprobadas todas las evaluaciones obligatorias de su grupo en ese período.
 * El examen mismo no cuenta (es aquello para lo que se habilita).
 *
 * Dos detalles que parecen chicos y cambian el resultado:
 *
 * 1. Se cuentan las obligatorias **del grupo**, no las que el alumno tiene
 *    cargadas. Una obligatoria que el profesor creó y nunca corrigió también
 *    frena: si contáramos solo los resultados cargados, el alumno aparecería
 *    habilitado porque le falta justamente la fila que lo frenaría.
 *
 * 2. Un período aparece en la lista si el grupo tiene obligatorias en él
 *    **o** si el alumno tiene una excepción. Sin esa segunda condición, una
 *    excepción cargada en un período todavía sin evaluaciones no se vería.
 */

// El alumno está habilitado si cumplió todo, o si alguien lo autorizó a mano.
// Una excepción sin obligatorias cargadas también habilita: ahí el motivo
// escrito es toda la justificación que hay.
const CAMPOS_HABILITACION = `
  pa.id                       AS periodo_academico_id,
  pa.nombre                   AS periodo,
  pa.fecha_inicio             AS periodo_inicio,
  count(e.id)::int            AS obligatorias,
  count(r.id) FILTER (
    WHERE evaluacion_aprobada(te.escala, te.configuracion,
                              r.resultado_numerico, r.resultado_texto, r.ausente)
  )::int                      AS aprobadas,
  coalesce(
    array_agg(e.nombre ORDER BY e.fecha NULLS LAST, e.id) FILTER (
      WHERE e.id IS NOT NULL
        AND NOT coalesce(
          evaluacion_aprobada(te.escala, te.configuracion,
                              r.resultado_numerico, r.resultado_texto, r.ausente),
          false
        )
    ),
    '{}'
  )                           AS adeuda,
  x.motivo                    AS excepcion_motivo,
  x.fecha                     AS excepcion_fecha,
  x.autorizado_por            AS excepcion_autorizado_por
`;

const DESDE_HABILITACION = `
  FROM periodos_candidatos pc
  JOIN periodos_academicos pa ON pa.id = pc.periodo_academico_id
  LEFT JOIN evaluaciones e
         ON e.grupo_id = pc.grupo_id
        AND e.periodo_academico_id = pa.id
        AND e.obligatoria
        AND NOT e.es_examen
  LEFT JOIN tipos_evaluacion te ON te.id = e.tipo_evaluacion_id
  LEFT JOIN evaluacion_resultados r
         ON r.evaluacion_id = e.id
        AND r.inscripcion_id = pc.inscripcion_id
  LEFT JOIN excepciones_examen x
         ON x.inscripcion_id = pc.inscripcion_id
        AND x.periodo_academico_id = pa.id
  GROUP BY pa.id, pa.nombre, pa.fecha_inicio,
           x.motivo, x.fecha, x.autorizado_por
  ORDER BY pa.fecha_inicio DESC, pa.id DESC
`;

// Los períodos que tienen algo que decir sobre esta inscripción.
const PERIODOS_CANDIDATOS = `
  WITH inscripcion AS (
    SELECT id, grupo_id FROM inscripciones WHERE id = $1
  ),
  periodos_candidatos AS (
    SELECT i.id AS inscripcion_id, i.grupo_id, e.periodo_academico_id
    FROM inscripcion i
    JOIN evaluaciones e
      ON e.grupo_id = i.grupo_id
     AND e.obligatoria
     AND NOT e.es_examen
    UNION
    SELECT i.id, i.grupo_id, x.periodo_academico_id
    FROM inscripcion i
    JOIN excepciones_examen x ON x.inscripcion_id = i.id
  )
`;

/**
 * Decide la habilitación a partir de los números crudos de un período.
 * Se resuelve acá y no en SQL para que la redacción y la regla queden
 * juntas: lo que se muestra tiene que explicar por qué.
 */
function interpretar(fila) {
  const obligatorias = fila.obligatorias;
  const aprobadas = fila.aprobadas;

  const cumplioTodo = obligatorias > 0 && aprobadas === obligatorias;
  const porExcepcion = !cumplioTodo && Boolean(fila.excepcion_motivo);

  return {
    periodoAcademicoId: fila.periodo_academico_id,
    periodo: fila.periodo,
    obligatorias,
    aprobadas,
    adeuda: fila.adeuda,
    habilitado: cumplioTodo || porExcepcion,
    porExcepcion,
    excepcion: fila.excepcion_motivo
      ? {
          motivo: fila.excepcion_motivo,
          fecha: fila.excepcion_fecha,
          autorizadoPor: fila.excepcion_autorizado_por,
        }
      : null,
  };
}

async function porInscripcion(db, inscripcionId) {
  const { rows } = await db.query(
    `${PERIODOS_CANDIDATOS} SELECT ${CAMPOS_HABILITACION} ${DESDE_HABILITACION}`,
    [inscripcionId]
  );
  return rows.map(interpretar);
}

/**
 * Lo mismo para todo un grupo, para la pantalla del profesor: una fila por
 * alumno inscripto, en un solo período.
 */
async function porGrupo(db, grupoId, periodoAcademicoId) {
  const { rows } = await db.query(
    `
    SELECT
      i.id          AS inscripcion_id,
      a.id          AS alumno_id,
      a.apellido,
      a.nombre,
      count(e.id)::int AS obligatorias,
      count(r.id) FILTER (
        WHERE evaluacion_aprobada(te.escala, te.configuracion,
                                  r.resultado_numerico, r.resultado_texto, r.ausente)
      )::int        AS aprobadas,
      coalesce(
        array_agg(e.nombre ORDER BY e.fecha NULLS LAST, e.id) FILTER (
          WHERE e.id IS NOT NULL
            AND NOT coalesce(
              evaluacion_aprobada(te.escala, te.configuracion,
                                  r.resultado_numerico, r.resultado_texto, r.ausente),
              false
            )
        ),
        '{}'
      )             AS adeuda,
      x.motivo      AS excepcion_motivo,
      x.fecha       AS excepcion_fecha,
      x.autorizado_por AS excepcion_autorizado_por
    FROM inscripciones i
    JOIN alumnos a ON a.id = i.alumno_id
    LEFT JOIN evaluaciones e
           ON e.grupo_id = i.grupo_id
          AND e.periodo_academico_id = $2
          AND e.obligatoria
          AND NOT e.es_examen
    LEFT JOIN tipos_evaluacion te ON te.id = e.tipo_evaluacion_id
    LEFT JOIN evaluacion_resultados r
           ON r.evaluacion_id = e.id
          AND r.inscripcion_id = i.id
    LEFT JOIN excepciones_examen x
           ON x.inscripcion_id = i.id
          AND x.periodo_academico_id = $2
    WHERE i.grupo_id = $1
      AND i.estado = 'activa'
    GROUP BY i.id, a.id, a.apellido, a.nombre,
             x.motivo, x.fecha, x.autorizado_por
    ORDER BY a.apellido, a.nombre
    `,
    [grupoId, periodoAcademicoId]
  );

  return rows.map((fila) => ({
    inscripcionId: fila.inscripcion_id,
    alumnoId: fila.alumno_id,
    apellido: fila.apellido,
    nombre: fila.nombre,
    ...interpretar({ ...fila, periodo_academico_id: Number(periodoAcademicoId), periodo: null }),
  }));
}

/* ---------- excepciones ---------- */

const CAMPOS_EXCEPCION =
  'id, inscripcion_id, periodo_academico_id, motivo, autorizado_por, fecha';

async function obtenerExcepcion(db, inscripcionId, periodoAcademicoId) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS_EXCEPCION} FROM excepciones_examen
     WHERE inscripcion_id = $1 AND periodo_academico_id = $2`,
    [inscripcionId, periodoAcademicoId]
  );
  return rows[0] || null;
}

async function guardarExcepcion(
  db,
  tenantId,
  { inscripcionId, periodoAcademicoId, motivo, autorizadoPor }
) {
  const { rows } = await db.query(
    `INSERT INTO excepciones_examen
       (tenant_id, inscripcion_id, periodo_academico_id, motivo, autorizado_por)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (inscripcion_id, periodo_academico_id) DO UPDATE
       SET motivo = excluded.motivo,
           autorizado_por = excluded.autorizado_por,
           fecha = current_date
     RETURNING ${CAMPOS_EXCEPCION}`,
    [tenantId, inscripcionId, periodoAcademicoId, motivo, autorizadoPor]
  );
  return rows[0];
}

async function quitarExcepcion(db, inscripcionId, periodoAcademicoId) {
  const { rowCount } = await db.query(
    `DELETE FROM excepciones_examen
     WHERE inscripcion_id = $1 AND periodo_academico_id = $2`,
    [inscripcionId, periodoAcademicoId]
  );
  return rowCount > 0;
}

module.exports = {
  porInscripcion,
  porGrupo,
  obtenerExcepcion,
  guardarExcepcion,
  quitarExcepcion,
};

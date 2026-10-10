const evaluacionesService = require('../../services/evaluaciones.service');
const { AppError } = require('../../utils/errors');

async function existe(db, tabla, id) {
  const { rows } = await db.query(`SELECT 1 FROM ${tabla} WHERE id = $1`, [id]);
  return rows.length > 0;
}

// Un profesor que pide un grupo ajeno recibe 403, no 404: el grupo existe,
// simplemente no es suyo. Mentirle sobre la existencia no protege nada y
// vuelve imposible de entender el error.
async function exigirAccesoAlGrupo(req, grupoId) {
  if (!(await evaluacionesService.grupoAccesible(req.db, grupoId, req.user))) {
    throw new AppError(403, 'Este grupo no está a tu cargo');
  }
}

async function validarDatos(req, grupoId) {
  const nombre = (req.body.nombre || '').trim();
  if (!nombre) throw new AppError(400, 'El nombre de la evaluación es obligatorio');

  const tipoEvaluacionId = Number(req.body.tipoEvaluacionId);
  const periodoAcademicoId = Number(req.body.periodoAcademicoId);

  if (!tipoEvaluacionId) throw new AppError(400, 'Elegí el tipo de evaluación');
  if (!periodoAcademicoId) throw new AppError(400, 'Elegí el período académico');

  if (!(await existe(req.db, 'tipos_evaluacion', tipoEvaluacionId))) {
    throw new AppError(404, 'El tipo de evaluación no existe');
  }
  if (!(await existe(req.db, 'periodos_academicos', periodoAcademicoId))) {
    throw new AppError(404, 'El período académico no existe');
  }

  const esExamen = Boolean(req.body.esExamen);

  // El examen no puede contarse entre los requisitos que habilitan a rendirlo.
  // Si se dejara marcar obligatoria, nadie quedaría habilitado nunca: le
  // faltaría siempre el examen que todavía no rindió.
  const obligatoria = esExamen ? false : req.body.obligatoria !== false;

  return {
    grupoId,
    tipoEvaluacionId,
    periodoAcademicoId,
    nombre,
    consigna: (req.body.consigna || '').trim() || null,
    fecha: req.body.fecha || null,
    obligatoria,
    computaPromedio: req.body.computaPromedio !== false,
    esExamen,
  };
}

async function listarPorGrupo(req, res, next) {
  try {
    const { grupoId } = req.params;
    if (!(await existe(req.db, 'grupos', grupoId))) {
      throw new AppError(404, 'Grupo no encontrado');
    }
    await exigirAccesoAlGrupo(req, grupoId);

    const evaluaciones = await evaluacionesService.listarPorGrupo(
      req.db,
      grupoId,
      req.query.periodoAcademicoId || null
    );
    res.json({ evaluaciones });
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const evaluacion = await evaluacionesService.obtenerPorId(req.db, req.params.id);
    if (!evaluacion) throw new AppError(404, 'Evaluación no encontrada');
    await exigirAccesoAlGrupo(req, evaluacion.grupo_id);
    res.json({ evaluacion });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { grupoId } = req.params;
    if (!(await existe(req.db, 'grupos', grupoId))) {
      throw new AppError(404, 'Grupo no encontrado');
    }
    await exigirAccesoAlGrupo(req, grupoId);

    const datos = await validarDatos(req, Number(grupoId));
    const evaluacion = await evaluacionesService.crear(req.db, req.user.tenantId, datos);
    res.status(201).json({ evaluacion });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const actual = await evaluacionesService.obtenerPorId(req.db, req.params.id);
    if (!actual) throw new AppError(404, 'Evaluación no encontrada');
    await exigirAccesoAlGrupo(req, actual.grupo_id);

    const datos = await validarDatos(req, actual.grupo_id);
    const evaluacion = await evaluacionesService.actualizar(req.db, req.params.id, datos);
    res.json({ evaluacion });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const actual = await evaluacionesService.obtenerPorId(req.db, req.params.id);
    if (!actual) throw new AppError(404, 'Evaluación no encontrada');
    await exigirAccesoAlGrupo(req, actual.grupo_id);

    await evaluacionesService.eliminar(req.db, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/* ---------- planilla de notas ---------- */

async function listarResultados(req, res, next) {
  try {
    const evaluacion = await evaluacionesService.obtenerPorId(req.db, req.params.id);
    if (!evaluacion) throw new AppError(404, 'Evaluación no encontrada');
    await exigirAccesoAlGrupo(req, evaluacion.grupo_id);

    const resultados = await evaluacionesService.listarResultados(req.db, req.params.id);
    res.json({ evaluacion, resultados });
  } catch (err) {
    next(err);
  }
}

function validarFilas(cuerpo) {
  if (!Array.isArray(cuerpo.resultados)) {
    throw new AppError(400, 'Esperaba una lista de resultados');
  }

  return cuerpo.resultados.map((fila, indice) => {
    const inscripcionId = Number(fila.inscripcionId);
    if (!inscripcionId) {
      throw new AppError(400, `Falta la inscripción en la fila ${indice + 1}`);
    }

    let resultadoNumerico = null;
    if (fila.resultadoNumerico !== null && fila.resultadoNumerico !== undefined && fila.resultadoNumerico !== '') {
      resultadoNumerico = Number(fila.resultadoNumerico);
      if (!Number.isFinite(resultadoNumerico)) {
        throw new AppError(400, `La nota de la fila ${indice + 1} no es un número`);
      }
      if (resultadoNumerico < 0) {
        throw new AppError(400, `La nota de la fila ${indice + 1} no puede ser negativa`);
      }
    }

    return {
      inscripcionId,
      resultadoNumerico,
      resultadoTexto: (fila.resultadoTexto || '').trim() || null,
      ausente: Boolean(fila.ausente),
      observaciones: (fila.observaciones || '').trim() || null,
    };
  });
}

async function guardarResultados(req, res, next) {
  try {
    const evaluacion = await evaluacionesService.obtenerPorId(req.db, req.params.id);
    if (!evaluacion) throw new AppError(404, 'Evaluación no encontrada');
    await exigirAccesoAlGrupo(req, evaluacion.grupo_id);

    const filas = validarFilas(req.body);

    const resumen = await evaluacionesService.guardarResultados(
      req.db,
      req.user.tenantId,
      req.params.id,
      filas,
      req.user.userId
    );

    // Si alguna fila no entró es porque esa inscripción no pertenece al grupo
    // de la evaluación. Cortar acá no deja un guardado a medias: el
    // middleware de tenant abre una transacción por request y hace ROLLBACK
    // con cualquier status >= 400, así que las filas que sí entraron se
    // deshacen y la planilla queda como estaba.
    if (resumen.ignorados > 0) {
      throw new AppError(
        400,
        `${resumen.ignorados} alumno(s) no pertenecen al grupo de esta evaluación`
      );
    }

    const resultados = await evaluacionesService.listarResultados(req.db, req.params.id);
    res.json({ resumen, resultados });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarPorGrupo,
  obtener,
  crear,
  actualizar,
  eliminar,
  listarResultados,
  guardarResultados,
};

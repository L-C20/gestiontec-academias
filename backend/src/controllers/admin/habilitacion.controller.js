const habilitacionService = require('../../services/habilitacion.service');
const evaluacionesService = require('../../services/evaluaciones.service');
const { AppError } = require('../../utils/errors');

async function existe(db, tabla, id) {
  const { rows } = await db.query(`SELECT 1 FROM ${tabla} WHERE id = $1`, [id]);
  return rows.length > 0;
}

async function grupoDeInscripcion(db, inscripcionId) {
  const { rows } = await db.query('SELECT grupo_id FROM inscripciones WHERE id = $1', [
    inscripcionId,
  ]);
  return rows[0] ? rows[0].grupo_id : null;
}

async function exigirAccesoAlGrupo(req, grupoId) {
  if (!(await evaluacionesService.grupoAccesible(req.db, grupoId, req.user))) {
    throw new AppError(403, 'Este grupo no está a tu cargo');
  }
}

/** La lista del grupo en un período: lo que mira el profesor antes del examen. */
async function porGrupo(req, res, next) {
  try {
    const { grupoId } = req.params;
    const periodoAcademicoId = Number(req.query.periodoAcademicoId);

    if (!periodoAcademicoId) {
      throw new AppError(400, 'Indicá el período académico');
    }
    if (!(await existe(req.db, 'grupos', grupoId))) {
      throw new AppError(404, 'Grupo no encontrado');
    }
    if (!(await existe(req.db, 'periodos_academicos', periodoAcademicoId))) {
      throw new AppError(404, 'El período académico no existe');
    }
    await exigirAccesoAlGrupo(req, grupoId);

    const alumnos = await habilitacionService.porGrupo(req.db, grupoId, periodoAcademicoId);
    res.json({ alumnos });
  } catch (err) {
    next(err);
  }
}

/** Todos los períodos de un alumno en su grupo. */
async function porInscripcion(req, res, next) {
  try {
    const { inscripcionId } = req.params;
    const grupoId = await grupoDeInscripcion(req.db, inscripcionId);
    if (!grupoId) throw new AppError(404, 'Inscripción no encontrada');
    await exigirAccesoAlGrupo(req, grupoId);

    const periodos = await habilitacionService.porInscripcion(req.db, inscripcionId);
    res.json({ periodos });
  } catch (err) {
    next(err);
  }
}

/**
 * Habilita a mano a quien no cumple los requisitos.
 *
 * Queda reservado a administración, y no al profesor, porque es una dispensa:
 * saltea la regla que el propio profesor aplica. El motivo es obligatorio y
 * queda firmado con quién lo autorizó, que es lo único que permite revisar
 * la decisión después.
 */
async function guardarExcepcion(req, res, next) {
  try {
    const { inscripcionId } = req.params;
    const periodoAcademicoId = Number(req.body.periodoAcademicoId);
    const motivo = (req.body.motivo || '').trim();

    if (!periodoAcademicoId) throw new AppError(400, 'Indicá el período académico');
    if (!motivo) throw new AppError(400, 'El motivo de la excepción es obligatorio');

    if (!(await existe(req.db, 'inscripciones', inscripcionId))) {
      throw new AppError(404, 'Inscripción no encontrada');
    }
    if (!(await existe(req.db, 'periodos_academicos', periodoAcademicoId))) {
      throw new AppError(404, 'El período académico no existe');
    }

    const excepcion = await habilitacionService.guardarExcepcion(req.db, req.user.tenantId, {
      inscripcionId,
      periodoAcademicoId,
      motivo,
      autorizadoPor: req.user.userId,
    });

    res.json({ excepcion });
  } catch (err) {
    next(err);
  }
}

async function quitarExcepcion(req, res, next) {
  try {
    const { inscripcionId } = req.params;
    const periodoAcademicoId = Number(req.query.periodoAcademicoId);

    if (!periodoAcademicoId) throw new AppError(400, 'Indicá el período académico');

    const quitada = await habilitacionService.quitarExcepcion(
      req.db,
      inscripcionId,
      periodoAcademicoId
    );
    if (!quitada) throw new AppError(404, 'No había una excepción cargada para ese período');

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { porGrupo, porInscripcion, guardarExcepcion, quitarExcepcion };

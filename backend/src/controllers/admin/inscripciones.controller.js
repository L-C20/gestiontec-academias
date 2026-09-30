const inscripcionesService = require('../../services/inscripciones.service');
const { AppError } = require('../../utils/errors');

async function listar(req, res, next) {
  try {
    const { alumnoId, grupoId } = req.query;
    let inscripciones;
    if (alumnoId) {
      inscripciones = await inscripcionesService.listarPorAlumno(req.db, alumnoId);
    } else if (grupoId) {
      inscripciones = await inscripcionesService.listarPorGrupo(req.db, grupoId);
    } else {
      inscripciones = await inscripcionesService.listar(req.db);
    }
    res.json({ inscripciones });
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const inscripcion = await inscripcionesService.obtenerPorId(req.db, req.params.id);
    if (!inscripcion) throw new AppError(404, 'Inscripción no encontrada');
    res.json({ inscripcion });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { alumnoId, grupoId } = req.body;
    if (!alumnoId) throw new AppError(400, 'El alumno es obligatorio');
    if (!grupoId) throw new AppError(400, 'El grupo es obligatorio');

    if (!(await inscripcionesService.existeAlumno(req.db, alumnoId))) {
      throw new AppError(400, 'El alumno indicado no existe');
    }
    const grupo = await inscripcionesService.obtenerGrupo(req.db, grupoId);
    if (!grupo) throw new AppError(400, 'El grupo indicado no existe');

    if (await inscripcionesService.existeInscripcionActiva(req.db, alumnoId, grupoId)) {
      throw new AppError(409, 'El alumno ya está inscripto en este grupo');
    }

    if (grupo.capacidad !== null) {
      const activas = await inscripcionesService.contarActivasPorGrupo(req.db, grupoId);
      if (activas >= grupo.capacidad) {
        throw new AppError(409, 'El grupo alcanzó su capacidad máxima');
      }
    }

    const inscripcion = await inscripcionesService.crear(req.db, req.user.tenantId, {
      alumnoId,
      grupoId,
    });
    res.status(201).json({ inscripcion });
  } catch (err) {
    next(err);
  }
}

async function finalizar(req, res, next) {
  try {
    const inscripcion = await inscripcionesService.cambiarEstado(req.db, req.params.id, 'finalizada');
    if (!inscripcion) throw new AppError(404, 'Inscripción no encontrada');
    res.json({ inscripcion });
  } catch (err) {
    next(err);
  }
}

async function cancelar(req, res, next) {
  try {
    const inscripcion = await inscripcionesService.cambiarEstado(req.db, req.params.id, 'cancelada');
    if (!inscripcion) throw new AppError(404, 'Inscripción no encontrada');
    res.json({ inscripcion });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, finalizar, cancelar };

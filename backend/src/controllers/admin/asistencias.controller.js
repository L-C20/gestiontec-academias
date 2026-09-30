const asistenciasService = require('../../services/asistencias.service');
const { AppError } = require('../../utils/errors');

const ESTADOS_VALIDOS = ['presente', 'ausente', 'justificado'];

async function listarPorInscripcion(req, res, next) {
  try {
    const { inscripcionId } = req.params;
    if (!(await asistenciasService.obtenerInscripcion(req.db, inscripcionId))) {
      throw new AppError(404, 'Inscripción no encontrada');
    }
    const asistencias = await asistenciasService.listarPorInscripcion(req.db, inscripcionId);
    res.json({ asistencias });
  } catch (err) {
    next(err);
  }
}

async function resumenPorInscripcion(req, res, next) {
  try {
    const { inscripcionId } = req.params;
    if (!(await asistenciasService.obtenerInscripcion(req.db, inscripcionId))) {
      throw new AppError(404, 'Inscripción no encontrada');
    }
    const resumen = await asistenciasService.resumenPorInscripcion(req.db, inscripcionId);
    res.json({ resumen });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { inscripcionId } = req.params;
    const { fecha, estado, observaciones } = req.body;

    if (!fecha) throw new AppError(400, 'La fecha es obligatoria');
    if (!ESTADOS_VALIDOS.includes(estado)) {
      throw new AppError(400, `El estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`);
    }

    const inscripcion = await asistenciasService.obtenerInscripcion(req.db, inscripcionId);
    if (!inscripcion) throw new AppError(404, 'Inscripción no encontrada');
    if (inscripcion.estado !== 'activa') {
      throw new AppError(400, 'No se puede registrar asistencia sobre una inscripción que no está activa');
    }

    const asistencia = await asistenciasService.crear(req.db, req.user.tenantId, {
      inscripcionId,
      fecha,
      estado,
      observaciones,
    });
    res.status(201).json({ asistencia });
  } catch (err) {
    if (err.code === '23505') {
      return next(new AppError(409, 'Ya se registró la asistencia de esta inscripción para esa fecha'));
    }
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { estado, observaciones } = req.body;
    if (!ESTADOS_VALIDOS.includes(estado)) {
      throw new AppError(400, `El estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`);
    }
    const asistencia = await asistenciasService.actualizar(req.db, req.params.id, { estado, observaciones });
    if (!asistencia) throw new AppError(404, 'Registro de asistencia no encontrado');
    res.json({ asistencia });
  } catch (err) {
    next(err);
  }
}

module.exports = { listarPorInscripcion, resumenPorInscripcion, crear, actualizar };

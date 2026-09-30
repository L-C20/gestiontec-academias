const profesoresService = require('../../services/profesores.service');
const { AppError } = require('../../utils/errors');

async function listar(req, res, next) {
  try {
    const profesores = await profesoresService.listar(req.db);
    res.json({ profesores });
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const profesor = await profesoresService.obtenerPorId(req.db, req.params.id);
    if (!profesor) throw new AppError(404, 'Profesor no encontrado');
    res.json({ profesor });
  } catch (err) {
    next(err);
  }
}

function validarDatos({ nombre, apellido }) {
  if (!nombre || !nombre.trim()) throw new AppError(400, 'El nombre es obligatorio');
  if (!apellido || !apellido.trim()) throw new AppError(400, 'El apellido es obligatorio');
}

async function crear(req, res, next) {
  try {
    validarDatos(req.body);
    const profesor = await profesoresService.crear(req.db, req.user.tenantId, req.body);
    res.status(201).json({ profesor });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    validarDatos(req.body);
    const profesor = await profesoresService.actualizar(req.db, req.params.id, req.body);
    if (!profesor) throw new AppError(404, 'Profesor no encontrado');
    res.json({ profesor });
  } catch (err) {
    next(err);
  }
}

async function desactivar(req, res, next) {
  try {
    const profesor = await profesoresService.cambiarEstado(req.db, req.params.id, 'inactivo');
    if (!profesor) throw new AppError(404, 'Profesor no encontrado');
    res.json({ profesor });
  } catch (err) {
    next(err);
  }
}

async function reactivar(req, res, next) {
  try {
    const profesor = await profesoresService.cambiarEstado(req.db, req.params.id, 'activo');
    if (!profesor) throw new AppError(404, 'Profesor no encontrado');
    res.json({ profesor });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar, reactivar };

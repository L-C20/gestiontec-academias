const alumnosService = require('../../services/alumnos.service');
const { AppError } = require('../../utils/errors');

async function listar(req, res, next) {
  try {
    const { q } = req.query;
    const alumnos = q ? await alumnosService.buscar(req.db, q) : await alumnosService.listar(req.db);
    res.json({ alumnos });
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const alumno = await alumnosService.obtenerPorId(req.db, req.params.id);
    if (!alumno) throw new AppError(404, 'Alumno no encontrado');
    res.json({ alumno });
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
    const alumno = await alumnosService.crear(req.db, req.user.tenantId, req.body);
    res.status(201).json({ alumno });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    validarDatos(req.body);
    const alumno = await alumnosService.actualizar(req.db, req.params.id, req.body);
    if (!alumno) throw new AppError(404, 'Alumno no encontrado');
    res.json({ alumno });
  } catch (err) {
    next(err);
  }
}

async function desactivar(req, res, next) {
  try {
    const alumno = await alumnosService.cambiarEstado(req.db, req.params.id, 'inactivo');
    if (!alumno) throw new AppError(404, 'Alumno no encontrado');
    res.json({ alumno });
  } catch (err) {
    next(err);
  }
}

async function reactivar(req, res, next) {
  try {
    const alumno = await alumnosService.cambiarEstado(req.db, req.params.id, 'activo');
    if (!alumno) throw new AppError(404, 'Alumno no encontrado');
    res.json({ alumno });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar, reactivar };

const disciplinasService = require('../../services/disciplinas.service');
const { AppError } = require('../../utils/errors');

async function listar(req, res, next) {
  try {
    const disciplinas = await disciplinasService.listar(req.db);
    res.json({ disciplinas });
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const disciplina = await disciplinasService.obtenerPorId(req.db, req.params.id);
    if (!disciplina) throw new AppError(404, 'Disciplina no encontrada');
    res.json({ disciplina });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre || !nombre.trim()) {
      throw new AppError(400, 'El nombre es obligatorio');
    }
    const disciplina = await disciplinasService.crear(req.db, req.user.tenantId, {
      nombre: nombre.trim(),
      descripcion,
    });
    res.status(201).json({ disciplina });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre || !nombre.trim()) {
      throw new AppError(400, 'El nombre es obligatorio');
    }
    const disciplina = await disciplinasService.actualizar(req.db, req.params.id, {
      nombre: nombre.trim(),
      descripcion,
    });
    if (!disciplina) throw new AppError(404, 'Disciplina no encontrada');
    res.json({ disciplina });
  } catch (err) {
    next(err);
  }
}

async function desactivar(req, res, next) {
  try {
    const disciplina = await disciplinasService.cambiarEstado(req.db, req.params.id, 'inactivo');
    if (!disciplina) throw new AppError(404, 'Disciplina no encontrada');
    res.json({ disciplina });
  } catch (err) {
    next(err);
  }
}

async function reactivar(req, res, next) {
  try {
    const disciplina = await disciplinasService.cambiarEstado(req.db, req.params.id, 'activo');
    if (!disciplina) throw new AppError(404, 'Disciplina no encontrada');
    res.json({ disciplina });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar, reactivar };

const nivelesService = require('../../services/niveles.service');
const { AppError } = require('../../utils/errors');

async function listar(req, res, next) {
  try {
    const niveles = await nivelesService.listar(req.db);
    res.json({ niveles });
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const nivel = await nivelesService.obtenerPorId(req.db, req.params.id);
    if (!nivel) throw new AppError(404, 'Nivel no encontrado');
    res.json({ nivel });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, orden } = req.body;
    if (!nombre || !nombre.trim()) {
      throw new AppError(400, 'El nombre es obligatorio');
    }
    const nivel = await nivelesService.crear(req.db, req.user.tenantId, {
      nombre: nombre.trim(),
      orden,
    });
    res.status(201).json({ nivel });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, orden } = req.body;
    if (!nombre || !nombre.trim()) {
      throw new AppError(400, 'El nombre es obligatorio');
    }
    const nivel = await nivelesService.actualizar(req.db, req.params.id, {
      nombre: nombre.trim(),
      orden,
    });
    if (!nivel) throw new AppError(404, 'Nivel no encontrado');
    res.json({ nivel });
  } catch (err) {
    next(err);
  }
}

async function desactivar(req, res, next) {
  try {
    const nivel = await nivelesService.cambiarEstado(req.db, req.params.id, 'inactivo');
    if (!nivel) throw new AppError(404, 'Nivel no encontrado');
    res.json({ nivel });
  } catch (err) {
    next(err);
  }
}

async function reactivar(req, res, next) {
  try {
    const nivel = await nivelesService.cambiarEstado(req.db, req.params.id, 'activo');
    if (!nivel) throw new AppError(404, 'Nivel no encontrado');
    res.json({ nivel });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar, reactivar };

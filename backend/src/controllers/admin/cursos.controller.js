const cursosService = require('../../services/cursos.service');
const { AppError } = require('../../utils/errors');

async function listar(req, res, next) {
  try {
    const cursos = await cursosService.listar(req.db);
    res.json({ cursos });
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const curso = await cursosService.obtenerPorId(req.db, req.params.id);
    if (!curso) throw new AppError(404, 'Curso no encontrado');
    res.json({ curso });
  } catch (err) {
    next(err);
  }
}

async function validarDatos(req) {
  const { nombre, disciplinaId } = req.body;
  if (!nombre || !nombre.trim()) {
    throw new AppError(400, 'El nombre es obligatorio');
  }
  if (!disciplinaId) {
    throw new AppError(400, 'La disciplina es obligatoria');
  }
  const disciplinaValida = await cursosService.existeDisciplina(req.db, disciplinaId);
  if (!disciplinaValida) {
    throw new AppError(400, 'La disciplina indicada no existe');
  }
}

async function crear(req, res, next) {
  try {
    await validarDatos(req);
    const { nombre, descripcion, disciplinaId } = req.body;
    const curso = await cursosService.crear(req.db, req.user.tenantId, {
      nombre: nombre.trim(),
      descripcion,
      disciplinaId,
    });
    res.status(201).json({ curso });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    await validarDatos(req);
    const { nombre, descripcion, disciplinaId } = req.body;
    const curso = await cursosService.actualizar(req.db, req.params.id, {
      nombre: nombre.trim(),
      descripcion,
      disciplinaId,
    });
    if (!curso) throw new AppError(404, 'Curso no encontrado');
    res.json({ curso });
  } catch (err) {
    next(err);
  }
}

async function desactivar(req, res, next) {
  try {
    const curso = await cursosService.cambiarEstado(req.db, req.params.id, 'inactivo');
    if (!curso) throw new AppError(404, 'Curso no encontrado');
    res.json({ curso });
  } catch (err) {
    next(err);
  }
}

async function reactivar(req, res, next) {
  try {
    const curso = await cursosService.cambiarEstado(req.db, req.params.id, 'activo');
    if (!curso) throw new AppError(404, 'Curso no encontrado');
    res.json({ curso });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar, reactivar };

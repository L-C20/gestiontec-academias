const gruposService = require('../../services/grupos.service');
const { AppError } = require('../../utils/errors');

async function listar(req, res, next) {
  try {
    const grupos = await gruposService.listar(req.db);
    res.json({ grupos });
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const grupo = await gruposService.obtenerPorId(req.db, req.params.id);
    if (!grupo) throw new AppError(404, 'Grupo no encontrado');
    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}

async function validarDatos(req) {
  const { nombre, disciplinaId, cursoId, nivelId, profesorId, periodoAcademicoId } = req.body;
  const db = req.db;

  if (!nombre || !nombre.trim()) throw new AppError(400, 'El nombre es obligatorio');
  if (!disciplinaId) throw new AppError(400, 'La disciplina es obligatoria');
  if (!cursoId) throw new AppError(400, 'El curso es obligatorio');
  if (!periodoAcademicoId) throw new AppError(400, 'El período académico es obligatorio');

  if (!(await gruposService.existeDisciplina(db, disciplinaId))) {
    throw new AppError(400, 'La disciplina indicada no existe');
  }
  if (!(await gruposService.cursoPerteneceADisciplina(db, cursoId, disciplinaId))) {
    throw new AppError(400, 'El curso indicado no existe o no pertenece a esa disciplina');
  }
  if (nivelId && !(await gruposService.existeNivel(db, nivelId))) {
    throw new AppError(400, 'El nivel indicado no existe');
  }
  if (profesorId && !(await gruposService.existeProfesor(db, profesorId))) {
    throw new AppError(400, 'El profesor indicado no existe');
  }
  if (!(await gruposService.existePeriodo(db, periodoAcademicoId))) {
    throw new AppError(400, 'El período académico indicado no existe');
  }
}

async function crear(req, res, next) {
  try {
    await validarDatos(req);
    const grupo = await gruposService.crear(req.db, req.user.tenantId, req.body);
    res.status(201).json({ grupo });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    await validarDatos(req);
    const grupo = await gruposService.actualizar(req.db, req.params.id, req.body);
    if (!grupo) throw new AppError(404, 'Grupo no encontrado');
    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}

async function desactivar(req, res, next) {
  try {
    const grupo = await gruposService.cambiarEstado(req.db, req.params.id, 'inactivo');
    if (!grupo) throw new AppError(404, 'Grupo no encontrado');
    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}

async function reactivar(req, res, next) {
  try {
    const grupo = await gruposService.cambiarEstado(req.db, req.params.id, 'activo');
    if (!grupo) throw new AppError(404, 'Grupo no encontrado');
    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar, reactivar };

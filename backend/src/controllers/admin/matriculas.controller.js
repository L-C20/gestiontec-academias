const matriculasService = require('../../services/matriculas.service');
const { AppError } = require('../../utils/errors');

async function listar(req, res, next) {
  try {
    const { alumnoId } = req.query;
    const matriculas = alumnoId
      ? await matriculasService.listarPorAlumno(req.db, alumnoId)
      : await matriculasService.listar(req.db);
    res.json({ matriculas });
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const matricula = await matriculasService.obtenerPorId(req.db, req.params.id);
    if (!matricula) throw new AppError(404, 'Matrícula no encontrada');
    res.json({ matricula });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { alumnoId, periodoAcademicoId, numeroMatricula, observaciones } = req.body;

    if (!alumnoId) throw new AppError(400, 'El alumno es obligatorio');
    if (!periodoAcademicoId) throw new AppError(400, 'El período académico es obligatorio');
    if (!numeroMatricula || !numeroMatricula.trim()) {
      throw new AppError(400, 'El número de matrícula es obligatorio');
    }
    if (!(await matriculasService.existeAlumno(req.db, alumnoId))) {
      throw new AppError(400, 'El alumno indicado no existe');
    }
    if (!(await matriculasService.existePeriodo(req.db, periodoAcademicoId))) {
      throw new AppError(400, 'El período académico indicado no existe');
    }

    const matricula = await matriculasService.crear(req.db, req.user.tenantId, {
      alumnoId,
      periodoAcademicoId,
      numeroMatricula: numeroMatricula.trim(),
      observaciones,
    });
    res.status(201).json({ matricula });
  } catch (err) {
    if (err.code === '23505') {
      return next(new AppError(409, 'Ya existe una matrícula con ese número'));
    }
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const matricula = await matriculasService.actualizarObservaciones(
      req.db,
      req.params.id,
      req.body.observaciones
    );
    if (!matricula) throw new AppError(404, 'Matrícula no encontrada');
    res.json({ matricula });
  } catch (err) {
    next(err);
  }
}

async function darDeBaja(req, res, next) {
  try {
    const matricula = await matriculasService.darDeBaja(req.db, req.params.id);
    if (!matricula) throw new AppError(404, 'Matrícula no encontrada');
    res.json({ matricula });
  } catch (err) {
    next(err);
  }
}

async function reactivar(req, res, next) {
  try {
    const matricula = await matriculasService.reactivar(req.db, req.params.id);
    if (!matricula) throw new AppError(404, 'Matrícula no encontrada');
    res.json({ matricula });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, darDeBaja, reactivar };

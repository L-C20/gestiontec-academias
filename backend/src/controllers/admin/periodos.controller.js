const periodosService = require('../../services/periodos.service');
const { AppError } = require('../../utils/errors');

async function listar(req, res, next) {
  try {
    const periodos = await periodosService.listar(req.db);
    res.json({ periodos });
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const periodo = await periodosService.obtenerPorId(req.db, req.params.id);
    if (!periodo) throw new AppError(404, 'Período académico no encontrado');
    res.json({ periodo });
  } catch (err) {
    next(err);
  }
}

function validarDatos({ nombre, fechaInicio, fechaFin }) {
  if (!nombre || !nombre.trim()) throw new AppError(400, 'El nombre es obligatorio');
  if (!fechaInicio || !fechaFin) throw new AppError(400, 'Las fechas de inicio y fin son obligatorias');
  if (new Date(fechaFin) <= new Date(fechaInicio)) {
    throw new AppError(400, 'La fecha de fin debe ser posterior a la fecha de inicio');
  }
}

async function crear(req, res, next) {
  try {
    validarDatos(req.body);
    const periodo = await periodosService.crear(req.db, req.user.tenantId, req.body);
    res.status(201).json({ periodo });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    validarDatos(req.body);
    const periodo = await periodosService.actualizar(req.db, req.params.id, req.body);
    if (!periodo) throw new AppError(404, 'Período académico no encontrado');
    res.json({ periodo });
  } catch (err) {
    next(err);
  }
}

async function desactivar(req, res, next) {
  try {
    const periodo = await periodosService.cambiarActivo(req.db, req.params.id, false);
    if (!periodo) throw new AppError(404, 'Período académico no encontrado');
    res.json({ periodo });
  } catch (err) {
    next(err);
  }
}

async function reactivar(req, res, next) {
  try {
    const periodo = await periodosService.cambiarActivo(req.db, req.params.id, true);
    if (!periodo) throw new AppError(404, 'Período académico no encontrado');
    res.json({ periodo });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar, reactivar };

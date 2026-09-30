const horariosService = require('../../services/horarios.service');
const { AppError } = require('../../utils/errors');

function validarHorario({ diaSemana, horaInicio, horaFin }) {
  if (diaSemana === undefined || diaSemana === null || diaSemana < 0 || diaSemana > 6) {
    throw new AppError(400, 'El día de la semana debe ser un número entre 0 (domingo) y 6 (sábado)');
  }
  if (!horaInicio || !horaFin) {
    throw new AppError(400, 'La hora de inicio y de fin son obligatorias');
  }
  if (horaInicio >= horaFin) {
    throw new AppError(400, 'La hora de fin debe ser posterior a la hora de inicio');
  }
}

async function listarPorGrupo(req, res, next) {
  try {
    const { grupoId } = req.params;
    if (!(await horariosService.existeGrupo(req.db, grupoId))) {
      throw new AppError(404, 'Grupo no encontrado');
    }
    const horarios = await horariosService.listarPorGrupo(req.db, grupoId);
    res.json({ horarios });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { grupoId } = req.params;
    const { diaSemana, horaInicio, horaFin, aula } = req.body;

    if (!(await horariosService.existeGrupo(req.db, grupoId))) {
      throw new AppError(404, 'Grupo no encontrado');
    }
    validarHorario(req.body);

    const conflicto = await horariosService.buscarConflictoProfesor(req.db, {
      grupoId,
      diaSemana,
      horaInicio,
      horaFin,
    });
    if (conflicto) {
      throw new AppError(
        409,
        `El profesor ya tiene una clase en ese horario (grupo "${conflicto.grupo_nombre}")`
      );
    }

    const horario = await horariosService.crear(req.db, req.user.tenantId, {
      grupoId,
      diaSemana,
      horaInicio,
      horaFin,
      aula,
    });
    res.status(201).json({ horario });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const horarioActual = await horariosService.obtenerPorId(req.db, id);
    if (!horarioActual) throw new AppError(404, 'Horario no encontrado');

    const { diaSemana, horaInicio, horaFin, aula } = req.body;
    validarHorario(req.body);

    const conflicto = await horariosService.buscarConflictoProfesor(req.db, {
      grupoId: horarioActual.grupo_id,
      diaSemana,
      horaInicio,
      horaFin,
      excluirHorarioId: id,
    });
    if (conflicto) {
      throw new AppError(
        409,
        `El profesor ya tiene una clase en ese horario (grupo "${conflicto.grupo_nombre}")`
      );
    }

    const horario = await horariosService.actualizar(req.db, id, { diaSemana, horaInicio, horaFin, aula });
    res.json({ horario });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const eliminado = await horariosService.eliminar(req.db, req.params.id);
    if (!eliminado) throw new AppError(404, 'Horario no encontrado');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { listarPorGrupo, crear, actualizar, eliminar };

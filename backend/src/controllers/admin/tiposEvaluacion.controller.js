const tiposService = require('../../services/tiposEvaluacion.service');
const { AppError } = require('../../utils/errors');

/**
 * Normaliza y valida la configuración de la escala.
 *
 * Se guarda solo lo que corresponde a la escala elegida: si alguien cambia
 * de "numerica_10" a "aprobado_no_aprobado", el umbral numérico viejo no
 * queda dando vueltas en el jsonb para confundir a la función de aprobación.
 */
function normalizarConfiguracion(escala, configuracion) {
  const entrada = configuracion || {};

  if (tiposService.esNumerica(escala)) {
    if (entrada.nota_aprobacion === undefined || entrada.nota_aprobacion === null || entrada.nota_aprobacion === '') {
      return null; // la función de la base aplica su valor por defecto
    }

    const umbral = Number(entrada.nota_aprobacion);
    if (!Number.isFinite(umbral) || umbral < 0) {
      throw new AppError(400, 'La nota de aprobación tiene que ser un número positivo');
    }
    return { nota_aprobacion: umbral };
  }

  if (entrada.valores_aprobados === undefined || entrada.valores_aprobados === null) {
    return null; // por defecto se aprueba con "Aprobado"
  }

  if (!Array.isArray(entrada.valores_aprobados)) {
    throw new AppError(400, 'Los valores aprobados tienen que venir como lista');
  }

  const valores = entrada.valores_aprobados
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);

  if (valores.length === 0) {
    throw new AppError(400, 'Indicá al menos un valor que cuente como aprobado');
  }

  return { valores_aprobados: valores };
}

function validarDatos(body) {
  const nombre = (body.nombre || '').trim();
  if (!nombre) throw new AppError(400, 'El nombre es obligatorio');

  if (!tiposService.ESCALAS.includes(body.escala)) {
    throw new AppError(400, `La escala debe ser una de: ${tiposService.ESCALAS.join(', ')}`);
  }

  return {
    nombre,
    escala: body.escala,
    configuracion: normalizarConfiguracion(body.escala, body.configuracion),
  };
}

async function listar(req, res, next) {
  try {
    const tipos = await tiposService.listar(req.db);
    res.json({ tipos, escalas: tiposService.ESCALAS });
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    const tipo = await tiposService.obtenerPorId(req.db, req.params.id);
    if (!tipo) throw new AppError(404, 'Tipo de evaluación no encontrado');
    res.json({ tipo });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const datos = validarDatos(req.body);
    const tipo = await tiposService.crear(req.db, req.user.tenantId, datos);
    res.status(201).json({ tipo });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const datos = validarDatos(req.body);
    const tipo = await tiposService.actualizar(req.db, req.params.id, datos);
    if (!tipo) throw new AppError(404, 'Tipo de evaluación no encontrado');
    res.json({ tipo });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const usos = await tiposService.enUso(req.db, req.params.id);
    if (usos > 0) {
      throw new AppError(
        409,
        `No se puede borrar: hay ${usos} evaluación(es) usando este tipo. Cambialas de tipo primero.`
      );
    }

    if (!(await tiposService.eliminar(req.db, req.params.id))) {
      throw new AppError(404, 'Tipo de evaluación no encontrado');
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar };

const planService = require('../services/plan.service');
const { AppError } = require('../utils/errors');

// Deben usarse siempre después de auth + tenant (necesitan req.db y req.user).

function requireSuscripcionActiva() {
  return async (req, res, next) => {
    try {
      const suscripcion = await planService.getSuscripcionActiva(req.db, req.user.tenantId);
      if (!suscripcion || ['suspendido', 'cancelado'].includes(suscripcion.estado)) {
        return next(new AppError(402, 'La suscripción de la academia no está activa'));
      }
      req.suscripcion = suscripcion;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Uso: router.post('/evaluaciones', auth, tenant, requireFeature('evaluaciones'), controller)
function requireFeature(claveFuncionalidad) {
  return async (req, res, next) => {
    try {
      const habilitada = await planService.hasFeature(req.db, req.user.tenantId, claveFuncionalidad);
      if (!habilitada) {
        return next(new AppError(403, `Tu plan no incluye esta funcionalidad: ${claveFuncionalidad}`));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Uso: router.post('/alumnos', auth, tenant,
//   enforceLimit('max_alumnos', (req) => req.db.query('SELECT count(*) FROM alumnos').then(r => Number(r.rows[0].count))),
//   controller)
function enforceLimit(claveLimite, contarActualFn) {
  return async (req, res, next) => {
    try {
      const limite = await planService.getLimite(req.db, req.user.tenantId, claveLimite);
      if (limite === null) return next(); // sin límite práctico
      const actual = await contarActualFn(req);
      if (actual >= limite) {
        return next(
          new AppError(403, `Se alcanzó el límite de tu plan para ${claveLimite} (${limite})`)
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireSuscripcionActiva, requireFeature, enforceLimit };

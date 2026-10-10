const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');

function auth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return next(new AppError(401, 'No autenticado'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // `tenantId` es la academia en la que se está trabajando y
    // `tenantPropioId` la academia a la que pertenece la cuenta. Son
    // distintas solo cuando el superadmin entró a una academia ajena.
    //
    // El `rol` que viene acá es provisorio: tenant.middleware lo reemplaza
    // por el que dice la base. No se usa para decidir permisos.
    req.user = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      tenantPropioId: payload.tenantPropioId || payload.tenantId,
      rol: payload.rol,
    };
    next();
  } catch (err) {
    next(new AppError(401, 'Sesión inválida o expirada'));
  }
}

module.exports = auth;

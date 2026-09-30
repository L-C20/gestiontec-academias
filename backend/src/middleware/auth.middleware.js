const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');

function auth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return next(new AppError(401, 'No autenticado'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      rol: payload.rol,
    };
    next();
  } catch (err) {
    next(new AppError(401, 'Sesión inválida o expirada'));
  }
}

module.exports = auth;

const { AppError } = require('../utils/errors');

// Uso: router.get('/ruta', auth, tenant, requireRole('admin'), controller)
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.user.rol)) {
      return next(new AppError(403, 'No tenés permiso para realizar esta acción'));
    }
    next();
  };
}

module.exports = requireRole;

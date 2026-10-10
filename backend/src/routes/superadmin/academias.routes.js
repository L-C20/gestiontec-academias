const express = require('express');
const academiasController = require('../../controllers/superadmin/academias.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');

const router = express.Router();

// `tenant` va igual aunque estas rutas no usen req.db: es quien verifica que
// la cuenta siga vigente y quien pone el rol que dice la base. Sin él,
// requireRole creería al token.
router.use(auth, tenant, requireRole('superadmin'));

router.get('/academias', academiasController.listar);
router.post('/academias', academiasController.crear);
router.put('/academias/:id', academiasController.actualizar);
router.patch('/academias/:id/suspender', academiasController.suspender);
router.patch('/academias/:id/reactivar', academiasController.reactivar);

// Modo soporte: entrar a una academia y volver a la propia.
router.post('/academias/:id/entrar', academiasController.entrar);
router.post('/volver', academiasController.volver);

router.get('/auditoria', academiasController.auditoria);

module.exports = router;

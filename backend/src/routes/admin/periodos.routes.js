const express = require('express');
const periodosController = require('../../controllers/admin/periodos.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');
const { requireSuscripcionActiva } = require('../../middleware/plan.middleware');

const router = express.Router();

router.use(auth, tenant, requireSuscripcionActiva());

router.get('/', periodosController.listar);
router.get('/:id', periodosController.obtener);
router.post('/', requireRole('admin'), periodosController.crear);
router.put('/:id', requireRole('admin'), periodosController.actualizar);
router.patch('/:id/desactivar', requireRole('admin'), periodosController.desactivar);
router.patch('/:id/reactivar', requireRole('admin'), periodosController.reactivar);

module.exports = router;

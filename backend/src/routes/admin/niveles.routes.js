const express = require('express');
const nivelesController = require('../../controllers/admin/niveles.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');
const { requireSuscripcionActiva } = require('../../middleware/plan.middleware');

const router = express.Router();

router.use(auth, tenant, requireSuscripcionActiva());

router.get('/', nivelesController.listar);
router.get('/:id', nivelesController.obtener);
router.post('/', requireRole('admin'), nivelesController.crear);
router.put('/:id', requireRole('admin'), nivelesController.actualizar);
router.patch('/:id/desactivar', requireRole('admin'), nivelesController.desactivar);
router.patch('/:id/reactivar', requireRole('admin'), nivelesController.reactivar);

module.exports = router;

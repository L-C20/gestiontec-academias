const express = require('express');
const matriculasController = require('../../controllers/admin/matriculas.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');
const { requireSuscripcionActiva } = require('../../middleware/plan.middleware');

const router = express.Router();

router.use(auth, tenant, requireSuscripcionActiva());

router.get('/', matriculasController.listar);
router.get('/:id', matriculasController.obtener);
router.post('/', requireRole('admin'), matriculasController.crear);
router.put('/:id', requireRole('admin'), matriculasController.actualizar);
router.patch('/:id/dar-de-baja', requireRole('admin'), matriculasController.darDeBaja);
router.patch('/:id/reactivar', requireRole('admin'), matriculasController.reactivar);

module.exports = router;

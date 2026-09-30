const express = require('express');
const inscripcionesController = require('../../controllers/admin/inscripciones.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');
const { requireSuscripcionActiva } = require('../../middleware/plan.middleware');

const router = express.Router();

router.use(auth, tenant, requireSuscripcionActiva());

router.get('/', inscripcionesController.listar);
router.get('/:id', inscripcionesController.obtener);
router.post('/', requireRole('admin'), inscripcionesController.crear);
router.patch('/:id/finalizar', requireRole('admin'), inscripcionesController.finalizar);
router.patch('/:id/cancelar', requireRole('admin'), inscripcionesController.cancelar);

module.exports = router;

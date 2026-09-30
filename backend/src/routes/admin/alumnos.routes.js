const express = require('express');
const alumnosController = require('../../controllers/admin/alumnos.controller');
const alumnosService = require('../../services/alumnos.service');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');
const { requireSuscripcionActiva, enforceLimit } = require('../../middleware/plan.middleware');

const router = express.Router();

router.use(auth, tenant, requireSuscripcionActiva());

router.get('/', alumnosController.listar);
router.get('/:id', alumnosController.obtener);
router.post(
  '/',
  requireRole('admin'),
  enforceLimit('max_alumnos', (req) => alumnosService.contar(req.db)),
  alumnosController.crear
);
router.put('/:id', requireRole('admin'), alumnosController.actualizar);
router.patch('/:id/desactivar', requireRole('admin'), alumnosController.desactivar);
router.patch('/:id/reactivar', requireRole('admin'), alumnosController.reactivar);

module.exports = router;

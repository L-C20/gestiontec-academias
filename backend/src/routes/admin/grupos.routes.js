const express = require('express');
const gruposController = require('../../controllers/admin/grupos.controller');
const gruposService = require('../../services/grupos.service');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');
const { requireSuscripcionActiva, enforceLimit } = require('../../middleware/plan.middleware');

const router = express.Router();

router.use(auth, tenant, requireSuscripcionActiva());

router.get('/', gruposController.listar);
router.get('/:id', gruposController.obtener);
router.post(
  '/',
  requireRole('admin'),
  enforceLimit('max_grupos', (req) => gruposService.contar(req.db)),
  gruposController.crear
);
router.put('/:id', requireRole('admin'), gruposController.actualizar);
router.patch('/:id/desactivar', requireRole('admin'), gruposController.desactivar);
router.patch('/:id/reactivar', requireRole('admin'), gruposController.reactivar);

module.exports = router;

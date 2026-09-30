const express = require('express');
const profesoresController = require('../../controllers/admin/profesores.controller');
const profesoresService = require('../../services/profesores.service');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');
const { requireSuscripcionActiva, enforceLimit } = require('../../middleware/plan.middleware');

const router = express.Router();

router.use(auth, tenant, requireSuscripcionActiva());

router.get('/', profesoresController.listar);
router.get('/:id', profesoresController.obtener);
router.post(
  '/',
  requireRole('admin'),
  enforceLimit('max_profesores', (req) => profesoresService.contar(req.db)),
  profesoresController.crear
);
router.put('/:id', requireRole('admin'), profesoresController.actualizar);
router.patch('/:id/desactivar', requireRole('admin'), profesoresController.desactivar);
router.patch('/:id/reactivar', requireRole('admin'), profesoresController.reactivar);

module.exports = router;

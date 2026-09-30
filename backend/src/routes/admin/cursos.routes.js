const express = require('express');
const cursosController = require('../../controllers/admin/cursos.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');
const { requireSuscripcionActiva } = require('../../middleware/plan.middleware');

const router = express.Router();

router.use(auth, tenant, requireSuscripcionActiva());

router.get('/', cursosController.listar);
router.get('/:id', cursosController.obtener);
router.post('/', requireRole('admin'), cursosController.crear);
router.put('/:id', requireRole('admin'), cursosController.actualizar);
router.patch('/:id/desactivar', requireRole('admin'), cursosController.desactivar);
router.patch('/:id/reactivar', requireRole('admin'), cursosController.reactivar);

module.exports = router;

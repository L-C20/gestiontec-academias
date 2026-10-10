const express = require('express');
const gruposController = require('../../controllers/admin/grupos.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');

const router = express.Router();

router.use(auth, tenant);

router.get('/', gruposController.listar);
router.get('/:id', gruposController.obtener);
router.post('/', requireRole('admin'), gruposController.crear);
router.put('/:id', requireRole('admin'), gruposController.actualizar);
router.patch('/:id/desactivar', requireRole('admin'), gruposController.desactivar);
router.patch('/:id/reactivar', requireRole('admin'), gruposController.reactivar);

module.exports = router;

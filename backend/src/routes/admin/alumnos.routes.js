const express = require('express');
const alumnosController = require('../../controllers/admin/alumnos.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');

const router = express.Router();

router.use(auth, tenant);

router.get('/', alumnosController.listar);
router.get('/:id', alumnosController.obtener);
router.post('/', requireRole('admin'), alumnosController.crear);
router.put('/:id', requireRole('admin'), alumnosController.actualizar);
router.patch('/:id/desactivar', requireRole('admin'), alumnosController.desactivar);
router.patch('/:id/reactivar', requireRole('admin'), alumnosController.reactivar);

module.exports = router;

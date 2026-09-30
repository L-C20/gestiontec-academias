const express = require('express');
const disciplinasController = require('../../controllers/admin/disciplinas.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');
const { requireSuscripcionActiva } = require('../../middleware/plan.middleware');

const router = express.Router();

// Se aplica a TODAS las rutas de este archivo: hay que estar logueado,
// con el tenant resuelto, y con la suscripción activa.
router.use(auth, tenant, requireSuscripcionActiva());

router.get('/', disciplinasController.listar);
router.get('/:id', disciplinasController.obtener);
router.post('/', requireRole('admin'), disciplinasController.crear);
router.put('/:id', requireRole('admin'), disciplinasController.actualizar);
router.patch('/:id/desactivar', requireRole('admin'), disciplinasController.desactivar);
router.patch('/:id/reactivar', requireRole('admin'), disciplinasController.reactivar);

module.exports = router;

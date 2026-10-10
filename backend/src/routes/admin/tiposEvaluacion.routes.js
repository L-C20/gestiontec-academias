const express = require('express');
const tiposController = require('../../controllers/admin/tiposEvaluacion.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');

const router = express.Router();

router.use(auth, tenant);

// El profesor necesita leerlos para elegir el tipo al crear una evaluación,
// pero la escala y el umbral de aprobación los define administración: es una
// regla de la academia, no de cada materia.
router.get('/', tiposController.listar);
router.get('/:id', tiposController.obtener);
router.post('/', requireRole('admin'), tiposController.crear);
router.put('/:id', requireRole('admin'), tiposController.actualizar);
router.delete('/:id', requireRole('admin'), tiposController.eliminar);

module.exports = router;

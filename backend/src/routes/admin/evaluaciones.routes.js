const express = require('express');
const evaluacionesController = require('../../controllers/admin/evaluaciones.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');
const { requireSuscripcionActiva, requireFeature } = require('../../middleware/plan.middleware');

const comunes = [auth, tenant, requireSuscripcionActiva(), requireFeature('evaluaciones')];

// El profesor crea sus propias consignas y corrige: por eso escribe acá.
// Que solo pueda hacerlo sobre los grupos a su cargo lo controla el
// controlador, no este archivo (el rol no alcanza para decidirlo).
const puedeEvaluar = requireRole('admin', 'profesor');

// Anidado bajo /admin/grupos/:grupoId/evaluaciones
const porGrupo = express.Router({ mergeParams: true });
porGrupo.use(...comunes);
porGrupo.get('/', evaluacionesController.listarPorGrupo);
porGrupo.post('/', puedeEvaluar, evaluacionesController.crear);

// Directo por ID, montado en /admin/evaluaciones
const porId = express.Router();
porId.use(...comunes);
porId.get('/:id', evaluacionesController.obtener);
porId.put('/:id', puedeEvaluar, evaluacionesController.actualizar);
porId.delete('/:id', puedeEvaluar, evaluacionesController.eliminar);
porId.get('/:id/resultados', evaluacionesController.listarResultados);
porId.put('/:id/resultados', puedeEvaluar, evaluacionesController.guardarResultados);

module.exports = { porGrupo, porId };

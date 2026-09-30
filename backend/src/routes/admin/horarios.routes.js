const express = require('express');
const horariosController = require('../../controllers/admin/horarios.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');
const { requireSuscripcionActiva } = require('../../middleware/plan.middleware');

// Anidado bajo /admin/grupos/:grupoId/horarios (necesita mergeParams para leer :grupoId)
const porGrupo = express.Router({ mergeParams: true });
porGrupo.use(auth, tenant, requireSuscripcionActiva());
porGrupo.get('/', horariosController.listarPorGrupo);
porGrupo.post('/', requireRole('admin'), horariosController.crear);

// Directo por ID, montado en /admin/horarios/:id
const porId = express.Router();
porId.use(auth, tenant, requireSuscripcionActiva());
porId.put('/:id', requireRole('admin'), horariosController.actualizar);
porId.delete('/:id', requireRole('admin'), horariosController.eliminar);

module.exports = { porGrupo, porId };

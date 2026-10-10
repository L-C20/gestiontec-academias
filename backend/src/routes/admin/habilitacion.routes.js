const express = require('express');
const habilitacionController = require('../../controllers/admin/habilitacion.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');

const comunes = [auth, tenant];

// Anidado bajo /admin/grupos/:grupoId/habilitacion
const porGrupo = express.Router({ mergeParams: true });
porGrupo.use(...comunes);
porGrupo.get('/', habilitacionController.porGrupo);

// Anidado bajo /admin/inscripciones/:inscripcionId
const porInscripcion = express.Router({ mergeParams: true });
porInscripcion.use(...comunes);
porInscripcion.get('/habilitacion', habilitacionController.porInscripcion);

// La excepción es una dispensa: la firma administración, no el profesor que
// aplica la regla.
porInscripcion.put('/excepcion', requireRole('admin'), habilitacionController.guardarExcepcion);
porInscripcion.delete('/excepcion', requireRole('admin'), habilitacionController.quitarExcepcion);

module.exports = { porGrupo, porInscripcion };

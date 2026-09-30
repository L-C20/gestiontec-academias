const express = require('express');
const asistenciasController = require('../../controllers/admin/asistencias.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');
const { requireSuscripcionActiva } = require('../../middleware/plan.middleware');

// Anidado bajo /admin/inscripciones/:inscripcionId/asistencias
const porInscripcion = express.Router({ mergeParams: true });
porInscripcion.use(auth, tenant, requireSuscripcionActiva());
porInscripcion.get('/', asistenciasController.listarPorInscripcion);
porInscripcion.get('/resumen', asistenciasController.resumenPorInscripcion);
porInscripcion.post('/', asistenciasController.crear);

// Directo por ID, montado en /admin/asistencias/:id
const porId = express.Router();
porId.use(auth, tenant, requireSuscripcionActiva());
porId.put('/:id', asistenciasController.actualizar);

module.exports = { porInscripcion, porId };

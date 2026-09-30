const express = require('express');
const authController = require('../../controllers/auth/auth.controller');
const auth = require('../../middleware/auth.middleware');

const router = express.Router();

router.post('/registro-tenant', authController.registrarTenant);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', auth, authController.me);

module.exports = router;

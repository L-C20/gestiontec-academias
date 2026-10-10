const express = require('express');
const authController = require('../../controllers/auth/auth.controller');
const auth = require('../../middleware/auth.middleware');
const tenant = require('../../middleware/tenant.middleware');

const router = express.Router();

router.post('/login', authController.login);
router.post('/logout', authController.logout);
// `tenant` ademas del `auth`: asi el rol que devuelve sale de la base y no
// del token, y se sabe si el superadmin esta dentro de una academia ajena.
router.get('/me', auth, tenant, authController.me);

module.exports = router;

const authService = require('../../services/auth.service');
const { AppError } = require('../../utils/errors');

const COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // debe reflejar JWT_EXPIRES_IN

const ES_PRODUCCION = process.env.NODE_ENV === 'production';

function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    // En local, front y back comparten "site" (localhost) y 'lax' alcanza.
    // En Railway, front y back viven en subdominios distintos: sin 'none'
    // (que exige 'secure') el navegador descarta la cookie en cada fetch.
    sameSite: ES_PRODUCCION ? 'none' : 'lax',
    secure: ES_PRODUCCION,
    maxAge: COOKIE_MAX_AGE_MS,
  });
}


async function login(req, res, next) {
  try {
    const { slug, email, password } = req.body;
    if (!slug || !email || !password) {
      throw new AppError(400, 'Faltan campos obligatorios');
    }

    const token = await authService.login({ slug, email, password });
    setTokenCookie(res, token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: ES_PRODUCCION ? 'none' : 'lax',
    secure: ES_PRODUCCION,
  });
  res.json({ ok: true });
}

async function me(req, res, next) {
  try {
    // El nombre de la academia en la que se esta trabajando: el frontend lo
    // necesita para avisar, cuando es modo soporte, en casa de quien esta
    // parado el superadmin.
    const { rows } = await req.db.query('SELECT nombre, slug FROM tenants WHERE id = $1', [
      req.user.tenantId,
    ]);

    res.json({
      usuario: {
        userId: req.user.userId,
        email: req.user.email,
        rol: req.user.rol,
        soporte: req.user.soporte,
        academia: rows[0] || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, me };

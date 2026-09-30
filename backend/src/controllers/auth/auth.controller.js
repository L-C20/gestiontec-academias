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

async function registrarTenant(req, res, next) {
  try {
    const { nombreAcademia, slug, email, password } = req.body;
    if (!nombreAcademia || !slug || !email || !password) {
      throw new AppError(400, 'Faltan campos obligatorios');
    }
    if (password.length < 8) {
      throw new AppError(400, 'La contraseña debe tener al menos 8 caracteres');
    }

    const { tenant, usuario } = await authService.registrarTenant({
      nombreAcademia,
      slug,
      email,
      password,
    });

    res.status(201).json({ tenant, usuario });
  } catch (err) {
    next(err);
  }
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

function me(req, res) {
  res.json({ usuario: req.user });
}

module.exports = { registrarTenant, login, logout, me };

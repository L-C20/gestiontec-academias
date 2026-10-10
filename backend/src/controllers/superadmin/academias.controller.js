const superadminService = require('../../services/superadmin.service');
const { AppError } = require('../../utils/errors');

const ES_PRODUCCION = process.env.NODE_ENV === 'production';

const COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // debe reflejar JWT_EXPIRES_IN

function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: ES_PRODUCCION ? 'none' : 'lax',
    secure: ES_PRODUCCION,
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

// El slug va en la URL de login de cada academia, así que se limita a lo que
// se puede escribir sin ambigüedad: minúsculas, números y guiones.
const SLUG_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validarAlta(body) {
  const nombre = (body.nombre || '').trim();
  const slug = (body.slug || '').trim().toLowerCase();
  const adminEmail = (body.adminEmail || '').trim().toLowerCase();
  const adminPassword = body.adminPassword || '';

  if (!nombre) throw new AppError(400, 'El nombre de la academia es obligatorio');
  if (!slug) throw new AppError(400, 'El identificador (slug) es obligatorio');
  if (!SLUG_VALIDO.test(slug)) {
    throw new AppError(
      400,
      'El identificador solo admite minúsculas, números y guiones (por ejemplo: academia-armonia)'
    );
  }
  if (!adminEmail) throw new AppError(400, 'Hace falta el email del administrador');
  if (adminPassword.length < 8) {
    throw new AppError(400, 'La contraseña del administrador debe tener al menos 8 caracteres');
  }

  return {
    nombre,
    slug,
    adminEmail,
    adminPassword,
    contactoNombre: (body.contactoNombre || '').trim(),
    contactoEmail: (body.contactoEmail || '').trim(),
    contactoTelefono: (body.contactoTelefono || '').trim(),
    observaciones: (body.observaciones || '').trim(),
  };
}

async function listar(req, res, next) {
  try {
    const academias = await superadminService.listarAcademias();
    res.json({ academias, academiaPropiaId: req.user.tenantPropioId });
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const datos = validarAlta(req.body);
    const { academia, admin } = await superadminService.crearAcademia(datos);
    res.status(201).json({ academia, admin });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const nombre = (req.body.nombre || '').trim();
    if (!nombre) throw new AppError(400, 'El nombre de la academia es obligatorio');

    const academia = await superadminService.actualizarAcademia(req.params.id, {
      nombre,
      contactoNombre: (req.body.contactoNombre || '').trim(),
      contactoEmail: (req.body.contactoEmail || '').trim(),
      contactoTelefono: (req.body.contactoTelefono || '').trim(),
      observaciones: (req.body.observaciones || '').trim(),
    });

    if (!academia) throw new AppError(404, 'La academia no existe');
    res.json({ academia });
  } catch (err) {
    next(err);
  }
}

async function suspender(req, res, next) {
  try {
    // Suspenderse a sí mismo dejaría al proveedor afuera de su propio panel.
    if (Number(req.params.id) === Number(req.user.tenantPropioId)) {
      throw new AppError(400, 'No podés suspender tu propia cuenta');
    }

    const academia = await superadminService.cambiarEstado(req.params.id, false, req.user);
    if (!academia) throw new AppError(404, 'La academia no existe');
    res.json({ academia });
  } catch (err) {
    next(err);
  }
}

async function reactivar(req, res, next) {
  try {
    const academia = await superadminService.cambiarEstado(req.params.id, true, req.user);
    if (!academia) throw new AppError(404, 'La academia no existe');
    res.json({ academia });
  } catch (err) {
    next(err);
  }
}

/** Entra a una academia: cambia la cookie de sesión por una de soporte. */
async function entrar(req, res, next) {
  try {
    if (Number(req.params.id) === Number(req.user.tenantPropioId)) {
      throw new AppError(400, 'Ya estás en tu propia cuenta');
    }

    const { token, academia } = await superadminService.tokenDeSoporte(req.user, req.params.id);
    setTokenCookie(res, token);
    res.json({ academia });
  } catch (err) {
    next(err);
  }
}

async function volver(req, res, next) {
  try {
    setTokenCookie(res, superadminService.tokenDeVuelta(req.user));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function auditoria(req, res, next) {
  try {
    const limite = Math.min(Number(req.query.limite) || 100, 500);
    const registros = await superadminService.listarAuditoria({
      tenantId: req.query.tenantId ? Number(req.query.tenantId) : null,
      limite,
    });
    res.json({ registros });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  crear,
  actualizar,
  suspender,
  reactivar,
  entrar,
  volver,
  auditoria,
};

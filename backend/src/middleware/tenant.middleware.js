const pool = require('../database/pool');
const { AppError } = require('../utils/errors');

/**
 * Abre la transacción del request, verifica que la cuenta siga vigente y fija
 * la academia en la que se va a trabajar.
 *
 * Debe ejecutarse siempre después de auth.middleware: usa req.user, que sale
 * del JWT ya verificado, nunca de req.body/req.params/req.query.
 *
 * Por qué consulta la base y no se queda con el token:
 *
 * El rol y la academia del token quedaron fijos cuando la persona inició
 * sesión. Si después se la da de baja, se le cambia el rol o se suspende su
 * academia, el token sigue diciendo lo de antes y seguiría entrando hasta que
 * venza. Suspender una academia tiene que surtir efecto ahora, no en doce
 * horas, así que el rol y el estado se leen de la base. Para no pagar una
 * consulta por request, el resultado se guarda 30 segundos en memoria: una
 * baja puede tardar hasta medio minuto en cerrar las sesiones abiertas.
 *
 * Sobre el doble `set_config`: la fila del usuario vive en SU academia, y
 * `usuarios` tiene FORCE ROW LEVEL SECURITY. Para poder leerla hay que fijar
 * primero el contexto de su propia academia; recién después se cambia al de
 * la academia donde va a trabajar, que para todos menos el superadmin es la
 * misma. Así el superadmin puede entrar a una academia ajena sin que haya que
 * abrirle un agujero a ninguna política.
 */

const VIGENCIA_CACHE_MS = 30 * 1000;

const cache = new Map();

function invalidarCache(usuarioId) {
  if (usuarioId === undefined) {
    cache.clear();
  } else {
    cache.delete(Number(usuarioId));
  }
}

async function leerCuenta(client, usuarioId, tenantPropioId) {
  const guardado = cache.get(Number(usuarioId));
  if (guardado && Date.now() - guardado.hora < VIGENCIA_CACHE_MS) {
    return guardado.datos;
  }

  // Contexto de la academia propia: sin esto la política de `usuarios`
  // esconde la fila y parecería que la cuenta no existe.
  await client.query("SELECT set_config('app.current_tenant', $1, true)", [
    String(tenantPropioId),
  ]);

  const { rows } = await client.query(
    `SELECT u.id, u.email, u.estado, u.tenant_id, r.nombre AS rol, t.activo AS academia_activa
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = $1`,
    [usuarioId]
  );

  const datos = rows[0] || null;
  cache.set(Number(usuarioId), { hora: Date.now(), datos });
  return datos;
}

async function academiaActiva(client, tenantId) {
  const { rows } = await client.query('SELECT activo FROM tenants WHERE id = $1', [tenantId]);
  return rows[0] ? rows[0].activo : null;
}

/**
 * Deja constancia de lo que el superadmin modifica dentro de una academia
 * ajena. Solo lo que modifica: registrar cada lectura llenaría la tabla de
 * ruido y haría ilegible lo que importa.
 *
 * Se escribe al terminar el request y con una conexión aparte, porque la
 * transacción del request ya se cerró; si el request falló, no se registra
 * nada, porque no pasó nada.
 */
function auditarSoporte(req, res, academiaNombre) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;

  // Las acciones del propio panel de proveedor (crear o suspender una
  // academia) ya dejan su propio registro, y no son cambios hechos *dentro*
  // de la academia visitada: anotarlas acá las atribuiría a la academia
  // equivocada.
  if (req.originalUrl.startsWith('/superadmin')) return;

  res.on('finish', () => {
    if (res.statusCode >= 400) return;

    pool
      .query(
        `INSERT INTO auditoria
           (usuario_id, usuario_email, tenant_id, tenant_nombre, accion, detalle)
         VALUES ($1, $2, $3, $4, 'soporte_modificacion', $5)`,
        [
          req.user.userId,
          req.user.email || null,
          req.user.tenantId,
          academiaNombre,
          `${req.method} ${req.originalUrl.split('?')[0]}`,
        ]
      )
      .catch((error) => console.error('No se pudo registrar la auditoría:', error.message));
  });
}

async function tenant(req, res, next) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tenantPropioId = req.user.tenantPropioId || req.user.tenantId;
    const cuenta = await leerCuenta(client, req.user.userId, tenantPropioId);

    if (!cuenta) {
      throw new AppError(401, 'La cuenta no existe');
    }
    if (cuenta.estado !== 'activo') {
      throw new AppError(401, 'La cuenta está desactivada');
    }

    const destino = Number(req.user.tenantId);
    const esSuPropiaAcademia = destino === Number(cuenta.tenant_id);

    // Solo el superadmin puede estar en una academia que no es la suya.
    if (!esSuPropiaAcademia && cuenta.rol !== 'superadmin') {
      throw new AppError(401, 'Sesión inválida');
    }

    // Una academia suspendida no deja entrar a su gente. Al superadmin sí,
    // porque para decidir si la reactiva tiene que poder mirar adentro.
    const activa = esSuPropiaAcademia
      ? cuenta.academia_activa
      : await academiaActiva(client, destino);

    if (activa === null) {
      throw new AppError(401, 'Sesión inválida');
    }
    if (!activa && cuenta.rol !== 'superadmin') {
      throw new AppError(403, 'La academia está suspendida. Contactate con el administrador.');
    }

    // Y ahora sí, el contexto de la academia donde se va a trabajar.
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [String(destino)]);

    // El rol sale de la base, no del token.
    req.user.rol = cuenta.rol;
    req.user.email = cuenta.email;
    req.user.tenantPropioId = Number(cuenta.tenant_id);
    req.user.soporte = !esSuPropiaAcademia;

    req.db = client;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    return next(err);
  }

  res.on('finish', () => {
    const exito = res.statusCode < 400;
    client
      .query(exito ? 'COMMIT' : 'ROLLBACK')
      .catch(() => {})
      .finally(() => client.release());
  });

  if (req.user.soporte) {
    const { rows } = await pool.query('SELECT nombre FROM tenants WHERE id = $1', [
      req.user.tenantId,
    ]);
    auditarSoporte(req, res, rows[0] ? rows[0].nombre : null);
  }

  next();
}

module.exports = tenant;
module.exports.invalidarCache = invalidarCache;

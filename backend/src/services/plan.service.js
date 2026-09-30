// Todas las funciones reciben `db` (req.db: la conexión con el tenant ya
// seteado vía tenant.middleware) porque `suscripciones` tiene RLS forzado —
// consultarla con el pool genérico, sin ese contexto, siempre devolvería 0 filas.

async function getSuscripcionActiva(db, tenantId) {
  const { rows } = await db.query(
    `SELECT s.estado, p.id AS plan_id, p.nombre AS plan_nombre
     FROM suscripciones s
     JOIN planes p ON p.id = s.plan_id
     WHERE s.tenant_id = $1
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [tenantId]
  );
  return rows[0] || null;
}

async function hasFeature(db, tenantId, claveFuncionalidad) {
  const suscripcion = await getSuscripcionActiva(db, tenantId);
  if (!suscripcion) return false;

  const { rows } = await db.query(
    `SELECT 1
     FROM plan_funcionalidades pf
     JOIN funcionalidades f ON f.id = pf.funcionalidad_id
     WHERE pf.plan_id = $1 AND f.clave = $2`,
    [suscripcion.plan_id, claveFuncionalidad]
  );
  return rows.length > 0;
}

// Devuelve: un número (el límite), null (sin límite práctico), o 0 si el
// tenant no tiene ninguna suscripción válida.
async function getLimite(db, tenantId, claveLimite) {
  const suscripcion = await getSuscripcionActiva(db, tenantId);
  if (!suscripcion) return 0;

  const { rows } = await db.query(
    'SELECT valor FROM plan_limites WHERE plan_id = $1 AND clave = $2',
    [suscripcion.plan_id, claveLimite]
  );
  if (rows.length === 0) return null;
  return rows[0].valor; // puede venir null (sin límite) desde la columna
}

module.exports = { getSuscripcionActiva, hasFeature, getLimite };

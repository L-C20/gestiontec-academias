const pool = require('../database/pool');

// Debe ejecutarse siempre después de auth.middleware: usa req.user.tenantId,
// que sale del JWT ya verificado, nunca de req.body/req.params/req.query.
async function tenant(req, res, next) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [
      String(req.user.tenantId),
    ]);
  } catch (err) {
    client.release();
    return next(err);
  }

  req.db = client;

  res.on('finish', () => {
    const exito = res.statusCode < 400;
    client
      .query(exito ? 'COMMIT' : 'ROLLBACK')
      .catch(() => {})
      .finally(() => client.release());
  });

  next();
}

module.exports = tenant;

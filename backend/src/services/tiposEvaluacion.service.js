/**
 * Tipos de evaluación: qué escala usa cada clase de evaluación y desde dónde
 * se considera aprobada.
 *
 * El umbral se guarda acá y lo lee la función `evaluacion_aprobada()` de la
 * base. Por eso una academia puede aprobar desde 7 y otra desde 6 sin que
 * cambie ni una línea de código.
 */

const ESCALAS = [
  'numerica_10',
  'numerica_100',
  'letras',
  'aprobado_no_aprobado',
  'personalizada',
];

const ESCALAS_NUMERICAS = ['numerica_10', 'numerica_100', 'personalizada'];

function esNumerica(escala) {
  return ESCALAS_NUMERICAS.includes(escala);
}

const CAMPOS = 'id, nombre, escala, configuracion';

async function listar(db) {
  const { rows } = await db.query(`SELECT ${CAMPOS} FROM tipos_evaluacion ORDER BY nombre`);
  return rows;
}

async function obtenerPorId(db, id) {
  const { rows } = await db.query(`SELECT ${CAMPOS} FROM tipos_evaluacion WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function crear(db, tenantId, { nombre, escala, configuracion }) {
  const { rows } = await db.query(
    `INSERT INTO tipos_evaluacion (tenant_id, nombre, escala, configuracion)
     VALUES ($1, $2, $3, $4)
     RETURNING ${CAMPOS}`,
    [tenantId, nombre, escala, configuracion]
  );
  return rows[0];
}

async function actualizar(db, id, { nombre, escala, configuracion }) {
  const { rows } = await db.query(
    `UPDATE tipos_evaluacion
     SET nombre = $1, escala = $2, configuracion = $3
     WHERE id = $4
     RETURNING ${CAMPOS}`,
    [nombre, escala, configuracion, id]
  );
  return rows[0] || null;
}

async function eliminar(db, id) {
  const { rowCount } = await db.query('DELETE FROM tipos_evaluacion WHERE id = $1', [id]);
  return rowCount > 0;
}

// Cuántas evaluaciones lo están usando: sirve para avisar antes de borrar,
// en lugar de dejar que explote la clave foránea.
async function enUso(db, id) {
  const { rows } = await db.query(
    'SELECT count(*)::int AS usos FROM evaluaciones WHERE tipo_evaluacion_id = $1',
    [id]
  );
  return rows[0].usos;
}

module.exports = {
  ESCALAS,
  esNumerica,
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  enUso,
};

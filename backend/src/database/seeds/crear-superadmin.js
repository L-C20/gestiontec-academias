/**
 * Crea (o actualiza) la cuenta de superadmin del proveedor.
 *
 *   node src/database/seeds/crear-superadmin.js <slug> <email>
 *   node src/database/seeds/crear-superadmin.js gestiontec vos@tucorreo.com
 *
 * Si la academia del slug no existe, se crea. Si el email ya existe en ella,
 * se lo pasa a superadmin y se le cambia la contraseña.
 *
 * Por qué el superadmin tiene su propia "academia": el login identifica a la
 * persona por academia + email, y todas las tablas tienen FORCE ROW LEVEL
 * SECURITY sobre `tenant_id`. Darle al proveedor su propia fila en `tenants`
 * —sin alumnos— es lo que le permite entrar y administrar sin volver
 * `tenant_id` nullable ni agregarle excepciones a las políticas. Para mirar
 * una academia usa el modo soporte, que emite un token hacia ella.
 *
 * La contraseña se pide por teclado y no se toma de los argumentos: lo que
 * se escribe en la línea de comandos queda en el historial del shell.
 */

require('dotenv').config();

const readline = require('readline');
const bcrypt = require('bcrypt');

const pool = require('../pool');

const SALT_ROUNDS = 10;
const MINIMO_PASSWORD = 8;

function preguntarOculto(texto) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    process.stdout.write(texto);

    // Se silencia el eco recién después de escribir el texto, para que la
    // pregunta se vea pero no lo que se teclea.
    rl._writeToOutput = () => {};

    rl.question('', (valor) => {
      rl.close();
      process.stdout.write('\n');
      resolve(valor);
    });
  });
}

async function main() {
  const [slug, email] = process.argv.slice(2);

  if (!slug || !email) {
    console.error('Uso: node src/database/seeds/crear-superadmin.js <slug> <email>');
    console.error('Ejemplo: node src/database/seeds/crear-superadmin.js gestiontec vos@tucorreo.com');
    process.exit(1);
  }

  const password = await preguntarOculto(`Contrasena para ${email}: `);
  const repetida = await preguntarOculto('Repetila: ');

  if (password !== repetida) {
    console.error('Las contrasenas no coinciden.');
    process.exit(1);
  }
  if (password.length < MINIMO_PASSWORD) {
    console.error(`La contrasena debe tener al menos ${MINIMO_PASSWORD} caracteres.`);
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let { rows: academias } = await client.query(
      'SELECT id, nombre FROM tenants WHERE slug = $1',
      [slug]
    );

    let creada = false;

    if (academias.length === 0) {
      ({ rows: academias } = await client.query(
        `INSERT INTO tenants (nombre, slug, observaciones)
         VALUES ($1, $2, 'Cuenta del proveedor del sistema')
         RETURNING id, nombre`,
        [slug, slug]
      ));
      creada = true;
    }

    const academia = academias[0];

    // Las tablas con RLS necesitan el contexto fijado.
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [
      String(academia.id),
    ]);

    const { rows: roles } = await client.query(
      "SELECT id FROM roles WHERE nombre = 'superadmin'"
    );

    if (roles.length === 0) {
      throw new Error(
        'No existe el rol superadmin. Corre primero: npm.cmd run migrate -- up'
      );
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const { rows: usuarios } = await client.query(
      `INSERT INTO usuarios (tenant_id, rol_id, email, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, email) DO UPDATE
         SET rol_id = excluded.rol_id,
             password_hash = excluded.password_hash,
             estado = 'activo'
       RETURNING id, (xmax = 0) AS insertado`,
      [academia.id, roles[0].id, email.toLowerCase(), passwordHash]
    );

    await client.query('COMMIT');

    const usuario = usuarios[0];

    console.log('');
    console.log(creada ? `Academia creada: ${slug}` : `Academia existente: ${academia.nombre}`);
    console.log(
      usuario.insertado
        ? `Superadmin creado: ${email}`
        : `Superadmin actualizado: ${email} (rol y contrasena)`
    );
    console.log('');
    console.log('Para entrar:');
    console.log(`  academia: ${slug}`);
    console.log(`  email:    ${email}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`No se pudo crear el superadmin: ${error.message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();

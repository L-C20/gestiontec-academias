let usuarioActual = null;
let academias = [];
let academiaPropiaId = null;

async function iniciar() {
  usuarioActual = await inicializarLayout('academias');
  if (!usuarioActual) return;

  // Si el superadmin llegó acá estando dentro de una academia, lo primero
  // que corresponde es sacarlo de ahí: este panel es de su propia cuenta.
  if (usuarioActual.soporte) {
    try {
      await api.post('/superadmin/volver');
      window.location.reload();
      return;
    } catch (err) {
      mostrarNotificacion(err.message, 'error');
    }
  }

  if (usuarioActual.rol !== 'superadmin') {
    document.querySelector('.contenido').innerHTML =
      '<h1>Academias</h1><p class="sin-datos">Esta sección es solo del proveedor del sistema.</p>';
    return;
  }

  document.getElementById('btn-nueva').addEventListener('click', abrirAlta);
  document.getElementById('btn-cancelar-alta').addEventListener('click', cerrarAlta);
  document.getElementById('btn-cancelar-editar').addEventListener('click', cerrarEdicion);
  document.getElementById('form-alta').addEventListener('submit', crear);
  document.getElementById('form-editar').addEventListener('submit', guardarEdicion);

  // Sugerir el identificador a partir del nombre, sin pisarlo si ya lo tocaron.
  const campoSlug = document.getElementById('alta-slug');
  document.getElementById('alta-nombre').addEventListener('input', (evento) => {
    if (campoSlug.dataset.tocado === 'si') return;
    campoSlug.value = comoSlug(evento.target.value);
  });
  campoSlug.addEventListener('input', () => {
    campoSlug.dataset.tocado = 'si';
  });

  await cargar();
}

// Mismo criterio que valida el backend: minúsculas, números y guiones.
function comoSlug(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function cargar() {
  try {
    const respuesta = await api.get('/superadmin/academias');
    academias = respuesta.academias;
    academiaPropiaId = respuesta.academiaPropiaId;
    renderizar();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto === null || texto === undefined ? '' : texto;
  return div.innerHTML;
}

function formatearFecha(valor) {
  if (!valor) return '';
  const [anio, mes, dia] = String(valor).slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

function renderizar() {
  const cuerpo = document.getElementById('tabla');

  // La cuenta del proveedor aparece en la lista pero no se cuenta como
  // academia: no tiene alumnos, es desde donde administrás.
  const ajenas = academias.filter((a) => a.id !== academiaPropiaId);
  document.getElementById('contador').textContent = `${ajenas.length} academia(s)`;

  if (academias.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="5" class="sin-datos">Todavía no hay academias.</td></tr>';
    return;
  }

  cuerpo.innerHTML = academias
    .map((a) => {
      const esPropia = a.id === academiaPropiaId;

      const contacto = [a.contacto_nombre, a.contacto_telefono, a.contacto_email]
        .filter(Boolean)
        .map(escaparHtml)
        .join('<br />');

      const estado = esPropia
        ? '<span class="badge badge--pendiente">Tu cuenta</span>'
        : a.activo
          ? '<span class="badge badge--activo">Activa</span>'
          : '<span class="badge badge--inactivo">Suspendida</span>';

      const acciones = esPropia
        ? ''
        : `
          <button class="boton boton--texto" onclick="entrar(${a.id})">Entrar</button>
          <button class="boton boton--texto" onclick="editar(${a.id})">Editar</button>
          ${
            a.activo
              ? `<button class="boton boton--texto" onclick="cambiarEstado(${a.id}, false)">Suspender</button>`
              : `<button class="boton boton--texto" onclick="cambiarEstado(${a.id}, true)">Reactivar</button>`
          }
        `;

      return `
        <tr>
          <td>
            ${escaparHtml(a.nombre)}
            <div class="texto-tenue">desde ${formatearFecha(a.created_at)}</div>
          </td>
          <td><code>${escaparHtml(a.slug)}</code></td>
          <td>${contacto || '<span class="texto-tenue">—</span>'}</td>
          <td>${estado}</td>
          <td>${acciones}</td>
        </tr>
      `;
    })
    .join('');
}

/* ---------- alta ---------- */

function abrirAlta() {
  document.getElementById('form-alta').reset();
  document.getElementById('alta-slug').dataset.tocado = 'no';
  document.getElementById('modal-alta').classList.remove('oculto');
}

function cerrarAlta() {
  document.getElementById('modal-alta').classList.add('oculto');
}

async function crear(evento) {
  evento.preventDefault();

  const cuerpo = {
    nombre: document.getElementById('alta-nombre').value.trim(),
    slug: document.getElementById('alta-slug').value.trim().toLowerCase(),
    adminEmail: document.getElementById('alta-admin-email').value.trim(),
    adminPassword: document.getElementById('alta-admin-password').value,
    contactoNombre: document.getElementById('alta-contacto-nombre').value.trim(),
    contactoEmail: document.getElementById('alta-contacto-email').value.trim(),
    contactoTelefono: document.getElementById('alta-contacto-telefono').value.trim(),
    observaciones: document.getElementById('alta-observaciones').value.trim(),
  };

  try {
    const { academia } = await api.post('/superadmin/academias', cuerpo);
    cerrarAlta();
    mostrarNotificacion(
      `Academia "${academia.nombre}" creada. Su administrador entra con el identificador "${academia.slug}".`,
      'exito',
      8000
    );
    await cargar();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

/* ---------- edición ---------- */

function editar(id) {
  const academia = academias.find((a) => a.id === id);
  if (!academia) return;

  document.getElementById('editar-id').value = academia.id;
  document.getElementById('editar-nombre').value = academia.nombre;
  document.getElementById('editar-slug').value = academia.slug;
  document.getElementById('editar-contacto-nombre').value = academia.contacto_nombre || '';
  document.getElementById('editar-contacto-email').value = academia.contacto_email || '';
  document.getElementById('editar-contacto-telefono').value = academia.contacto_telefono || '';
  document.getElementById('editar-observaciones').value = academia.observaciones || '';
  document.getElementById('modal-editar').classList.remove('oculto');
}

function cerrarEdicion() {
  document.getElementById('modal-editar').classList.add('oculto');
}

async function guardarEdicion(evento) {
  evento.preventDefault();

  const id = document.getElementById('editar-id').value;

  try {
    await api.put(`/superadmin/academias/${id}`, {
      nombre: document.getElementById('editar-nombre').value.trim(),
      contactoNombre: document.getElementById('editar-contacto-nombre').value.trim(),
      contactoEmail: document.getElementById('editar-contacto-email').value.trim(),
      contactoTelefono: document.getElementById('editar-contacto-telefono').value.trim(),
      observaciones: document.getElementById('editar-observaciones').value.trim(),
    });
    cerrarEdicion();
    mostrarNotificacion('Academia actualizada', 'exito');
    await cargar();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

/* ---------- suspender y entrar ---------- */

async function cambiarEstado(id, activar) {
  const academia = academias.find((a) => a.id === id);

  const mensaje = activar
    ? `¿Reactivar "${academia.nombre}"? Su gente vuelve a poder entrar.`
    : `¿Suspender "${academia.nombre}"? Su gente no va a poder entrar, pero no se borra nada.`;

  if (!(await confirmarAccion(mensaje))) return;

  try {
    await api.patch(`/superadmin/academias/${id}/${activar ? 'reactivar' : 'suspender'}`);
    mostrarNotificacion(activar ? 'Academia reactivada' : 'Academia suspendida', 'exito');
    await cargar();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function entrar(id) {
  const academia = academias.find((a) => a.id === id);

  if (
    !(await confirmarAccion(
      `¿Entrar a "${academia.nombre}"? Vas a ver sus datos como los ve su administrador, y lo que modifiques queda registrado en la auditoría.`
    ))
  ) {
    return;
  }

  try {
    await api.post(`/superadmin/academias/${id}/entrar`);
    window.location.href = 'alumnos.html';
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

iniciar();

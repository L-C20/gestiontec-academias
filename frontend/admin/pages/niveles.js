let usuarioActual = null;

async function iniciar() {
  usuarioActual = await inicializarLayout('niveles');
  if (!usuarioActual) return;

  if (usuarioActual.rol !== 'admin') {
    document.getElementById('btn-nuevo').classList.add('oculto');
  }

  document.getElementById('btn-nuevo').addEventListener('click', () => abrirModal());
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('form-nivel').addEventListener('submit', guardarNivel);

  await cargarNiveles();
}

async function cargarNiveles() {
  try {
    const { niveles } = await api.get('/admin/niveles');
    renderizarTabla(niveles);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

function renderizarTabla(niveles) {
  const cuerpo = document.getElementById('tabla-niveles');
  document.getElementById('contador-niveles').textContent = `${niveles.length} nivel(es)`;

  if (niveles.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="4">Todavía no hay niveles cargados.</td></tr>';
    return;
  }

  const esAdmin = usuarioActual.rol === 'admin';

  cuerpo.innerHTML = niveles
    .map((n) => {
      const badge = n.estado === 'activo' ? 'badge--activo' : 'badge--inactivo';
      const accionesAdmin = esAdmin
        ? `
          <button class="boton boton--texto" onclick="editarNivel(${n.id})">Editar</button>
          ${
            n.estado === 'activo'
              ? `<button class="boton boton--texto" onclick="cambiarEstadoNivel(${n.id}, 'desactivar')">Desactivar</button>`
              : `<button class="boton boton--texto" onclick="cambiarEstadoNivel(${n.id}, 'reactivar')">Reactivar</button>`
          }
        `
        : '';
      return `
        <tr>
          <td>${n.orden}</td>
          <td>${escaparHtml(n.nombre)}</td>
          <td><span class="badge ${badge}">${n.estado}</span></td>
          <td>${accionesAdmin}</td>
        </tr>
      `;
    })
    .join('');
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function abrirModal(nivel = null) {
  document.getElementById('modal-titulo').textContent = nivel ? 'Editar nivel' : 'Nuevo nivel';
  document.getElementById('nivel-id').value = nivel ? nivel.id : '';
  document.getElementById('nivel-nombre').value = nivel ? nivel.nombre : '';
  document.getElementById('nivel-orden').value = nivel ? nivel.orden : 0;
  document.getElementById('modal-fondo').classList.remove('oculto');
}

function cerrarModal() {
  document.getElementById('modal-fondo').classList.add('oculto');
}

async function editarNivel(id) {
  try {
    const { nivel } = await api.get(`/admin/niveles/${id}`);
    abrirModal(nivel);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function guardarNivel(evento) {
  evento.preventDefault();
  const id = document.getElementById('nivel-id').value;
  const nombre = document.getElementById('nivel-nombre').value.trim();
  const orden = Number(document.getElementById('nivel-orden').value);

  try {
    if (id) {
      await api.put(`/admin/niveles/${id}`, { nombre, orden });
      mostrarNotificacion('Nivel actualizado', 'exito');
    } else {
      await api.post('/admin/niveles', { nombre, orden });
      mostrarNotificacion('Nivel creado', 'exito');
    }
    cerrarModal();
    await cargarNiveles();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function cambiarEstadoNivel(id, accion) {
  const mensaje = accion === 'desactivar' ? '¿Desactivar este nivel?' : '¿Reactivar este nivel?';
  if (!(await confirmarAccion(mensaje))) return;

  try {
    await api.patch(`/admin/niveles/${id}/${accion}`);
    mostrarNotificacion(`Nivel ${accion === 'desactivar' ? 'desactivado' : 'reactivado'}`, 'exito');
    await cargarNiveles();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

iniciar();

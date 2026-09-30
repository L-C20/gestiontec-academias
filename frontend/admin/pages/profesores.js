let usuarioActual = null;

async function iniciar() {
  usuarioActual = await inicializarLayout('profesores');
  if (!usuarioActual) return;

  if (usuarioActual.rol !== 'admin') {
    document.getElementById('btn-nuevo').classList.add('oculto');
  }

  document.getElementById('btn-nuevo').addEventListener('click', () => abrirModal());
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('form-profesor').addEventListener('submit', guardarProfesor);

  await cargarProfesores();
}

async function cargarProfesores() {
  try {
    const { profesores } = await api.get('/admin/profesores');
    renderizarTabla(profesores);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

function renderizarTabla(profesores) {
  const cuerpo = document.getElementById('tabla-profesores');
  document.getElementById('contador-profesores').textContent = `${profesores.length} profesor(es)`;

  if (profesores.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="6">Todavía no hay profesores cargados.</td></tr>';
    return;
  }

  const esAdmin = usuarioActual.rol === 'admin';

  cuerpo.innerHTML = profesores
    .map((p) => {
      const badge = p.estado === 'activo' ? 'badge--activo' : 'badge--inactivo';
      const accionesAdmin = esAdmin
        ? `
          <button class="boton boton--texto" onclick="editarProfesor(${p.id})">Editar</button>
          ${
            p.estado === 'activo'
              ? `<button class="boton boton--texto" onclick="cambiarEstadoProfesor(${p.id}, 'desactivar')">Desactivar</button>`
              : `<button class="boton boton--texto" onclick="cambiarEstadoProfesor(${p.id}, 'reactivar')">Reactivar</button>`
          }
        `
        : '';
      return `
        <tr>
          <td>${escaparHtml(p.nombre)} ${escaparHtml(p.apellido)}</td>
          <td>${escaparHtml(p.documento || '-')}</td>
          <td>${escaparHtml(p.email || '-')}</td>
          <td>${escaparHtml(p.especialidad || '-')}</td>
          <td><span class="badge ${badge}">${p.estado}</span></td>
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

function abrirModal(profesor = null) {
  document.getElementById('modal-titulo').textContent = profesor ? 'Editar profesor' : 'Nuevo profesor';
  document.getElementById('profesor-id').value = profesor ? profesor.id : '';
  document.getElementById('profesor-nombre').value = profesor ? profesor.nombre : '';
  document.getElementById('profesor-apellido').value = profesor ? profesor.apellido : '';
  document.getElementById('profesor-documento').value = profesor ? profesor.documento || '' : '';
  document.getElementById('profesor-telefono').value = profesor ? profesor.telefono || '' : '';
  document.getElementById('profesor-email').value = profesor ? profesor.email || '' : '';
  document.getElementById('profesor-especialidad').value = profesor ? profesor.especialidad || '' : '';
  document.getElementById('profesor-observaciones').value = profesor ? profesor.observaciones || '' : '';
  document.getElementById('modal-fondo').classList.remove('oculto');
}

function cerrarModal() {
  document.getElementById('modal-fondo').classList.add('oculto');
}

async function editarProfesor(id) {
  try {
    const { profesor } = await api.get(`/admin/profesores/${id}`);
    abrirModal(profesor);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

function leerDatosFormulario() {
  return {
    nombre: document.getElementById('profesor-nombre').value.trim(),
    apellido: document.getElementById('profesor-apellido').value.trim(),
    documento: document.getElementById('profesor-documento').value.trim(),
    telefono: document.getElementById('profesor-telefono').value.trim(),
    email: document.getElementById('profesor-email').value.trim(),
    especialidad: document.getElementById('profesor-especialidad').value.trim(),
    observaciones: document.getElementById('profesor-observaciones').value.trim(),
  };
}

async function guardarProfesor(evento) {
  evento.preventDefault();
  const id = document.getElementById('profesor-id').value;
  const datos = leerDatosFormulario();

  try {
    if (id) {
      await api.put(`/admin/profesores/${id}`, datos);
      mostrarNotificacion('Profesor actualizado', 'exito');
    } else {
      await api.post('/admin/profesores', datos);
      mostrarNotificacion('Profesor creado', 'exito');
    }
    cerrarModal();
    await cargarProfesores();
  } catch (err) {
    // Acá también llega el error de límite de plan ("Se alcanzó el límite de tu plan...")
    mostrarNotificacion(err.message, 'error');
  }
}

async function cambiarEstadoProfesor(id, accion) {
  const mensaje = accion === 'desactivar' ? '¿Desactivar este profesor?' : '¿Reactivar este profesor?';
  if (!(await confirmarAccion(mensaje))) return;

  try {
    await api.patch(`/admin/profesores/${id}/${accion}`);
    mostrarNotificacion(`Profesor ${accion === 'desactivar' ? 'desactivado' : 'reactivado'}`, 'exito');
    await cargarProfesores();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

iniciar();

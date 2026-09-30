let usuarioActual = null;

async function iniciar() {
  usuarioActual = await inicializarLayout('alumnos');
  if (!usuarioActual) return;

  if (usuarioActual.rol !== 'admin') {
    document.getElementById('btn-nuevo').classList.add('oculto');
  }

  document.getElementById('btn-nuevo').addEventListener('click', () => abrirModal());
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('form-alumno').addEventListener('submit', guardarAlumno);

  let temporizadorBusqueda;
  document.getElementById('buscador').addEventListener('input', (e) => {
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(() => cargarAlumnos(e.target.value.trim()), 300);
  });

  await cargarAlumnos();
}

async function cargarAlumnos(q = '') {
  try {
    const { alumnos } = await api.get('/admin/alumnos', q ? { q } : undefined);
    renderizarTabla(alumnos);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

function renderizarTabla(alumnos) {
  const cuerpo = document.getElementById('tabla-alumnos');

  if (alumnos.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="6">No se encontraron alumnos.</td></tr>';
    return;
  }

  const esAdmin = usuarioActual.rol === 'admin';

  cuerpo.innerHTML = alumnos
    .map((a) => {
      const badge = a.estado === 'activo' ? 'badge--activo' : 'badge--inactivo';
      const accionesAdmin = esAdmin
        ? `
          <button class="boton boton--texto" onclick="editarAlumno(${a.id})">Editar</button>
          ${
            a.estado === 'activo'
              ? `<button class="boton boton--texto" onclick="cambiarEstadoAlumno(${a.id}, 'desactivar')">Desactivar</button>`
              : `<button class="boton boton--texto" onclick="cambiarEstadoAlumno(${a.id}, 'reactivar')">Reactivar</button>`
          }
        `
        : '';
      return `
        <tr>
          <td><a href="alumno-detalle.html?id=${a.id}">${escaparHtml(a.nombre)} ${escaparHtml(a.apellido)}</a></td>
          <td>${escaparHtml(a.documento || '-')}</td>
          <td>${escaparHtml(a.email || '-')}</td>
          <td>${escaparHtml(a.telefono || '-')}</td>
          <td><span class="badge ${badge}">${a.estado}</span></td>
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

function leerDatosFormulario() {
  return {
    nombre: document.getElementById('alumno-nombre').value.trim(),
    apellido: document.getElementById('alumno-apellido').value.trim(),
    documento: document.getElementById('alumno-documento').value.trim(),
    fechaNacimiento: document.getElementById('alumno-fecha-nacimiento').value || null,
    telefono: document.getElementById('alumno-telefono').value.trim(),
    email: document.getElementById('alumno-email').value.trim(),
    direccion: document.getElementById('alumno-direccion').value.trim(),
    contactoEmergenciaNombre: document.getElementById('alumno-contacto-nombre').value.trim(),
    contactoEmergenciaTelefono: document.getElementById('alumno-contacto-telefono').value.trim(),
    observaciones: document.getElementById('alumno-observaciones').value.trim(),
  };
}

function abrirModal(alumno = null) {
  document.getElementById('modal-titulo').textContent = alumno ? 'Editar alumno' : 'Nuevo alumno';
  document.getElementById('alumno-id').value = alumno ? alumno.id : '';
  document.getElementById('alumno-nombre').value = alumno ? alumno.nombre : '';
  document.getElementById('alumno-apellido').value = alumno ? alumno.apellido : '';
  document.getElementById('alumno-documento').value = alumno ? alumno.documento || '' : '';
  document.getElementById('alumno-fecha-nacimiento').value = alumno && alumno.fecha_nacimiento ? alumno.fecha_nacimiento.slice(0, 10) : '';
  document.getElementById('alumno-telefono').value = alumno ? alumno.telefono || '' : '';
  document.getElementById('alumno-email').value = alumno ? alumno.email || '' : '';
  document.getElementById('alumno-direccion').value = alumno ? alumno.direccion || '' : '';
  document.getElementById('alumno-contacto-nombre').value = alumno ? alumno.contacto_emergencia_nombre || '' : '';
  document.getElementById('alumno-contacto-telefono').value = alumno ? alumno.contacto_emergencia_telefono || '' : '';
  document.getElementById('alumno-observaciones').value = alumno ? alumno.observaciones || '' : '';
  document.getElementById('modal-fondo').classList.remove('oculto');
}

function cerrarModal() {
  document.getElementById('modal-fondo').classList.add('oculto');
}

async function editarAlumno(id) {
  try {
    const { alumno } = await api.get(`/admin/alumnos/${id}`);
    abrirModal(alumno);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function guardarAlumno(evento) {
  evento.preventDefault();
  const id = document.getElementById('alumno-id').value;
  const datos = leerDatosFormulario();

  try {
    if (id) {
      await api.put(`/admin/alumnos/${id}`, datos);
      mostrarNotificacion('Alumno actualizado', 'exito');
    } else {
      await api.post('/admin/alumnos', datos);
      mostrarNotificacion('Alumno creado', 'exito');
    }
    cerrarModal();
    await cargarAlumnos(document.getElementById('buscador').value.trim());
  } catch (err) {
    // Acá llega el error de límite de plan si se alcanzó el máximo de alumnos
    mostrarNotificacion(err.message, 'error');
  }
}

async function cambiarEstadoAlumno(id, accion) {
  const mensaje = accion === 'desactivar' ? '¿Desactivar este alumno?' : '¿Reactivar este alumno?';
  if (!(await confirmarAccion(mensaje))) return;

  try {
    await api.patch(`/admin/alumnos/${id}/${accion}`);
    mostrarNotificacion(`Alumno ${accion === 'desactivar' ? 'desactivado' : 'reactivado'}`, 'exito');
    await cargarAlumnos(document.getElementById('buscador').value.trim());
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

iniciar();

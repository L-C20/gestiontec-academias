let usuarioActual = null;

async function iniciar() {
  usuarioActual = await inicializarLayout('disciplinas');
  if (!usuarioActual) return; // ya redirigió a login

  if (usuarioActual.rol !== 'admin') {
    document.getElementById('btn-nueva').classList.add('oculto');
  }

  document.getElementById('btn-nueva').addEventListener('click', () => abrirModal());
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('form-disciplina').addEventListener('submit', guardarDisciplina);

  await cargarDisciplinas();
}

async function cargarDisciplinas() {
  try {
    const { disciplinas } = await api.get('/admin/disciplinas');
    renderizarTabla(disciplinas);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

function renderizarTabla(disciplinas) {
  const cuerpo = document.getElementById('tabla-disciplinas');
  document.getElementById('contador-disciplinas').textContent = `${disciplinas.length} disciplina(s)`;

  if (disciplinas.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="4">Todavía no hay disciplinas cargadas.</td></tr>';
    return;
  }

  const esAdmin = usuarioActual.rol === 'admin';

  cuerpo.innerHTML = disciplinas
    .map((d) => {
      const badge = d.estado === 'activo' ? 'badge--activo' : 'badge--inactivo';
      const accionesAdmin = esAdmin
        ? `
          <button class="boton boton--texto" onclick="editarDisciplina(${d.id})">Editar</button>
          ${
            d.estado === 'activo'
              ? `<button class="boton boton--texto" onclick="cambiarEstadoDisciplina(${d.id}, 'desactivar')">Desactivar</button>`
              : `<button class="boton boton--texto" onclick="cambiarEstadoDisciplina(${d.id}, 'reactivar')">Reactivar</button>`
          }
        `
        : '';
      return `
        <tr>
          <td>${escaparHtml(d.nombre)}</td>
          <td>${escaparHtml(d.descripcion || '-')}</td>
          <td><span class="badge ${badge}">${d.estado}</span></td>
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

let disciplinasCache = [];

function abrirModal(disciplina = null) {
  document.getElementById('modal-titulo').textContent = disciplina ? 'Editar disciplina' : 'Nueva disciplina';
  document.getElementById('disciplina-id').value = disciplina ? disciplina.id : '';
  document.getElementById('disciplina-nombre').value = disciplina ? disciplina.nombre : '';
  document.getElementById('disciplina-descripcion').value = disciplina ? disciplina.descripcion || '' : '';
  document.getElementById('modal-fondo').classList.remove('oculto');
}

function cerrarModal() {
  document.getElementById('modal-fondo').classList.add('oculto');
}

async function editarDisciplina(id) {
  try {
    const { disciplina } = await api.get(`/admin/disciplinas/${id}`);
    abrirModal(disciplina);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function guardarDisciplina(evento) {
  evento.preventDefault();
  const id = document.getElementById('disciplina-id').value;
  const nombre = document.getElementById('disciplina-nombre').value.trim();
  const descripcion = document.getElementById('disciplina-descripcion').value.trim();

  try {
    if (id) {
      await api.put(`/admin/disciplinas/${id}`, { nombre, descripcion });
      mostrarNotificacion('Disciplina actualizada', 'exito');
    } else {
      await api.post('/admin/disciplinas', { nombre, descripcion });
      mostrarNotificacion('Disciplina creada', 'exito');
    }
    cerrarModal();
    await cargarDisciplinas();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function cambiarEstadoDisciplina(id, accion) {
  const mensaje =
    accion === 'desactivar'
      ? '¿Desactivar esta disciplina? Los cursos existentes no se eliminan.'
      : '¿Reactivar esta disciplina?';
  if (!(await confirmarAccion(mensaje))) return;

  try {
    await api.patch(`/admin/disciplinas/${id}/${accion}`);
    mostrarNotificacion(`Disciplina ${accion === 'desactivar' ? 'desactivada' : 'reactivada'}`, 'exito');
    await cargarDisciplinas();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

iniciar();

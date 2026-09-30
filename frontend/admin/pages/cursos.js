let usuarioActual = null;
let disciplinasDisponibles = [];

async function iniciar() {
  usuarioActual = await inicializarLayout('cursos');
  if (!usuarioActual) return;

  if (usuarioActual.rol !== 'admin') {
    document.getElementById('btn-nuevo').classList.add('oculto');
  }

  document.getElementById('btn-nuevo').addEventListener('click', () => abrirModal());
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('form-curso').addEventListener('submit', guardarCurso);

  await cargarDisciplinasParaSelect();
  await cargarCursos();
}

// El backend no exige que la disciplina esté activa para crear un curso, así
// que el <select> tampoco filtra por estado (evita romper la edición de un
// curso cuya disciplina se desactivó después de creado).
async function cargarDisciplinasParaSelect() {
  try {
    const { disciplinas } = await api.get('/admin/disciplinas');
    disciplinasDisponibles = disciplinas;
    const select = document.getElementById('curso-disciplina');
    select.innerHTML = disciplinas
      .map((d) => `<option value="${d.id}">${escaparHtml(d.nombre)}${d.estado !== 'activo' ? ' (inactiva)' : ''}</option>`)
      .join('');
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function cargarCursos() {
  try {
    const { cursos } = await api.get('/admin/cursos');
    renderizarTabla(cursos);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

function renderizarTabla(cursos) {
  const cuerpo = document.getElementById('tabla-cursos');
  document.getElementById('contador-cursos').textContent = `${cursos.length} curso(s)`;

  if (cursos.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="4">Todavía no hay cursos cargados.</td></tr>';
    return;
  }

  const esAdmin = usuarioActual.rol === 'admin';

  cuerpo.innerHTML = cursos
    .map((c) => {
      const badge = c.estado === 'activo' ? 'badge--activo' : 'badge--inactivo';
      const accionesAdmin = esAdmin
        ? `
          <button class="boton boton--texto" onclick="editarCurso(${c.id})">Editar</button>
          ${
            c.estado === 'activo'
              ? `<button class="boton boton--texto" onclick="cambiarEstadoCurso(${c.id}, 'desactivar')">Desactivar</button>`
              : `<button class="boton boton--texto" onclick="cambiarEstadoCurso(${c.id}, 'reactivar')">Reactivar</button>`
          }
        `
        : '';
      return `
        <tr>
          <td>${escaparHtml(c.nombre)}</td>
          <td>${escaparHtml(c.disciplina_nombre)}</td>
          <td><span class="badge ${badge}">${c.estado}</span></td>
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

function abrirModal(curso = null) {
  document.getElementById('modal-titulo').textContent = curso ? 'Editar curso' : 'Nuevo curso';
  document.getElementById('curso-id').value = curso ? curso.id : '';
  document.getElementById('curso-nombre').value = curso ? curso.nombre : '';
  document.getElementById('curso-descripcion').value = curso ? curso.descripcion || '' : '';
  document.getElementById('curso-disciplina').value = curso ? curso.disciplina_id : '';
  document.getElementById('modal-fondo').classList.remove('oculto');
}

function cerrarModal() {
  document.getElementById('modal-fondo').classList.add('oculto');
}

async function editarCurso(id) {
  try {
    const { curso } = await api.get(`/admin/cursos/${id}`);
    abrirModal(curso);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function guardarCurso(evento) {
  evento.preventDefault();
  const id = document.getElementById('curso-id').value;
  const nombre = document.getElementById('curso-nombre').value.trim();
  const descripcion = document.getElementById('curso-descripcion').value.trim();
  const disciplinaId = Number(document.getElementById('curso-disciplina').value);

  try {
    if (id) {
      await api.put(`/admin/cursos/${id}`, { nombre, descripcion, disciplinaId });
      mostrarNotificacion('Curso actualizado', 'exito');
    } else {
      await api.post('/admin/cursos', { nombre, descripcion, disciplinaId });
      mostrarNotificacion('Curso creado', 'exito');
    }
    cerrarModal();
    await cargarCursos();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function cambiarEstadoCurso(id, accion) {
  const mensaje = accion === 'desactivar' ? '¿Desactivar este curso?' : '¿Reactivar este curso?';
  if (!(await confirmarAccion(mensaje))) return;

  try {
    await api.patch(`/admin/cursos/${id}/${accion}`);
    mostrarNotificacion(`Curso ${accion === 'desactivar' ? 'desactivado' : 'reactivado'}`, 'exito');
    await cargarCursos();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

iniciar();

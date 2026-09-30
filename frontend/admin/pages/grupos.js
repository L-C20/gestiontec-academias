let usuarioActual = null;
let disciplinasDisponibles = [];
let cursosDisponibles = [];
let nivelesDisponibles = [];
let profesoresDisponibles = [];
let periodosDisponibles = [];

async function iniciar() {
  usuarioActual = await inicializarLayout('grupos');
  if (!usuarioActual) return;

  if (usuarioActual.rol !== 'admin') {
    document.getElementById('btn-nuevo').classList.add('oculto');
  }

  document.getElementById('btn-nuevo').addEventListener('click', () => abrirModal());
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('form-grupo').addEventListener('submit', guardarGrupo);
  document.getElementById('grupo-disciplina').addEventListener('change', (e) => {
    actualizarCursosPorDisciplina(Number(e.target.value));
  });

  await cargarDatosDeReferencia();
  await cargarGrupos();
}

function opcion(id, etiqueta) {
  return `<option value="${id}">${escaparHtml(etiqueta)}</option>`;
}

// Trae todo lo que necesitan los <select> del modal, en paralelo.
async function cargarDatosDeReferencia() {
  try {
    const [d, c, n, p, per] = await Promise.all([
      api.get('/admin/disciplinas'),
      api.get('/admin/cursos'),
      api.get('/admin/niveles'),
      api.get('/admin/profesores'),
      api.get('/admin/periodos'),
    ]);
    disciplinasDisponibles = d.disciplinas;
    cursosDisponibles = c.cursos;
    nivelesDisponibles = n.niveles;
    profesoresDisponibles = p.profesores;
    periodosDisponibles = per.periodos;

    document.getElementById('grupo-disciplina').innerHTML = disciplinasDisponibles
      .map((x) => opcion(x.id, x.nombre + (x.estado !== 'activo' ? ' (inactiva)' : '')))
      .join('');
    document.getElementById('grupo-nivel').innerHTML =
      '<option value="">Sin especificar</option>' +
      nivelesDisponibles.map((x) => opcion(x.id, x.nombre)).join('');
    document.getElementById('grupo-profesor').innerHTML =
      '<option value="">Sin asignar</option>' +
      profesoresDisponibles.map((x) => opcion(x.id, `${x.nombre} ${x.apellido}`)).join('');
    document.getElementById('grupo-periodo').innerHTML = periodosDisponibles
      .map((x) => opcion(x.id, x.nombre))
      .join('');

    if (disciplinasDisponibles.length > 0) {
      actualizarCursosPorDisciplina(disciplinasDisponibles[0].id);
    }
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

// El <select> de curso se re-arma cada vez que cambia la disciplina elegida,
// mostrando solo los cursos que pertenecen a esa disciplina.
function actualizarCursosPorDisciplina(disciplinaId, cursoAPreseleccionar = null) {
  const cursosFiltrados = cursosDisponibles.filter((c) => c.disciplina_id === disciplinaId);
  const select = document.getElementById('grupo-curso');
  select.innerHTML = cursosFiltrados.map((c) => opcion(c.id, c.nombre)).join('');
  if (cursoAPreseleccionar && cursosFiltrados.some((c) => c.id === cursoAPreseleccionar)) {
    select.value = cursoAPreseleccionar;
  }
}

async function cargarGrupos() {
  try {
    const { grupos } = await api.get('/admin/grupos');
    renderizarTabla(grupos);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

function renderizarTabla(grupos) {
  const cuerpo = document.getElementById('tabla-grupos');
  document.getElementById('contador-grupos').textContent = `${grupos.length} grupo(s)`;

  if (grupos.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="7">Todavía no hay grupos cargados.</td></tr>';
    return;
  }

  const esAdmin = usuarioActual.rol === 'admin';

  cuerpo.innerHTML = grupos
    .map((g) => {
      const badge = g.estado === 'activo' ? 'badge--activo' : 'badge--inactivo';
      const accionesAdmin = esAdmin
        ? `
          <button class="boton boton--texto" onclick="editarGrupo(${g.id})">Editar</button>
          ${
            g.estado === 'activo'
              ? `<button class="boton boton--texto" onclick="cambiarEstadoGrupo(${g.id}, 'desactivar')">Desactivar</button>`
              : `<button class="boton boton--texto" onclick="cambiarEstadoGrupo(${g.id}, 'reactivar')">Reactivar</button>`
          }
        `
        : '';
      return `
        <tr>
          <td>${escaparHtml(g.nombre)}</td>
          <td>${escaparHtml(g.disciplina_nombre)} / ${escaparHtml(g.curso_nombre)}</td>
          <td>${escaparHtml(g.nivel_nombre || '-')}</td>
          <td>${g.profesor_nombre ? escaparHtml(g.profesor_nombre + ' ' + g.profesor_apellido) : '-'}</td>
          <td>${escaparHtml(g.periodo_nombre)}</td>
          <td><span class="badge ${badge}">${g.estado}</span></td>
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

function abrirModal(grupo = null) {
  document.getElementById('modal-titulo').textContent = grupo ? 'Editar grupo' : 'Nuevo grupo';
  document.getElementById('grupo-id').value = grupo ? grupo.id : '';
  document.getElementById('grupo-nombre').value = grupo ? grupo.nombre : '';
  document.getElementById('grupo-capacidad').value = grupo ? grupo.capacidad || '' : '';
  document.getElementById('grupo-nivel').value = grupo ? grupo.nivel_id || '' : '';
  document.getElementById('grupo-profesor').value = grupo ? grupo.profesor_id || '' : '';
  document.getElementById('grupo-periodo').value = grupo ? grupo.periodo_academico_id : '';

  const disciplinaId = grupo ? grupo.disciplina_id : disciplinasDisponibles[0]?.id;
  document.getElementById('grupo-disciplina').value = disciplinaId || '';
  actualizarCursosPorDisciplina(disciplinaId, grupo ? grupo.curso_id : null);

  document.getElementById('modal-fondo').classList.remove('oculto');
}

function cerrarModal() {
  document.getElementById('modal-fondo').classList.add('oculto');
}

async function editarGrupo(id) {
  try {
    const { grupo } = await api.get(`/admin/grupos/${id}`);
    abrirModal(grupo);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

function leerDatosFormulario() {
  const nivelId = document.getElementById('grupo-nivel').value;
  const profesorId = document.getElementById('grupo-profesor').value;
  const capacidad = document.getElementById('grupo-capacidad').value;
  return {
    nombre: document.getElementById('grupo-nombre').value.trim(),
    disciplinaId: Number(document.getElementById('grupo-disciplina').value),
    cursoId: Number(document.getElementById('grupo-curso').value),
    nivelId: nivelId ? Number(nivelId) : null,
    profesorId: profesorId ? Number(profesorId) : null,
    periodoAcademicoId: Number(document.getElementById('grupo-periodo').value),
    capacidad: capacidad ? Number(capacidad) : null,
  };
}

async function guardarGrupo(evento) {
  evento.preventDefault();
  const id = document.getElementById('grupo-id').value;
  const datos = leerDatosFormulario();

  try {
    if (id) {
      await api.put(`/admin/grupos/${id}`, datos);
      mostrarNotificacion('Grupo actualizado', 'exito');
    } else {
      await api.post('/admin/grupos', datos);
      mostrarNotificacion('Grupo creado', 'exito');
    }
    cerrarModal();
    await cargarGrupos();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function cambiarEstadoGrupo(id, accion) {
  const mensaje = accion === 'desactivar' ? '¿Desactivar este grupo?' : '¿Reactivar este grupo?';
  if (!(await confirmarAccion(mensaje))) return;

  try {
    await api.patch(`/admin/grupos/${id}/${accion}`);
    mostrarNotificacion(`Grupo ${accion === 'desactivar' ? 'desactivado' : 'reactivado'}`, 'exito');
    await cargarGrupos();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

iniciar();

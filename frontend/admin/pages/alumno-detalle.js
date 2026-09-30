let usuarioActual = null;
let alumnoId = null;
let inscripcionesDelAlumno = [];

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function formatearFecha(fechaIso) {
  return new Date(fechaIso).toLocaleDateString('es-AR', { timeZone: 'UTC' });
}

async function iniciar() {
  usuarioActual = await inicializarLayout('alumnos');
  if (!usuarioActual) return;

  alumnoId = new URLSearchParams(window.location.search).get('id');
  if (!alumnoId) {
    mostrarNotificacion('No se indicó qué alumno mostrar', 'error');
    return;
  }

  const esAdmin = usuarioActual.rol === 'admin';
  document.getElementById('btn-nueva-matricula').classList.toggle('oculto', !esAdmin);
  document.getElementById('btn-nueva-inscripcion').classList.toggle('oculto', !esAdmin);

  configurarTabs();
  configurarModales();

  await cargarFichaAlumno();
  await cargarMatriculas();
  await cargarInscripciones();
  await prepararTabAsistencias();
}

function configurarTabs() {
  document.querySelectorAll('.tab-boton').forEach((boton) => {
    boton.addEventListener('click', () => {
      document.querySelectorAll('.tab-boton').forEach((b) => b.classList.remove('activa'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('oculto'));
      boton.classList.add('activa');
      document.getElementById(`panel-${boton.dataset.tab}`).classList.remove('oculto');
    });
  });
}

function configurarModales() {
  document.getElementById('btn-nueva-matricula').addEventListener('click', abrirModalMatricula);
  document.getElementById('btn-cancelar-matricula').addEventListener('click', () =>
    document.getElementById('modal-matricula-fondo').classList.add('oculto')
  );
  document.getElementById('form-matricula').addEventListener('submit', guardarMatricula);

  document.getElementById('btn-nueva-inscripcion').addEventListener('click', abrirModalInscripcion);
  document.getElementById('btn-cancelar-inscripcion').addEventListener('click', () =>
    document.getElementById('modal-inscripcion-fondo').classList.add('oculto')
  );
  document.getElementById('form-inscripcion').addEventListener('submit', guardarInscripcion);

  document.getElementById('asistencias-inscripcion').addEventListener('change', (e) => cargarAsistencias(e.target.value));
  document.getElementById('form-asistencia').addEventListener('submit', registrarAsistencia);
}

async function cargarFichaAlumno() {
  try {
    const { alumno } = await api.get(`/admin/alumnos/${alumnoId}`);
    document.getElementById('alumno-titulo').textContent = `${alumno.nombre} ${alumno.apellido}`;
    document.getElementById('ficha-datos').innerHTML = `
      <div><span>Documento</span>${escaparHtml(alumno.documento || '-')}</div>
      <div><span>Email</span>${escaparHtml(alumno.email || '-')}</div>
      <div><span>Teléfono</span>${escaparHtml(alumno.telefono || '-')}</div>
      <div><span>Estado</span><span class="badge ${alumno.estado === 'activo' ? 'badge--activo' : 'badge--inactivo'}">${alumno.estado}</span></div>
    `;
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

// ---------- Matrículas ----------

async function cargarMatriculas() {
  try {
    const { matriculas } = await api.get('/admin/matriculas', { alumnoId });
    document.getElementById('contador-matriculas').textContent = `${matriculas.length} matrícula(s)`;
    const cuerpo = document.getElementById('tabla-matriculas');
    const esAdmin = usuarioActual.rol === 'admin';

    if (matriculas.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="5">Sin matrículas registradas.</td></tr>';
      return;
    }

    cuerpo.innerHTML = matriculas
      .map((m) => {
        const badge = m.estado === 'activa' ? 'badge--activo' : 'badge--inactivo';
        const acciones = esAdmin
          ? m.estado === 'activa'
            ? `<button class="boton boton--texto" onclick="darDeBajaMatricula(${m.id})">Dar de baja</button>`
            : `<button class="boton boton--texto" onclick="reactivarMatricula(${m.id})">Reactivar</button>`
          : '';
        return `
          <tr>
            <td>${escaparHtml(m.numero_matricula)}</td>
            <td>${escaparHtml(m.periodo_nombre)}</td>
            <td>${formatearFecha(m.fecha_alta)}</td>
            <td><span class="badge ${badge}">${m.estado}</span></td>
            <td>${acciones}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function abrirModalMatricula() {
  try {
    const { periodos } = await api.get('/admin/periodos');
    document.getElementById('matricula-periodo').innerHTML = periodos
      .map((p) => `<option value="${p.id}">${escaparHtml(p.nombre)}</option>`)
      .join('');
    document.getElementById('form-matricula').reset();
    document.getElementById('modal-matricula-fondo').classList.remove('oculto');
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function guardarMatricula(evento) {
  evento.preventDefault();
  const periodoAcademicoId = Number(document.getElementById('matricula-periodo').value);
  const numeroMatricula = document.getElementById('matricula-numero').value.trim();
  const observaciones = document.getElementById('matricula-observaciones').value.trim();

  try {
    await api.post('/admin/matriculas', { alumnoId, periodoAcademicoId, numeroMatricula, observaciones });
    mostrarNotificacion('Matrícula creada', 'exito');
    document.getElementById('modal-matricula-fondo').classList.add('oculto');
    await cargarMatriculas();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function darDeBajaMatricula(id) {
  if (!(await confirmarAccion('¿Dar de baja esta matrícula?'))) return;
  try {
    await api.patch(`/admin/matriculas/${id}/dar-de-baja`);
    mostrarNotificacion('Matrícula dada de baja', 'exito');
    await cargarMatriculas();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function reactivarMatricula(id) {
  if (!(await confirmarAccion('¿Reactivar esta matrícula?'))) return;
  try {
    await api.patch(`/admin/matriculas/${id}/reactivar`);
    mostrarNotificacion('Matrícula reactivada', 'exito');
    await cargarMatriculas();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

// ---------- Inscripciones ----------

async function cargarInscripciones() {
  try {
    const { inscripciones } = await api.get('/admin/inscripciones', { alumnoId });
    inscripcionesDelAlumno = inscripciones;
    document.getElementById('contador-inscripciones').textContent = `${inscripciones.length} inscripción(es)`;
    const cuerpo = document.getElementById('tabla-inscripciones');
    const esAdmin = usuarioActual.rol === 'admin';

    if (inscripciones.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="4">Sin inscripciones registradas.</td></tr>';
      return;
    }

    cuerpo.innerHTML = inscripciones
      .map((i) => {
        const badge = i.estado === 'activa' ? 'badge--activo' : 'badge--inactivo';
        const acciones =
          esAdmin && i.estado === 'activa'
            ? `
              <button class="boton boton--texto" onclick="finalizarInscripcion(${i.id})">Finalizar</button>
              <button class="boton boton--texto" onclick="cancelarInscripcion(${i.id})">Cancelar</button>
            `
            : '';
        return `
          <tr>
            <td>${escaparHtml(i.grupo_nombre)}</td>
            <td>${formatearFecha(i.fecha_inscripcion)}</td>
            <td><span class="badge ${badge}">${i.estado}</span></td>
            <td>${acciones}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function abrirModalInscripcion() {
  try {
    const { grupos } = await api.get('/admin/grupos');
    document.getElementById('inscripcion-grupo').innerHTML = grupos
      .map((g) => `<option value="${g.id}">${escaparHtml(g.nombre)} (${escaparHtml(g.disciplina_nombre)})</option>`)
      .join('');
    document.getElementById('modal-inscripcion-fondo').classList.remove('oculto');
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function guardarInscripcion(evento) {
  evento.preventDefault();
  const grupoId = Number(document.getElementById('inscripcion-grupo').value);

  try {
    await api.post('/admin/inscripciones', { alumnoId, grupoId });
    mostrarNotificacion('Alumno inscripto', 'exito');
    document.getElementById('modal-inscripcion-fondo').classList.add('oculto');
    await cargarInscripciones();
    await prepararTabAsistencias();
  } catch (err) {
    // Acá llegan los rechazos de "ya inscripto" o "grupo lleno"
    mostrarNotificacion(err.message, 'error');
  }
}

async function finalizarInscripcion(id) {
  if (!(await confirmarAccion('¿Finalizar esta inscripción?'))) return;
  try {
    await api.patch(`/admin/inscripciones/${id}/finalizar`);
    mostrarNotificacion('Inscripción finalizada', 'exito');
    await cargarInscripciones();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function cancelarInscripcion(id) {
  if (!(await confirmarAccion('¿Cancelar esta inscripción?'))) return;
  try {
    await api.patch(`/admin/inscripciones/${id}/cancelar`);
    mostrarNotificacion('Inscripción cancelada', 'exito');
    await cargarInscripciones();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

// ---------- Asistencias ----------

async function prepararTabAsistencias() {
  const select = document.getElementById('asistencias-inscripcion');
  if (inscripcionesDelAlumno.length === 0) {
    select.innerHTML = '<option value="">El alumno no tiene inscripciones</option>';
    document.getElementById('tabla-asistencias').innerHTML = '';
    document.getElementById('asistencias-resumen').textContent = '';
    return;
  }
  select.innerHTML = inscripcionesDelAlumno
    .map((i) => `<option value="${i.id}">${escaparHtml(i.grupo_nombre)} (${i.estado})</option>`)
    .join('');
  await cargarAsistencias(select.value);
}

async function cargarAsistencias(inscripcionId) {
  if (!inscripcionId) return;
  try {
    const [{ asistencias }, { resumen }] = await Promise.all([
      api.get(`/admin/inscripciones/${inscripcionId}/asistencias`),
      api.get(`/admin/inscripciones/${inscripcionId}/asistencias/resumen`),
    ]);

    document.getElementById('asistencias-resumen').textContent =
      resumen.total === 0
        ? 'Todavía no hay asistencias registradas.'
        : `${resumen.presentes} presentes, ${resumen.ausentes} ausentes, ${resumen.justificados} justificados — ${resumen.porcentajePresente}% de asistencia`;

    document.getElementById('tabla-asistencias').innerHTML =
      asistencias.length === 0
        ? '<tr><td colspan="3">Sin registros.</td></tr>'
        : asistencias
            .map(
              (a) => `
              <tr>
                <td>${formatearFecha(a.fecha)}</td>
                <td>${a.estado}</td>
                <td>${escaparHtml(a.observaciones || '-')}</td>
              </tr>
            `
            )
            .join('');
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function registrarAsistencia(evento) {
  evento.preventDefault();
  const inscripcionId = document.getElementById('asistencias-inscripcion').value;
  const fecha = document.getElementById('asistencia-fecha').value;
  const estado = document.getElementById('asistencia-estado').value;
  const observaciones = document.getElementById('asistencia-observaciones').value.trim();

  if (!inscripcionId) {
    mostrarNotificacion('El alumno no tiene ninguna inscripción para registrar asistencia', 'error');
    return;
  }

  try {
    await api.post(`/admin/inscripciones/${inscripcionId}/asistencias`, { fecha, estado, observaciones });
    mostrarNotificacion('Asistencia registrada', 'exito');
    document.getElementById('form-asistencia').reset();
    await cargarAsistencias(inscripcionId);
  } catch (err) {
    // Acá llega el error de "ya se registró la asistencia para esa fecha"
    mostrarNotificacion(err.message, 'error');
  }
}

iniciar();

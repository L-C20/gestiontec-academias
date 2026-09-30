let usuarioActual = null;

async function iniciar() {
  usuarioActual = await inicializarLayout('periodos');
  if (!usuarioActual) return;

  if (usuarioActual.rol !== 'admin') {
    document.getElementById('btn-nuevo').classList.add('oculto');
  }

  document.getElementById('btn-nuevo').addEventListener('click', () => abrirModal());
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('form-periodo').addEventListener('submit', guardarPeriodo);

  await cargarPeriodos();
}

async function cargarPeriodos() {
  try {
    const { periodos } = await api.get('/admin/periodos');
    renderizarTabla(periodos);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

function formatearFecha(fechaIso) {
  return new Date(fechaIso).toLocaleDateString('es-AR', { timeZone: 'UTC' });
}

function renderizarTabla(periodos) {
  const cuerpo = document.getElementById('tabla-periodos');
  document.getElementById('contador-periodos').textContent = `${periodos.length} período(s)`;

  if (periodos.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="5">Todavía no hay períodos cargados.</td></tr>';
    return;
  }

  const esAdmin = usuarioActual.rol === 'admin';

  cuerpo.innerHTML = periodos
    .map((p) => {
      const badge = p.activo ? 'badge--activo' : 'badge--inactivo';
      const estadoTexto = p.activo ? 'activo' : 'inactivo';
      const accionesAdmin = esAdmin
        ? `
          <button class="boton boton--texto" onclick="editarPeriodo(${p.id})">Editar</button>
          ${
            p.activo
              ? `<button class="boton boton--texto" onclick="cambiarActivoPeriodo(${p.id}, 'desactivar')">Desactivar</button>`
              : `<button class="boton boton--texto" onclick="cambiarActivoPeriodo(${p.id}, 'reactivar')">Reactivar</button>`
          }
        `
        : '';
      return `
        <tr>
          <td>${escaparHtml(p.nombre)}</td>
          <td>${formatearFecha(p.fecha_inicio)}</td>
          <td>${formatearFecha(p.fecha_fin)}</td>
          <td><span class="badge ${badge}">${estadoTexto}</span></td>
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

// Los <input type="date"> necesitan el valor en formato YYYY-MM-DD (sin hora).
function aFormatoInput(fechaIso) {
  return fechaIso.slice(0, 10);
}

function abrirModal(periodo = null) {
  document.getElementById('modal-titulo').textContent = periodo ? 'Editar período académico' : 'Nuevo período académico';
  document.getElementById('periodo-id').value = periodo ? periodo.id : '';
  document.getElementById('periodo-nombre').value = periodo ? periodo.nombre : '';
  document.getElementById('periodo-fecha-inicio').value = periodo ? aFormatoInput(periodo.fecha_inicio) : '';
  document.getElementById('periodo-fecha-fin').value = periodo ? aFormatoInput(periodo.fecha_fin) : '';
  document.getElementById('modal-fondo').classList.remove('oculto');
}

function cerrarModal() {
  document.getElementById('modal-fondo').classList.add('oculto');
}

async function editarPeriodo(id) {
  try {
    const { periodo } = await api.get(`/admin/periodos/${id}`);
    abrirModal(periodo);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function guardarPeriodo(evento) {
  evento.preventDefault();
  const id = document.getElementById('periodo-id').value;
  const nombre = document.getElementById('periodo-nombre').value.trim();
  const fechaInicio = document.getElementById('periodo-fecha-inicio').value;
  const fechaFin = document.getElementById('periodo-fecha-fin').value;

  try {
    if (id) {
      await api.put(`/admin/periodos/${id}`, { nombre, fechaInicio, fechaFin });
      mostrarNotificacion('Período actualizado', 'exito');
    } else {
      await api.post('/admin/periodos', { nombre, fechaInicio, fechaFin });
      mostrarNotificacion('Período creado', 'exito');
    }
    cerrarModal();
    await cargarPeriodos();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function cambiarActivoPeriodo(id, accion) {
  const mensaje = accion === 'desactivar' ? '¿Desactivar este período académico?' : '¿Reactivar este período académico?';
  if (!(await confirmarAccion(mensaje))) return;

  try {
    await api.patch(`/admin/periodos/${id}/${accion}`);
    mostrarNotificacion(`Período ${accion === 'desactivar' ? 'desactivado' : 'reactivado'}`, 'exito');
    await cargarPeriodos();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

iniciar();

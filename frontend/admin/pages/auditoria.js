let usuarioActual = null;
let registros = [];

const ACCIONES = {
  soporte_ingreso: 'Entró a la academia',
  soporte_modificacion: 'Modificó datos',
  academia_suspendida: 'Suspendió la academia',
  academia_reactivada: 'Reactivó la academia',
};

async function iniciar() {
  usuarioActual = await inicializarLayout('auditoria');
  if (!usuarioActual) return;

  if (usuarioActual.rol !== 'superadmin') {
    document.querySelector('.contenido').innerHTML =
      '<h1>Auditoría</h1><p class="sin-datos">Esta sección es solo del proveedor del sistema.</p>';
    return;
  }

  document.getElementById('filtro-academia').addEventListener('change', cargar);

  await cargarAcademiasParaFiltro();
  await cargar();
}

async function cargarAcademiasParaFiltro() {
  try {
    const { academias } = await api.get('/superadmin/academias');
    document.getElementById('filtro-academia').innerHTML =
      '<option value="">Todas</option>' +
      academias
        .map((a) => `<option value="${a.id}">${escaparHtml(a.nombre)}</option>`)
        .join('');
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function cargar() {
  const tenantId = document.getElementById('filtro-academia').value;

  try {
    const respuesta = await api.get('/superadmin/auditoria', tenantId ? { tenantId } : undefined);
    registros = respuesta.registros;
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

// `creado_en` es timestamptz, así que acá sí corresponde usar Date: el
// momento exacto importa y la zona del navegador es la correcta para leerlo.
function formatearMomento(valor) {
  if (!valor) return '';
  const fecha = new Date(valor);
  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderizar() {
  const cuerpo = document.getElementById('tabla');
  document.getElementById('contador').textContent = `${registros.length} registro(s)`;

  if (registros.length === 0) {
    cuerpo.innerHTML =
      '<tr><td colspan="4" class="sin-datos">Todavía no hay nada registrado.</td></tr>';
    return;
  }

  cuerpo.innerHTML = registros
    .map((r) => {
      const accion = ACCIONES[r.accion] || r.accion;

      // El detalle es el método y la ruta del request. Se muestra tal cual
      // porque es lo único que dice qué se tocó exactamente.
      const detalle = r.detalle
        ? `<div class="texto-tenue"><code>${escaparHtml(r.detalle)}</code></div>`
        : '';

      return `
        <tr>
          <td>${formatearMomento(r.creado_en)}</td>
          <td>${escaparHtml(r.usuario_email) || '<span class="texto-tenue">cuenta borrada</span>'}</td>
          <td>${escaparHtml(r.tenant_nombre) || '<span class="texto-tenue">academia borrada</span>'}</td>
          <td>
            ${escaparHtml(accion)}
            ${detalle}
          </td>
        </tr>
      `;
    })
    .join('');
}

iniciar();

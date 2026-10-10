let usuarioActual = null;
let tipos = [];

const ESCALAS_NUMERICAS = ['numerica_10', 'numerica_100', 'personalizada'];

const ETIQUETAS_ESCALA = {
  numerica_10: 'Nota de 1 a 10',
  numerica_100: 'Nota de 1 a 100',
  letras: 'Letras (A, B, C…)',
  aprobado_no_aprobado: 'Aprobado / Desaprobado',
  personalizada: 'Numérica, con otro máximo',
};

const UMBRAL_POR_DEFECTO = { numerica_10: 7, numerica_100: 60, personalizada: 7 };

async function iniciar() {
  usuarioActual = await inicializarLayout('tipos-evaluacion');
  if (!usuarioActual) return;

  if (usuarioActual.rol !== 'admin') {
    document.getElementById('btn-nuevo').classList.add('oculto');
  }

  document.getElementById('btn-nuevo').addEventListener('click', () => abrirModal());
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('form-tipo').addEventListener('submit', guardar);
  document.getElementById('tipo-escala').addEventListener('change', ajustarCamposSegunEscala);

  const select = document.getElementById('tipo-escala');
  select.innerHTML = Object.entries(ETIQUETAS_ESCALA)
    .map(([clave, etiqueta]) => `<option value="${clave}">${etiqueta}</option>`)
    .join('');

  await cargar();
}

async function cargar() {
  try {
    const respuesta = await api.get('/admin/tipos-evaluacion');
    tipos = respuesta.tipos;
    renderizar();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

// Cómo se lee la configuración de cada escala, en palabras y no en jsonb.
function describirAprobacion(tipo) {
  const config = tipo.configuracion || {};

  if (ESCALAS_NUMERICAS.includes(tipo.escala)) {
    const umbral = config.nota_aprobacion;
    return umbral !== undefined && umbral !== null
      ? `${umbral} o más`
      : `${UMBRAL_POR_DEFECTO[tipo.escala]} o más (por defecto)`;
  }

  const valores = config.valores_aprobados;
  return Array.isArray(valores) && valores.length > 0
    ? valores.map(escaparHtml).join(', ')
    : 'Aprobado (por defecto)';
}

function renderizar() {
  const cuerpo = document.getElementById('tabla');
  document.getElementById('contador').textContent = `${tipos.length} tipo(s)`;

  if (tipos.length === 0) {
    cuerpo.innerHTML =
      '<tr><td colspan="4" class="sin-datos">Todavía no hay tipos de evaluación. Creá al menos uno para poder cargar notas.</td></tr>';
    return;
  }

  const esAdmin = usuarioActual.rol === 'admin';

  cuerpo.innerHTML = tipos
    .map(
      (t) => `
      <tr>
        <td>${escaparHtml(t.nombre)}</td>
        <td>${escaparHtml(ETIQUETAS_ESCALA[t.escala] || t.escala)}</td>
        <td>${describirAprobacion(t)}</td>
        <td>${
          esAdmin
            ? `<button class="boton boton--texto" onclick="editar(${t.id})">Editar</button>
               <button class="boton boton--texto" onclick="eliminar(${t.id})">Borrar</button>`
            : ''
        }</td>
      </tr>
    `
    )
    .join('');
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto === null || texto === undefined ? '' : texto;
  return div.innerHTML;
}

function ajustarCamposSegunEscala() {
  const escala = document.getElementById('tipo-escala').value;
  const esNumerica = ESCALAS_NUMERICAS.includes(escala);

  document.getElementById('campo-umbral').classList.toggle('oculto', !esNumerica);
  document.getElementById('campo-valores').classList.toggle('oculto', esNumerica);

  if (esNumerica) {
    document.getElementById('ayuda-umbral').textContent =
      `Si lo dejás vacío se usa ${UMBRAL_POR_DEFECTO[escala]}.`;
  }
}

function abrirModal(tipo = null) {
  document.getElementById('modal-titulo').textContent = tipo
    ? 'Editar tipo de evaluación'
    : 'Nuevo tipo de evaluación';
  document.getElementById('tipo-id').value = tipo ? tipo.id : '';
  document.getElementById('tipo-nombre').value = tipo ? tipo.nombre : '';
  document.getElementById('tipo-escala').value = tipo ? tipo.escala : 'numerica_10';

  const config = (tipo && tipo.configuracion) || {};
  document.getElementById('tipo-umbral').value =
    config.nota_aprobacion !== undefined && config.nota_aprobacion !== null
      ? config.nota_aprobacion
      : '';
  document.getElementById('tipo-valores').value = Array.isArray(config.valores_aprobados)
    ? config.valores_aprobados.join(', ')
    : '';

  ajustarCamposSegunEscala();
  document.getElementById('modal-fondo').classList.remove('oculto');
}

function cerrarModal() {
  document.getElementById('modal-fondo').classList.add('oculto');
}

function editar(id) {
  abrirModal(tipos.find((t) => t.id === id));
}

function construirConfiguracion(escala) {
  if (ESCALAS_NUMERICAS.includes(escala)) {
    const valor = document.getElementById('tipo-umbral').value.trim();
    return valor === '' ? null : { nota_aprobacion: Number(valor) };
  }

  const valores = document.getElementById('tipo-valores').value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  return valores.length === 0 ? null : { valores_aprobados: valores };
}

async function guardar(evento) {
  evento.preventDefault();

  const id = document.getElementById('tipo-id').value;
  const escala = document.getElementById('tipo-escala').value;
  const cuerpo = {
    nombre: document.getElementById('tipo-nombre').value.trim(),
    escala,
    configuracion: construirConfiguracion(escala),
  };

  try {
    if (id) {
      await api.put(`/admin/tipos-evaluacion/${id}`, cuerpo);
      mostrarNotificacion('Tipo actualizado', 'exito');
    } else {
      await api.post('/admin/tipos-evaluacion', cuerpo);
      mostrarNotificacion('Tipo creado', 'exito');
    }
    cerrarModal();
    await cargar();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function eliminar(id) {
  const tipo = tipos.find((t) => t.id === id);
  if (!(await confirmarAccion(`¿Borrar "${tipo.nombre}"?`))) return;

  try {
    await api.delete(`/admin/tipos-evaluacion/${id}`);
    mostrarNotificacion('Tipo borrado', 'exito');
    await cargar();
  } catch (err) {
    // El backend devuelve 409 con el detalle si hay evaluaciones usándolo.
    mostrarNotificacion(err.message, 'error');
  }
}

iniciar();

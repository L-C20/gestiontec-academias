let usuarioActual = null;
let grupos = [];
let periodos = [];
let tiposEvaluacion = [];
let evaluaciones = [];
let planillaActual = null;

const ESCALAS_NUMERICAS = ['numerica_10', 'numerica_100', 'personalizada'];

async function iniciar() {
  usuarioActual = await inicializarLayout('evaluaciones');
  if (!usuarioActual) return;

  document.getElementById('btn-nueva').addEventListener('click', () => abrirModal());
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('form-evaluacion').addEventListener('submit', guardar);
  document.getElementById('filtro-grupo').addEventListener('change', cargarEvaluaciones);
  document.getElementById('filtro-periodo').addEventListener('change', cargarEvaluaciones);
  document.getElementById('btn-cerrar-planilla').addEventListener('click', cerrarPlanilla);
  document.getElementById('form-planilla').addEventListener('submit', guardarPlanilla);

  // El examen nunca es obligatorio para habilitarse a sí mismo.
  document.getElementById('eval-es-examen').addEventListener('change', ajustarObligatoria);

  await cargarCatalogos();
  await cargarEvaluaciones();
}

async function cargarCatalogos() {
  try {
    const [resGrupos, resPeriodos, resTipos] = await Promise.all([
      api.get('/admin/grupos'),
      api.get('/admin/periodos'),
      api.get('/admin/tipos-evaluacion'),
    ]);

    grupos = resGrupos.grupos;
    periodos = resPeriodos.periodos;
    tiposEvaluacion = resTipos.tipos;

    document.getElementById('filtro-grupo').innerHTML = grupos.length
      ? grupos.map((g) => `<option value="${g.id}">${escaparHtml(nombreGrupo(g))}</option>`).join('')
      : '<option value="">(no hay grupos)</option>';

    const opcionesPeriodo = periodos
      .map((p) => `<option value="${p.id}">${escaparHtml(p.nombre)}</option>`)
      .join('');

    document.getElementById('filtro-periodo').innerHTML =
      '<option value="">Todos los períodos</option>' + opcionesPeriodo;
    document.getElementById('eval-periodo').innerHTML = opcionesPeriodo;

    document.getElementById('eval-tipo').innerHTML = tiposEvaluacion.length
      ? tiposEvaluacion.map((t) => `<option value="${t.id}">${escaparHtml(t.nombre)}</option>`).join('')
      : '<option value="">(no hay tipos)</option>';

    if (tiposEvaluacion.length === 0) {
      mostrarNotificacion(
        'Primero creá un tipo de evaluación: define con qué se califica y desde dónde se aprueba.',
        'advertencia',
        7000
      );
    }
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

function nombreGrupo(g) {
  const partes = [g.nombre, g.curso_nombre];
  if (g.nivel_nombre) partes.push(g.nivel_nombre);
  return partes.filter(Boolean).join(' · ');
}

async function cargarEvaluaciones() {
  const grupoId = document.getElementById('filtro-grupo').value;
  if (!grupoId) {
    evaluaciones = [];
    renderizar();
    return;
  }

  const periodoId = document.getElementById('filtro-periodo').value;

  try {
    const respuesta = await api.get(
      `/admin/grupos/${grupoId}/evaluaciones`,
      periodoId ? { periodoAcademicoId: periodoId } : undefined
    );
    evaluaciones = respuesta.evaluaciones;
    renderizar();
  } catch (err) {
    evaluaciones = [];
    renderizar();
    mostrarNotificacion(err.message, 'error');
  }
}

// La fecha viene como ISO desde Postgres; cortar los 10 primeros caracteres
// evita que `new Date()` la corra un día por la zona horaria.
function formatearFecha(valor) {
  if (!valor) return '—';
  const [anio, mes, dia] = String(valor).slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

function etiquetasCuentaPara(e) {
  const etiquetas = [];
  if (e.es_examen) etiquetas.push('<span class="badge badge--excepcion">Examen</span>');
  if (e.obligatoria) etiquetas.push('<span class="badge badge--activo">Obligatoria</span>');
  if (e.computa_promedio) etiquetas.push('<span class="badge badge--pendiente">Promedia</span>');
  return etiquetas.length ? etiquetas.join(' ') : '<span class="texto-tenue">No incide</span>';
}

function renderizar() {
  const cuerpo = document.getElementById('tabla');
  document.getElementById('contador').textContent = `${evaluaciones.length} evaluación(es)`;

  if (evaluaciones.length === 0) {
    cuerpo.innerHTML =
      '<tr><td colspan="6" class="sin-datos">No hay evaluaciones para este grupo y período.</td></tr>';
    return;
  }

  cuerpo.innerHTML = evaluaciones
    .map((e) => {
      const falta = e.alumnos - e.cargados;
      const avance =
        falta > 0
          ? `${e.cargados} de ${e.alumnos} · <strong>faltan ${falta}</strong>`
          : `${e.cargados} de ${e.alumnos} · completo`;

      const promedio = e.promedio !== null ? ` · promedio ${e.promedio}` : '';

      return `
        <tr>
          <td>
            ${escaparHtml(e.nombre)}
            <div class="texto-tenue">${escaparHtml(e.periodo_nombre)}</div>
          </td>
          <td>${escaparHtml(e.tipo_nombre)}</td>
          <td>${formatearFecha(e.fecha)}</td>
          <td>${etiquetasCuentaPara(e)}</td>
          <td><span class="texto-tenue">${avance}${promedio}</span></td>
          <td>
            <button class="boton boton--texto" onclick="abrirPlanilla(${e.id})">Cargar notas</button>
            <button class="boton boton--texto" onclick="editar(${e.id})">Editar</button>
            <button class="boton boton--texto" onclick="eliminar(${e.id})">Borrar</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto === null || texto === undefined ? '' : texto;
  return div.innerHTML;
}

/* ---------- alta y edición ---------- */

function ajustarObligatoria() {
  const esExamen = document.getElementById('eval-es-examen').checked;
  const obligatoria = document.getElementById('eval-obligatoria');

  obligatoria.disabled = esExamen;
  if (esExamen) obligatoria.checked = false;

  document.getElementById('ayuda-obligatoria').textContent = esExamen
    ? 'El examen no puede ser requisito de sí mismo.'
    : 'Si no está aprobada, el alumno no se habilita a rendir.';
}

function abrirModal(evaluacion = null) {
  document.getElementById('modal-titulo').textContent = evaluacion
    ? 'Editar evaluación'
    : 'Nueva evaluación';
  document.getElementById('eval-id').value = evaluacion ? evaluacion.id : '';
  document.getElementById('eval-nombre').value = evaluacion ? evaluacion.nombre : '';
  document.getElementById('eval-consigna').value = evaluacion ? evaluacion.consigna || '' : '';
  document.getElementById('eval-fecha').value = evaluacion && evaluacion.fecha
    ? String(evaluacion.fecha).slice(0, 10)
    : '';
  document.getElementById('eval-es-examen').checked = evaluacion ? evaluacion.es_examen : false;
  document.getElementById('eval-obligatoria').checked = evaluacion ? evaluacion.obligatoria : true;
  document.getElementById('eval-computa').checked = evaluacion
    ? evaluacion.computa_promedio
    : true;

  if (evaluacion) {
    document.getElementById('eval-tipo').value = evaluacion.tipo_evaluacion_id;
    document.getElementById('eval-periodo').value = evaluacion.periodo_academico_id;
  } else {
    const periodoFiltrado = document.getElementById('filtro-periodo').value;
    if (periodoFiltrado) document.getElementById('eval-periodo').value = periodoFiltrado;
  }

  ajustarObligatoria();
  document.getElementById('modal-fondo').classList.remove('oculto');
}

function cerrarModal() {
  document.getElementById('modal-fondo').classList.add('oculto');
}

function editar(id) {
  abrirModal(evaluaciones.find((e) => e.id === id));
}

async function guardar(evento) {
  evento.preventDefault();

  const id = document.getElementById('eval-id').value;
  const grupoId = document.getElementById('filtro-grupo').value;

  const cuerpo = {
    nombre: document.getElementById('eval-nombre').value.trim(),
    tipoEvaluacionId: Number(document.getElementById('eval-tipo').value),
    periodoAcademicoId: Number(document.getElementById('eval-periodo').value),
    fecha: document.getElementById('eval-fecha').value || null,
    consigna: document.getElementById('eval-consigna').value.trim(),
    esExamen: document.getElementById('eval-es-examen').checked,
    obligatoria: document.getElementById('eval-obligatoria').checked,
    computaPromedio: document.getElementById('eval-computa').checked,
  };

  try {
    if (id) {
      await api.put(`/admin/evaluaciones/${id}`, cuerpo);
      mostrarNotificacion('Evaluación actualizada', 'exito');
    } else {
      await api.post(`/admin/grupos/${grupoId}/evaluaciones`, cuerpo);
      mostrarNotificacion('Evaluación creada', 'exito');
    }
    cerrarModal();
    await cargarEvaluaciones();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function eliminar(id) {
  const evaluacion = evaluaciones.find((e) => e.id === id);

  const aviso =
    evaluacion.cargados > 0
      ? `¿Borrar "${evaluacion.nombre}"? Se van a perder las ${evaluacion.cargados} nota(s) ya cargadas.`
      : `¿Borrar "${evaluacion.nombre}"?`;

  if (!(await confirmarAccion(aviso))) return;

  try {
    await api.delete(`/admin/evaluaciones/${id}`);
    mostrarNotificacion('Evaluación borrada', 'exito');
    await cargarEvaluaciones();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

/* ---------- planilla ---------- */

async function abrirPlanilla(evaluacionId) {
  try {
    const { evaluacion, resultados } = await api.get(
      `/admin/evaluaciones/${evaluacionId}/resultados`
    );
    planillaActual = evaluacion;

    const esNumerica = ESCALAS_NUMERICAS.includes(evaluacion.escala);

    document.getElementById('planilla-titulo').textContent = evaluacion.nombre;
    document.getElementById('planilla-bajada').textContent =
      `${evaluacion.grupo_nombre} · ${evaluacion.periodo_nombre} · ${evaluacion.tipo_nombre}`;
    document.getElementById('planilla-encabezado-nota').textContent = esNumerica
      ? 'Nota'
      : 'Resultado';

    renderizarPlanilla(resultados, evaluacion, esNumerica);
    document.getElementById('modal-planilla').classList.remove('oculto');
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

function renderizarPlanilla(resultados, evaluacion, esNumerica) {
  const cuerpo = document.getElementById('planilla-cuerpo');

  if (resultados.length === 0) {
    cuerpo.innerHTML =
      '<tr><td colspan="5" class="sin-datos">Este grupo no tiene alumnos con inscripción activa.</td></tr>';
    return;
  }

  // Para las escalas de texto se ofrecen los valores que cuentan como
  // aprobado, pero sin forzarlos: el profesor también tiene que poder
  // escribir un "Desaprobado" o lo que use la academia.
  const config = evaluacion.configuracion || {};
  const sugeridos = Array.isArray(config.valores_aprobados)
    ? config.valores_aprobados
    : ['Aprobado'];

  document.getElementById('planilla-sugerencias').innerHTML = esNumerica
    ? ''
    : `<datalist id="valores-sugeridos">${sugeridos
        .map((v) => `<option value="${escaparHtml(v)}"></option>`)
        .join('')}</datalist>`;

  cuerpo.innerHTML =
    resultados
      .map((r) => {
        const campoNota = esNumerica
          ? `<input type="number" step="0.01" min="0" data-campo="numero"
                    value="${r.resultado_numerico !== null ? r.resultado_numerico : ''}" />`
          : `<input type="text" list="valores-sugeridos" data-campo="texto"
                    value="${escaparHtml(r.resultado_texto)}" />`;

        const estado =
          r.aprobada === true
            ? '<span class="badge badge--habilitado">Aprobada</span>'
            : r.resultado_id === null
              ? '<span class="texto-tenue">sin cargar</span>'
              : '<span class="badge badge--adeuda">No aprobada</span>';

        return `
          <tr data-inscripcion="${r.inscripcion_id}">
            <td>${escaparHtml(`${r.apellido}, ${r.nombre}`)}</td>
            <td class="col-angosta">${campoNota}</td>
            <td class="col-chica">
              <input type="checkbox" data-campo="ausente" ${r.ausente ? 'checked' : ''} />
            </td>
            <td><input type="text" data-campo="observaciones" value="${escaparHtml(r.observaciones)}" /></td>
            <td class="col-chica">${estado}</td>
          </tr>
        `;
      })
      .join('');
}

function cerrarPlanilla() {
  document.getElementById('modal-planilla').classList.add('oculto');
  planillaActual = null;
}

async function guardarPlanilla(evento) {
  evento.preventDefault();
  if (!planillaActual) return;

  const filas = Array.from(
    document.querySelectorAll('#planilla-cuerpo tr[data-inscripcion]')
  ).map((fila) => {
    const leer = (campo) => fila.querySelector(`[data-campo="${campo}"]`);
    const numero = leer('numero');
    const texto = leer('texto');

    return {
      inscripcionId: Number(fila.dataset.inscripcion),
      resultadoNumerico: numero && numero.value !== '' ? Number(numero.value) : null,
      resultadoTexto: texto ? texto.value.trim() : null,
      ausente: leer('ausente').checked,
      observaciones: leer('observaciones').value.trim(),
    };
  });

  try {
    const { resumen, resultados } = await api.put(
      `/admin/evaluaciones/${planillaActual.id}/resultados`,
      { resultados: filas }
    );

    const partes = [];
    if (resumen.guardados > 0) partes.push(`${resumen.guardados} cargada(s)`);
    if (resumen.borrados > 0) partes.push(`${resumen.borrados} vaciada(s)`);
    mostrarNotificacion(
      partes.length ? `Planilla guardada: ${partes.join(', ')}` : 'No había cambios',
      'exito'
    );

    const esNumerica = ESCALAS_NUMERICAS.includes(planillaActual.escala);
    renderizarPlanilla(resultados, planillaActual, esNumerica);
    await cargarEvaluaciones();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

iniciar();

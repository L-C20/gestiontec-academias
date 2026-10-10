let usuarioActual = null;
let grupos = [];
let periodos = [];
let alumnos = [];

async function iniciar() {
  usuarioActual = await inicializarLayout('habilitacion');
  if (!usuarioActual) return;

  document.getElementById('filtro-grupo').addEventListener('change', cargar);
  document.getElementById('filtro-periodo').addEventListener('change', cargar);
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('btn-quitar').addEventListener('click', quitarExcepcion);
  document.getElementById('form-excepcion').addEventListener('submit', guardarExcepcion);

  await cargarCatalogos();
  await cargar();
}

async function cargarCatalogos() {
  try {
    const [resGrupos, resPeriodos] = await Promise.all([
      api.get('/admin/grupos'),
      api.get('/admin/periodos'),
    ]);

    grupos = resGrupos.grupos;
    periodos = resPeriodos.periodos;

    document.getElementById('filtro-grupo').innerHTML = grupos.length
      ? grupos.map((g) => `<option value="${g.id}">${escaparHtml(nombreGrupo(g))}</option>`).join('')
      : '<option value="">(no hay grupos)</option>';

    // Acá el período no puede quedar en "todos": la habilitación es siempre
    // de un período concreto.
    document.getElementById('filtro-periodo').innerHTML = periodos.length
      ? periodos.map((p) => `<option value="${p.id}">${escaparHtml(p.nombre)}</option>`).join('')
      : '<option value="">(no hay períodos)</option>';
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

function nombreGrupo(g) {
  const partes = [g.nombre, g.curso_nombre];
  if (g.nivel_nombre) partes.push(g.nivel_nombre);
  return partes.filter(Boolean).join(' · ');
}

async function cargar() {
  const grupoId = document.getElementById('filtro-grupo').value;
  const periodoId = document.getElementById('filtro-periodo').value;

  if (!grupoId || !periodoId) {
    alumnos = [];
    renderizar();
    return;
  }

  try {
    const respuesta = await api.get(`/admin/grupos/${grupoId}/habilitacion`, {
      periodoAcademicoId: periodoId,
    });
    alumnos = respuesta.alumnos;
    renderizar();
  } catch (err) {
    alumnos = [];
    renderizar();
    mostrarNotificacion(err.message, 'error');
  }
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto === null || texto === undefined ? '' : texto;
  return div.innerHTML;
}

// Se corta la cadena ISO en lugar de usar `new Date()`, que por zona horaria
// muestra el día anterior.
function formatearFecha(valor) {
  if (!valor) return '';
  const [anio, mes, dia] = String(valor).slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

// La redacción importa: "Habilitado — 0 de 0 obligatorias aprobadas" se lee
// como un error del sistema. Si habilita solo la excepción, se dice eso.
function describirEstado(a) {
  if (a.porExcepcion) {
    return '<span class="badge badge--excepcion">Por excepción</span>';
  }
  if (a.habilitado) {
    return '<span class="badge badge--habilitado">Habilitado</span>';
  }
  if (a.obligatorias === 0) {
    return '<span class="badge badge--pendiente">Sin obligatorias cargadas</span>';
  }
  return '<span class="badge badge--adeuda">No habilitado</span>';
}

function describirObligatorias(a) {
  if (a.obligatorias === 0) {
    return '<span class="texto-tenue">el grupo no tiene obligatorias en este período</span>';
  }
  return `${a.aprobadas} de ${a.obligatorias} aprobadas`;
}

function renderizar() {
  const cuerpo = document.getElementById('tabla');
  document.getElementById('contador').textContent = `${alumnos.length} alumno(s)`;

  const habilitados = alumnos.filter((a) => a.habilitado).length;
  document.getElementById('resumen').textContent = alumnos.length
    ? `${habilitados} habilitado(s), ${alumnos.length - habilitados} sin habilitar`
    : '';

  if (alumnos.length === 0) {
    cuerpo.innerHTML =
      '<tr><td colspan="5" class="sin-datos">Elegí un grupo y un período con alumnos inscriptos.</td></tr>';
    return;
  }

  const esAdmin = usuarioActual.rol === 'admin';

  cuerpo.innerHTML = alumnos
    .map((a) => {
      const adeuda = a.adeuda && a.adeuda.length
        ? `<div class="lista-adeuda">${a.adeuda
            .map((nombre) => `<span>${escaparHtml(nombre)}</span>`)
            .join('')}</div>`
        : '<span class="texto-tenue">—</span>';

      // Quién firmó y cuándo va junto al motivo: una dispensa sin responsable
      // a la vista no se puede revisar.
      const excepcion = a.excepcion
        ? `<div class="texto-tenue">
             Excepción: ${escaparHtml(a.excepcion.motivo)}
             ${
               a.excepcion.autorizadoPor
                 ? ` — autorizó ${escaparHtml(a.excepcion.autorizadoPor)}`
                 : ''
             }${a.excepcion.fecha ? ` el ${formatearFecha(a.excepcion.fecha)}` : ''}
           </div>`
        : '';

      const acciones = esAdmin
        ? `<button class="boton boton--texto" onclick="abrirModal(${a.inscripcionId})">
             ${a.excepcion ? 'Ver / editar excepción' : 'Habilitar por excepción'}
           </button>`
        : '';

      return `
        <tr>
          <td>
            ${escaparHtml(`${a.apellido}, ${a.nombre}`)}
            ${excepcion}
          </td>
          <td>${describirEstado(a)}</td>
          <td>${describirObligatorias(a)}</td>
          <td>${adeuda}</td>
          <td>${acciones}</td>
        </tr>
      `;
    })
    .join('');
}

/* ---------- excepción ---------- */

function abrirModal(inscripcionId) {
  const alumno = alumnos.find((a) => a.inscripcionId === inscripcionId);
  if (!alumno) return;

  document.getElementById('exc-inscripcion').value = inscripcionId;
  document.getElementById('exc-alumno').value = `${alumno.apellido}, ${alumno.nombre}`;
  document.getElementById('exc-motivo').value = alumno.excepcion ? alumno.excepcion.motivo : '';
  document.getElementById('modal-titulo').textContent = alumno.excepcion
    ? 'Excepción cargada'
    : 'Habilitar por excepción';
  document.getElementById('btn-quitar').classList.toggle('oculto', !alumno.excepcion);
  document.getElementById('modal-fondo').classList.remove('oculto');
}

function cerrarModal() {
  document.getElementById('modal-fondo').classList.add('oculto');
}

async function guardarExcepcion(evento) {
  evento.preventDefault();

  const inscripcionId = document.getElementById('exc-inscripcion').value;
  const periodoAcademicoId = Number(document.getElementById('filtro-periodo').value);
  const motivo = document.getElementById('exc-motivo').value.trim();

  try {
    await api.put(`/admin/inscripciones/${inscripcionId}/excepcion`, {
      periodoAcademicoId,
      motivo,
    });
    mostrarNotificacion('Excepción guardada', 'exito');
    cerrarModal();
    await cargar();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

async function quitarExcepcion() {
  const inscripcionId = document.getElementById('exc-inscripcion').value;
  const periodoAcademicoId = document.getElementById('filtro-periodo').value;

  if (!(await confirmarAccion('¿Quitar la excepción? El alumno vuelve a depender de sus notas.')))
    return;

  try {
    await api.delete(
      `/admin/inscripciones/${inscripcionId}/excepcion?periodoAcademicoId=${periodoAcademicoId}`
    );
    mostrarNotificacion('Excepción quitada', 'exito');
    cerrarModal();
    await cargar();
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
}

iniciar();

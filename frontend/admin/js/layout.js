// El menú de una academia: lo ven su admin y sus profesores, y también el
// superadmin mientras está adentro en modo soporte.
const MODULOS_MENU = [
  { clave: 'alumnos', etiqueta: 'Alumnos', href: 'alumnos.html' },
  { clave: 'matriculas', etiqueta: 'Matrículas', href: 'matriculas.html' },
  { clave: 'inscripciones', etiqueta: 'Inscripciones', href: 'inscripciones.html' },
  { clave: 'profesores', etiqueta: 'Profesores / Instructores', href: 'profesores.html' },
  { clave: 'disciplinas', etiqueta: 'Disciplinas', href: 'disciplinas.html' },
  { clave: 'cursos', etiqueta: 'Cursos', href: 'cursos.html' },
  { clave: 'niveles', etiqueta: 'Niveles', href: 'niveles.html' },
  { clave: 'grupos', etiqueta: 'Grupos', href: 'grupos.html' },
  { clave: 'periodos', etiqueta: 'Períodos académicos', href: 'periodos.html' },
  { clave: 'evaluaciones', etiqueta: 'Evaluaciones', href: 'evaluaciones.html' },
  { clave: 'habilitacion', etiqueta: 'Habilitación al examen', href: 'habilitacion.html' },
  { clave: 'tipos-evaluacion', etiqueta: 'Tipos de evaluación', href: 'tipos-evaluacion.html' },
];

// El panel del proveedor: no administra alumnos, administra academias.
const MODULOS_PROVEEDOR = [
  { clave: 'academias', etiqueta: 'Academias', href: 'academias.html' },
  { clave: 'auditoria', etiqueta: 'Auditoría', href: 'auditoria.html' },
];

function escaparTexto(valor) {
  const div = document.createElement('div');
  div.textContent = valor === null || valor === undefined ? '' : valor;
  return div.innerHTML;
}

/**
 * Se llama al principio de cada página del panel. Además de armar el menú,
 * funciona como guardián de sesión: si /auth/me falla (401), redirige a login.
 * Devuelve el usuario logueado para que la página lo use si lo necesita.
 */
async function inicializarLayout(paginaActiva) {
  let usuario;
  try {
    const respuesta = await api.get('/auth/me');
    usuario = respuesta.usuario;
  } catch (err) {
    window.location.href = 'login.html';
    return null;
  }

  // El superadmin en su propia cuenta ve el panel de proveedor. Cuando entra
  // a una academia ve el menú de esa academia, como lo ve su gente.
  const esProveedorEnSuCasa = usuario.rol === 'superadmin' && !usuario.soporte;
  const modulos = esProveedorEnSuCasa ? MODULOS_PROVEEDOR : MODULOS_MENU;

  const enlaces = modulos
    .map(
      (m) =>
        `<a href="${m.href}" class="${m.clave === paginaActiva ? 'activo' : ''}">${m.etiqueta}</a>`
    )
    .join('');

  // Si el superadmin entró a una academia ajena, tiene que saberlo en todo
  // momento: lo que toque acá lo está tocando en los datos de otra persona.
  const avisoSoporte = usuario.soporte
    ? `<a href="academias.html" class="sidebar__soporte">Estás en ${escaparTexto(
        usuario.academia ? usuario.academia.nombre : 'otra academia'
      )} · volver</a>`
    : '';

  const contenedor = document.getElementById('sidebar-container');
  contenedor.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar__marca">GESTIONTEC</div>
      ${avisoSoporte}
      <nav class="sidebar__nav">${enlaces}</nav>
      <div class="sidebar__footer">
        <button class="boton boton--secundario" id="btn-logout">Cerrar sesión (${escaparTexto(
          usuario.rol
        )})</button>
      </div>
    </aside>
  `;

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await api.post('/auth/logout');
    window.location.href = 'login.html';
  });

  return usuario;
}

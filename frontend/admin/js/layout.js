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
];

// Se llama al principio de cada página del panel. Además de armar el menú,
// funciona como guardián de sesión: si /auth/me falla (401), redirige a login.
// Devuelve el usuario logueado para que la página lo use si lo necesita.
async function inicializarLayout(paginaActiva) {
  let usuario;
  try {
    const respuesta = await api.get('/auth/me');
    usuario = respuesta.usuario;
  } catch (err) {
    window.location.href = 'login.html';
    return null;
  }

  const enlaces = MODULOS_MENU.map(
    (m) => `<a href="${m.href}" class="${m.clave === paginaActiva ? 'activo' : ''}">${m.etiqueta}</a>`
  ).join('');

  const contenedor = document.getElementById('sidebar-container');
  contenedor.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar__marca">GESTIONTEC</div>
      <nav class="sidebar__nav">${enlaces}</nav>
      <div class="sidebar__footer">
        <button class="boton boton--secundario" id="btn-logout">Cerrar sesión (${usuario.rol})</button>
      </div>
    </aside>
  `;

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await api.post('/auth/logout');
    window.location.href = 'login.html';
  });

  return usuario;
}

document.getElementById('form-registro').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const nombreAcademia = document.getElementById('nombreAcademia').value.trim();
  const slug = document.getElementById('slug').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    await api.post('/auth/registro-tenant', { nombreAcademia, slug, email, password });
    mostrarNotificacion('Academia creada correctamente. Ya podés iniciar sesión.', 'exito');
    setTimeout(() => {
      window.location.href = `login.html?slug=${encodeURIComponent(slug)}`;
    }, 1200);
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
});

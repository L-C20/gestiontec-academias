// Si venimos desde el registro con ?slug=..., lo precargamos.
const parametros = new URLSearchParams(window.location.search);
const slugPrecargado = parametros.get('slug');
if (slugPrecargado) {
  document.getElementById('slug').value = slugPrecargado;
}

document.getElementById('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const slug = document.getElementById('slug').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    await api.post('/auth/login', { slug, email, password });
    window.location.href = 'alumnos.html';
  } catch (err) {
    mostrarNotificacion(err.message, 'error');
  }
});

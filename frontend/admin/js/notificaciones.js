function obtenerContenedorNotificaciones() {
  let contenedor = document.getElementById('contenedor-notificaciones');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'contenedor-notificaciones';
    document.body.appendChild(contenedor);
  }
  return contenedor;
}

// tipo: 'exito' | 'error' | 'advertencia' | 'info'
function mostrarNotificacion(mensaje, tipo = 'info', duracionMs = 4000) {
  const contenedor = obtenerContenedorNotificaciones();
  const div = document.createElement('div');
  div.className = `notificacion notificacion--${tipo}`;
  div.textContent = mensaje;
  contenedor.appendChild(div);
  setTimeout(() => div.remove(), duracionMs);
}

// Confirmación simple pero sin usar el confirm() nativo del navegador,
// para mantener la misma identidad visual que el resto de la app.
function confirmarAccion(mensaje) {
  return new Promise((resolve) => {
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    fondo.innerHTML = `
      <div class="modal-caja">
        <h2>Confirmar acción</h2>
        <p>${mensaje}</p>
        <div class="modal-acciones">
          <button class="boton boton--secundario" data-accion="cancelar">Cancelar</button>
          <button class="boton boton--peligro" data-accion="confirmar">Confirmar</button>
        </div>
      </div>
    `;
    document.body.appendChild(fondo);
    fondo.addEventListener('click', (e) => {
      if (e.target.dataset.accion === 'confirmar') {
        fondo.remove();
        resolve(true);
      } else if (e.target.dataset.accion === 'cancelar' || e.target === fondo) {
        fondo.remove();
        resolve(false);
      }
    });
  });
}

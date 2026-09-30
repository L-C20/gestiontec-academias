const API_BASE_URL = 'http://localhost:3000';

// Todas las llamadas al backend pasan por acá. `credentials: 'include'` es
// lo que hace que el navegador mande la cookie httpOnly del JWT en cada request.
async function apiFetch(ruta, { method = 'GET', body, params } = {}) {
  let url = `${API_BASE_URL}${ruta}`;
  if (params) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    if (query) url += `?${query}`;
  }

  const respuesta = await fetch(url, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (respuesta.status === 204) return null;

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch (e) {
    // respuesta sin body (ej. algunos errores de red) — se maneja abajo
  }

  if (!respuesta.ok) {
    const mensaje = (datos && datos.error) || `Error inesperado (HTTP ${respuesta.status})`;
    const error = new Error(mensaje);
    error.status = respuesta.status;
    throw error;
  }

  return datos;
}

const api = {
  get: (ruta, params) => apiFetch(ruta, { params }),
  post: (ruta, body) => apiFetch(ruta, { method: 'POST', body }),
  put: (ruta, body) => apiFetch(ruta, { method: 'PUT', body }),
  patch: (ruta, body) => apiFetch(ruta, { method: 'PATCH', body }),
  delete: (ruta) => apiFetch(ruta, { method: 'DELETE' }),
};

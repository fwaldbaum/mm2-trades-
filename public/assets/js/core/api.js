/** Cliente HTTP de la API. Traduce los errores del servidor a excepciones. */

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || 'Error de red');
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(method, path, { body, query } = {}) {
  let url = `/api${path}`;
  if (query) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    if (qs) url += `?${qs}`;
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(0, 'network_error', 'No se pudo conectar con el servidor. Revisa tu conexion.');
  }

  let payload = null;
  try { payload = await res.json(); } catch { payload = null; }

  if (!res.ok || !payload || payload.ok === false) {
    const err = (payload && payload.error) || {};
    throw new ApiError(res.status, err.code || 'error', err.message || `Error ${res.status}`, err.details);
  }
  return payload.data;
}

export const api = {
  get:   (path, query) => request('GET', path, { query }),
  post:  (path, body) => request('POST', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  del:   (path) => request('DELETE', path),

  // --- Sesion ---
  session:  () => request('GET', '/auth/session'),
  login:    (identifier, password) => request('POST', '/auth/login', { body: { identifier, password } }),
  register: (payload) => request('POST', '/auth/register', { body: payload }),
  logout:   () => request('POST', '/auth/logout'),
  changePassword: (current, next) =>
    request('POST', '/auth/password', { body: { current_password: current, new_password: next } }),

  // --- Programa y perfil ---
  program:   () => request('GET', '/program'),
  me:        () => request('GET', '/me'),
  dashboard: (range) => request('GET', '/me/dashboard', { query: { range } }),
  updateProfile: (patch) => request('PATCH', '/me', { body: patch }),
  balance:   () => request('GET', '/me/balance'),
  performance: (range) => request('GET', '/me/performance', { query: { range } }),
  codeUsage: (granularity) => request('GET', '/me/code', { query: { granularity } }),
  earnings:  (query) => request('GET', '/me/earnings', { query }),
  activity:  (limit) => request('GET', '/me/activity', { query: { limit } }),

  // --- Contenido ---
  submissionMeta: () => request('GET', '/submissions/meta'),
  submissions: (query) => request('GET', '/submissions', { query }),
  submission: (id) => request('GET', `/submissions/${id}`),
  estimate: (views, contentType) =>
    request('GET', '/submissions/estimate', { query: { views, content_type: contentType } }),
  submitVideo: (payload) => request('POST', '/submissions', { body: payload }),

  // --- Retiros ---
  withdrawalMeta: () => request('GET', '/withdrawals/meta'),
  withdrawals: (query) => request('GET', '/withdrawals', { query }),
  requestWithdrawal: (payload) => request('POST', '/withdrawals', { body: payload }),
  cancelWithdrawal: (id) => request('POST', `/withdrawals/${id}/cancel`),

  // --- Catalogo y tiers ---
  items: () => request('GET', '/items'),
  tiers: () => request('GET', '/tiers'),

  // --- Notificaciones ---
  notifications: (limit) => request('GET', '/notifications', { query: { limit } }),
  readAllNotifications: () => request('POST', '/notifications/read'),
  readNotification: (id) => request('POST', `/notifications/${id}/read`),

  // --- Verificacion de Roblox ---
  verification: () => request('GET', '/roblox-verification'),
  requestVerification: (username) =>
    request('POST', '/roblox-verification', { body: { roblox_username: username } })
};

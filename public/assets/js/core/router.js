/** Router del cliente basado en la History API. */

const routes = new Map();
let notFoundHandler = null;
let currentCleanup = null;
let outlet = null;

export function defineRoutes(map, { notFound = null } = {}) {
  Object.entries(map).forEach(([path, handler]) => routes.set(path, handler));
  notFoundHandler = notFound;
}

export function setOutlet(node) { outlet = node; }

export function navigate(path, { replace = false } = {}) {
  if (path === location.pathname + location.search) return render();
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  return render();
}

export function currentPath() { return location.pathname; }

export async function render() {
  if (!outlet) return;
  if (currentCleanup) { try { currentCleanup(); } catch { /* ignora */ } currentCleanup = null; }

  const path = location.pathname;
  const handler = routes.get(path) || routes.get(path.replace(/\/$/, '')) || notFoundHandler;
  if (!handler) return;

  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  const cleanup = await handler({ outlet, path, query: new URLSearchParams(location.search) });
  if (typeof cleanup === 'function') currentCleanup = cleanup;

  document.dispatchEvent(new CustomEvent('route:changed', { detail: { path } }));
}

/** Intercepta los enlaces internos para no recargar la pagina. */
export function initRouter() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
    if (link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(href);
  });
  window.addEventListener('popstate', render);
}

/** Punto de entrada: sesion, rutas y montaje del armazon. */

import { h, mount, $ } from './core/dom.js';
import { api } from './core/api.js';
import { store, setState } from './core/store.js';
import { defineRoutes, setOutlet, initRouter, navigate, render } from './core/router.js';
import { buildHeader, buildFooter, refreshNotifications } from './components/shell.js';
import { emptyState } from './components/ui.js';

import { loginPage } from './pages/login.js';
import { dashboardPage } from './pages/dashboard.js';
import { sponsorsPage } from './pages/sponsors.js';
import { withdrawPage } from './pages/withdraw.js';
import { historyPage } from './pages/history.js';
import { helpPage } from './pages/help.js';
import { profilePage } from './pages/profile.js';

const root = $('#app');
const outlet = h('main', { class: 'shell', id: 'main' });

/** Rutas que exigen sesion iniciada. */
function guarded(pageFn) {
  return async (ctx) => {
    if (!store.profile) return navigate('/login', { replace: true });
    return pageFn(ctx);
  };
}

/** Renderiza el armazon completo (cabecera + contenido + pie). */
function renderShell() {
  mount(root, buildHeader(), outlet, buildFooter());
  setOutlet(outlet);
}

/** Pantalla de acceso: sin cabecera ni pie. */
function renderAuthShell() {
  mount(root, outlet);
  outlet.className = '';
  setOutlet(outlet);
}

function notFound({ outlet: target }) {
  mount(target, h('div', { class: 'page' },
    emptyState({
      iconName: 'info',
      title: 'Pagina no encontrada',
      text: 'El enlace que has abierto no existe o ha cambiado.',
      action: h('a', { class: 'btn btn--primary', href: '/dashboard' }, 'Volver al dashboard')
    })
  ));
}

defineRoutes({
  '/': async () => navigate(store.profile ? '/dashboard' : '/login', { replace: true }),
  '/login': async (ctx) => {
    if (store.profile) return navigate('/dashboard', { replace: true });
    renderAuthShell();
    return loginPage({ ...ctx, outlet });
  },
  '/dashboard': guarded(dashboardPage),
  '/sponsors': guarded(sponsorsPage),
  '/withdraw': guarded(withdrawPage),
  '/history': guarded(historyPage),
  '/help': guarded(helpPage),
  '/profile': guarded(profilePage)
}, { notFound });

/** Cambia entre armazon publico y privado segun haya sesion. */
let shellMode = null;
function syncShell() {
  const mode = store.profile ? 'app' : 'auth';
  if (mode === shellMode) return;
  shellMode = mode;
  if (mode === 'app') {
    outlet.className = 'shell';
    renderShell();
    // Al entrar (arranque o login) se cargan las notificaciones del creador.
    refreshNotifications();
  } else {
    renderAuthShell();
  }
}

async function boot() {
  initRouter();

  try {
    const [session, program] = await Promise.all([
      api.session(),
      api.program().catch(() => null)
    ]);
    if (session.authenticated) setState({ profile: session.profile });
    if (program) setState({ program });
  } catch {
    // Sin sesion: se sigue a la pantalla de acceso.
  }

  syncShell();
  setState({ ready: true });

  // Refresco periodico discreto del contador de notificaciones.
  setInterval(() => { if (store.profile && !document.hidden) refreshNotifications(); }, 60_000);

  const path = location.pathname;
  if (store.profile && (path === '/' || path === '/login')) {
    await navigate('/dashboard', { replace: true });
  } else if (!store.profile && path !== '/login') {
    await navigate('/login', { replace: true });
  } else {
    await render();
  }
}

// Al iniciar o cerrar sesion se reconstruye el armazon.
let lastProfileId = null;
document.addEventListener('route:changed', () => {
  const id = store.profile ? store.profile.id : null;
  if (id !== lastProfileId) { lastProfileId = id; syncShell(); }
});

boot();

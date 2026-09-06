/** Cabecera, navegacion, notificaciones, menu de perfil y pie. */

import { h, mount, clear, onDismiss } from '../core/dom.js';
import { icon, logoMark } from '../core/icons.js';
import { store, setState, subscribe } from '../core/store.js';
import { api } from '../core/api.js';
import { navigate, currentPath } from '../core/router.js';
import { relative, robux } from '../core/format.js';
import { toastError } from './toast.js';

export const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/sponsors',  label: 'Sponsors',  icon: 'sponsors' },
  { path: '/withdraw',  label: 'Withdraw',  icon: 'wallet' },
  { path: '/history',   label: 'History',   icon: 'history' },
  { path: '/help',      label: 'Help',      icon: 'help' }
];

function brand() {
  return h('a', { class: 'brand', href: '/dashboard', 'aria-label': 'MM2 Trades, ir al dashboard' },
    h('span', { class: 'brand__mark' }, logoMark(34)),
    h('span', {},
      h('span', { class: 'brand__name' }, 'MM2 ', h('span', {}, 'TRADES')),
      h('span', { class: 'brand__sub' }, 'CREATORS')
    )
  );
}

/* ----------------------------- Notificaciones ---------------------- */
function notificationsPanel(closeFn) {
  const list = h('div', { class: 'notif__list' });
  const { items } = store.notifications;

  if (!items.length) {
    list.appendChild(h('div', { class: 'empty', style: { padding: '32px 20px' } },
      h('div', { class: 'empty__icon' }, icon('bell', { size: 20 })),
      h('div', { class: 'empty__title' }, 'Sin notificaciones'),
      h('p', { class: 'empty__text' }, 'Te avisaremos cuando revisemos tu contenido o se mueva un retiro.')
    ));
  } else {
    const colors = { success: 'var(--robux)', danger: 'var(--danger)', warning: 'var(--warn)', info: 'var(--info)' };
    const bg = { success: 'var(--robux-dim)', danger: 'var(--danger-dim)', warning: 'var(--warn-dim)', info: 'var(--info-dim)' };
    items.forEach((n) => {
      list.appendChild(h('a', {
        class: `notif__item ${n.read_at ? '' : 'is-unread'}`,
        href: n.link || '/dashboard',
        onClick: () => closeFn()
      },
        h('span', {
          class: 'notif__icon',
          style: { background: bg[n.type] || bg.info, color: colors[n.type] || colors.info }
        }, icon(n.icon || 'info', { size: 15 })),
        h('div', { class: 'grow' },
          h('div', { class: 'small strong' }, n.title),
          n.body ? h('div', { class: 'tiny muted', style: { marginTop: '2px' } }, n.body) : null,
          h('div', { class: 'tiny dim', style: { marginTop: '4px' } }, relative(n.created_at))
        )
      ));
    });
  }

  return h('div', { class: 'menu notif' },
    h('div', { class: 'notif__head' },
      h('strong', {}, 'Notificaciones'),
      store.notifications.unread
        ? h('button', {
            class: 'btn btn--sm btn--ghost', type: 'button',
            onClick: async () => {
              await api.readAllNotifications();
              setState({ notifications: { ...store.notifications, unread: 0, items: store.notifications.items.map((i) => ({ ...i, read_at: i.read_at || 'now' })) } });
              closeFn();
            }
          }, 'Marcar leidas')
        : null
    ),
    list
  );
}

/* ----------------------------- Menu de perfil ---------------------- */
function profileMenu(closeFn) {
  const p = store.profile;
  return h('div', { class: 'menu' },
    h('div', { class: 'menu__head' },
      h('div', { class: 'row gap-12' },
        h('span', { class: 'avatar' }, p.initials),
        h('div', { class: 'stack grow', style: { minWidth: '0' } },
          h('div', { class: 'strong truncate' }, p.display_name),
          h('div', { class: 'tiny muted truncate' }, p.email || `@${p.username}`)
        )
      ),
      h('div', { class: 'row between gap-12', style: { marginTop: '12px' } },
        h('span', { class: 'tiny muted' }, 'Disponible'),
        h('span', { class: 'small strong robux num' }, robux(p.balance.available))
      )
    ),
    h('button', { class: 'menu__item', type: 'button', onClick: () => { closeFn(); navigate('/profile'); } },
      icon('user', { size: 16 }), 'Mi perfil'),
    h('button', { class: 'menu__item', type: 'button', onClick: () => { closeFn(); navigate('/withdraw'); } },
      icon('wallet', { size: 16 }), 'Retirar saldo'),
    h('button', { class: 'menu__item', type: 'button', onClick: () => { closeFn(); navigate('/help'); } },
      icon('help', { size: 16 }), 'Como funciona'),
    h('div', { class: 'menu__sep' }),
    h('button', {
      class: 'menu__item menu__item--danger', type: 'button',
      onClick: async () => {
        closeFn();
        try { await api.logout(); } catch { /* la sesion se cierra igualmente */ }
        setState({ profile: null });
        navigate('/login', { replace: true });
      }
    }, icon('logout', { size: 16 }), 'Cerrar sesion')
  );
}

/** Ancla generica para paneles desplegables. */
function dropdown(trigger, buildPanel) {
  const anchor = h('div', { class: 'menu-anchor' }, trigger);
  let dispose = null;
  let panel = null;

  const close = () => {
    if (dispose) { dispose(); dispose = null; }
    if (panel) { panel.remove(); panel = null; }
    trigger.setAttribute('aria-expanded', 'false');
  };

  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel) return close();
    panel = buildPanel(close);
    anchor.appendChild(panel);
    trigger.setAttribute('aria-expanded', 'true');
    dispose = onDismiss(anchor, close);
  });

  return anchor;
}

/* ----------------------------- Menu movil -------------------------- */
function mobileDrawer() {
  const drawer = h('div', { class: 'drawer' });
  const close = () => { drawer.classList.remove('is-open'); document.body.style.overflow = ''; };

  const panel = h('div', { class: 'drawer__panel' },
    h('div', { class: 'row between', style: { marginBottom: '14px' } },
      brand(),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar menu', onClick: close }, icon('close'))
    ),
    ...NAV.map((item) => h('a', {
      class: `drawer__link ${currentPath() === item.path ? 'is-active' : ''}`,
      href: item.path,
      onClick: close
    }, icon(item.icon, { size: 18 }), item.label)),
    h('div', { class: 'menu__sep', style: { margin: '10px 4px' } }),
    h('a', { class: 'drawer__link', href: '/profile', onClick: close }, icon('user', { size: 18 }), 'Mi perfil'),
    h('button', {
      class: 'drawer__link', type: 'button',
      style: { border: '0', background: 'transparent', width: '100%', cursor: 'pointer', color: 'var(--danger)' },
      onClick: async () => {
        close();
        try { await api.logout(); } catch { /* ignora */ }
        setState({ profile: null });
        navigate('/login', { replace: true });
      }
    }, icon('logout', { size: 18 }), 'Cerrar sesion')
  );

  mount(drawer, h('div', { class: 'drawer__scrim', onClick: close }), panel);
  drawer.open = () => {
    // Refresca el estado activo de los enlaces al abrir.
    panel.querySelectorAll('.drawer__link[href]').forEach((a) => {
      a.classList.toggle('is-active', a.getAttribute('href') === currentPath());
    });
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };
  return drawer;
}

/* ----------------------------- Cabecera ---------------------------- */
export function buildHeader() {
  const nav = h('nav', { class: 'nav', 'aria-label': 'Navegacion principal' },
    ...NAV.map((item) => h('a', {
      class: 'nav__link', href: item.path, dataset: { path: item.path }
    }, item.label))
  );

  const bellBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Notificaciones' },
    icon('bell', { size: 18 }));
  const bellBadge = h('span', { class: 'icon-btn__dot hidden' });
  bellBtn.appendChild(bellBadge);

  const profileBtn = h('button', { class: 'profile-btn', type: 'button', 'aria-label': 'Menu de perfil' },
    h('span', { class: 'avatar' }, '—'),
    h('span', { class: 'profile-btn__meta' },
      h('span', { class: 'profile-btn__name' }, '—'),
      h('span', { class: 'profile-btn__tier' }, '')
    )
  );

  const drawer = mobileDrawer();
  const menuBtn = h('button', {
    class: 'icon-btn mobile-toggle', type: 'button', 'aria-label': 'Abrir menu',
    onClick: () => drawer.open()
  }, icon('menu', { size: 18 }));

  const header = h('header', { class: 'header' },
    h('div', { class: 'header__inner' },
      brand(),
      nav,
      h('div', { class: 'header__spacer' }),
      h('div', { class: 'header__actions' },
        dropdown(bellBtn, notificationsPanel),
        dropdown(profileBtn, profileMenu),
        menuBtn
      )
    )
  );

  const syncActive = () => {
    const path = currentPath();
    nav.querySelectorAll('.nav__link').forEach((a) => {
      a.classList.toggle('is-active', a.dataset.path === path);
    });
  };

  const syncProfile = () => {
    const p = store.profile;
    if (!p) return;
    profileBtn.querySelector('.avatar').textContent = p.initials;
    profileBtn.querySelector('.profile-btn__name').textContent = p.display_name;
    profileBtn.querySelector('.profile-btn__tier').textContent = p.tier ? `${p.tier.key} · ${p.tier.name}` : '';
    const unread = store.notifications.unread;
    bellBadge.textContent = unread > 9 ? '9+' : String(unread);
    bellBadge.classList.toggle('hidden', !unread);
  };

  subscribe(syncProfile);
  document.addEventListener('route:changed', syncActive);
  syncActive();
  syncProfile();

  document.body.appendChild(drawer);
  return header;
}

export function buildFooter() {
  const disclaimer = (store.program && store.program.disclaimer) ||
    'MM2 Trades es un servicio comunitario independiente y no esta afiliado a Roblox Corporation.';
  const footer = h('footer', { class: 'footer' },
    h('div', { class: 'footer__inner' },
      h('span', {}, disclaimer),
      h('span', { class: 'row gap-16' },
        h('a', { href: '/help' }, 'Como funciona'),
        h('a', { href: '/help' }, 'Seguridad')
      )
    )
  );
  subscribe(() => {
    if (store.program && store.program.disclaimer) {
      footer.querySelector('.footer__inner span').textContent = store.program.disclaimer;
    }
  });
  return footer;
}

/** Recarga las notificaciones y actualiza el contador. */
export async function refreshNotifications() {
  try {
    const data = await api.notifications(30);
    setState({ notifications: data });
  } catch (err) {
    if (err.status !== 401) toastError('No se pudieron cargar las notificaciones');
  }
}

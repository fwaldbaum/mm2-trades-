/** Avisos flotantes. */

import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';

let container = null;

function ensureContainer() {
  if (!container) {
    container = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(container);
  }
  return container;
}

const ICONS = { success: 'check', error: 'x', info: 'info', warning: 'info' };
const COLORS = { success: 'var(--robux)', error: 'var(--danger)', info: 'var(--info)', warning: 'var(--warn)' };

export function toast(title, { body = null, type = 'info', duration = 4200 } = {}) {
  const el = h('div', { class: `toast toast--${type}` },
    h('span', { class: 'toast__icon', style: { color: COLORS[type] || COLORS.info } },
      icon(ICONS[type] || 'info', { size: 17 })),
    h('div', { class: 'grow' },
      h('div', { class: 'toast__title' }, title),
      body ? h('div', { class: 'toast__body' }, body) : null
    )
  );

  ensureContainer().appendChild(el);
  const remove = () => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 240);
  };
  const timer = setTimeout(remove, duration);
  el.addEventListener('click', () => { clearTimeout(timer); remove(); });
  return remove;
}

export const toastSuccess = (title, body) => toast(title, { body, type: 'success' });
export const toastError = (title, body) => toast(title, { body, type: 'error', duration: 6000 });

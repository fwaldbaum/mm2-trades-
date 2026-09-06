/** Modal accesible: enfoque atrapado, cierre con Escape y con el fondo. */

import { h, mount } from '../core/dom.js';
import { icon } from '../core/icons.js';

export function openModal({ title, subtitle = null, content, actions = [], onClose = null, width = null }) {
  const panel = h('div', {
    class: 'modal__panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': title,
    style: width ? { width } : {}
  });

  const close = () => {
    document.removeEventListener('keydown', onKey);
    root.remove();
    document.body.style.overflow = '';
    if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  mount(panel,
    h('div', { class: 'modal__head' },
      h('div', { class: 'stack gap-4 grow' },
        h('h2', {}, title),
        subtitle ? h('p', { class: 'small muted' }, subtitle) : null
      ),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', onClick: close }, icon('close'))
    ),
    content,
    actions.length
      ? h('div', { class: 'modal__foot' }, ...actions.map((a) => {
          const btn = h('button', {
            class: `btn ${a.variant ? `btn--${a.variant}` : 'btn--ghost'}`,
            type: 'button',
            onClick: async () => {
              if (a.closeOnClick !== false && !a.onClick) return close();
              if (!a.onClick) return;
              btn.classList.add('is-loading');
              btn.disabled = true;
              try {
                const result = await a.onClick();
                if (result !== false) close();
              } finally {
                btn.classList.remove('is-loading');
                btn.disabled = false;
              }
            }
          }, a.label);
          return btn;
        }))
      : null
  );

  const root = h('div', { class: 'modal' },
    h('div', { class: 'modal__scrim', onClick: close }),
    panel
  );

  document.body.appendChild(root);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey);
  panel.querySelector('input, select, textarea, button')?.focus();

  return { close, panel };
}

/** Dialogo de confirmacion. Resuelve a true/false. */
export function confirmDialog({ title, message, confirmLabel = 'Confirmar', variant = 'primary', details = null }) {
  return new Promise((resolve) => {
    let decided = false;
    openModal({
      title,
      content: h('div', { class: 'stack gap-16' },
        h('p', { class: 'soft' }, message),
        details || null
      ),
      actions: [
        { label: 'Cancelar', variant: 'ghost', onClick: () => { decided = true; resolve(false); } },
        { label: confirmLabel, variant, onClick: () => { decided = true; resolve(true); } }
      ],
      onClose: () => { if (!decided) resolve(false); }
    });
  });
}

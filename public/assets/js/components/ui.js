/** Piezas de interfaz reutilizadas por todas las paginas. */

import { h, countUp } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { number, robux } from '../core/format.js';

/** Tarjeta de estadistica principal. */
export function statCard({
  label, value, unit = null, foot = null, iconName = null,
  variant = '', spark = null, animate = true, raw = null
}) {
  // El numero vive en su propio nodo para que la animacion no borre la unidad.
  const digits = h('span', {});
  const valueEl = h('div', { class: 'stat__value num' },
    unit ? h('span', { class: 'stat__unit' }, unit) : null,
    digits
  );
  if (typeof raw === 'number' && animate) {
    digits.textContent = '0';
    countUp(digits, raw, { format: (n) => number(n) });
  } else {
    digits.textContent = String(value);
  }

  return h('div', { class: `card card--hover stat ${variant}` },
    h('div', { class: 'row between gap-12' },
      h('span', { class: 'label' }, label),
      iconName ? h('span', { class: 'stat__icon' }, icon(iconName, { size: 16 })) : null
    ),
    valueEl,
    foot ? h('div', { class: 'stat__foot' }, foot) : null,
    spark
  );
}

/** Insignia de estado. */
export function badge(status, label) {
  return h('span', { class: `badge badge--${status}` },
    h('span', { class: 'badge__dot' }),
    label
  );
}

export function tierBadge(tierKey, name) {
  return h('span', { class: 'badge badge--tier' }, name ? `${tierKey} · ${name}` : tierKey);
}

/** Estado vacio con accion opcional. */
export function emptyState({ iconName = 'inbox', title, text = null, action = null }) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty__icon' }, icon(iconName, { size: 22 })),
    h('div', { class: 'empty__title' }, title),
    text ? h('p', { class: 'empty__text' }, text) : null,
    action
  );
}

/** Aviso en linea. */
export function alert(message, { type = 'info', iconName = null, title = null } = {}) {
  const icons = { info: 'info', warn: 'info', danger: 'x', success: 'check' };
  return h('div', { class: `alert alert--${type}` },
    h('span', { class: 'alert__icon' }, icon(iconName || icons[type] || 'info', { size: 17 })),
    h('div', { class: 'grow' },
      title ? h('div', { class: 'strong', style: { marginBottom: '3px' } }, title) : null,
      h('div', {}, message)
    )
  );
}

/** Fila etiqueta / valor para los paneles de detalle. */
export function detailRow(label, value) {
  return h('div', { class: 'detail-row' },
    h('span', { class: 'detail-row__label' }, label),
    h('span', { class: 'detail-row__value' }, value)
  );
}

/** Grupo de campo de formulario con hueco reservado para el error. */
export function field({ label, input, hint = null, id = null }) {
  const errorEl = h('div', { class: 'field__error hidden' });
  const wrap = h('div', { class: 'field' },
    label ? h('label', { class: 'field__label', for: id || undefined }, label) : null,
    input,
    hint ? h('div', { class: 'field__hint' }, hint) : null,
    errorEl
  );
  wrap.setError = (message) => {
    if (message) {
      errorEl.replaceChildren(icon('x', { size: 13 }), document.createTextNode(message));
      errorEl.classList.remove('hidden');
      input.classList.add('has-error');
    } else {
      errorEl.classList.add('hidden');
      input.classList.remove('has-error');
    }
  };
  return wrap;
}

/** Filtros segmentados (3M / 6M / 12M / All, Semanal / Mensual...). */
export function segmented(options, active, onChange) {
  const root = h('div', { class: 'segmented', role: 'tablist' });
  options.forEach((opt) => {
    const btn = h('button', {
      class: `segmented__btn ${opt.value === active ? 'is-active' : ''}`,
      type: 'button', role: 'tab', 'aria-selected': String(opt.value === active),
      onClick: () => {
        if (btn.classList.contains('is-active')) return;
        root.querySelectorAll('.segmented__btn').forEach((b) => {
          b.classList.remove('is-active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-selected', 'true');
        onChange(opt.value);
      }
    }, opt.label);
    root.appendChild(btn);
  });
  return root;
}

/** Boton con estado de carga integrado. */
export function actionButton(label, { variant = 'primary', iconName = null, onClick, block = false, type = 'button' } = {}) {
  const btn = h('button', {
    class: `btn btn--${variant} ${block ? 'btn--block' : ''}`,
    type,
    onClick: onClick ? async (e) => {
      if (btn.disabled) return;
      btn.classList.add('is-loading');
      btn.disabled = true;
      try { await onClick(e); } finally {
        btn.classList.remove('is-loading');
        btn.disabled = false;
      }
    } : undefined
  }, iconName ? icon(iconName, { size: 16 }) : null, label);
  return btn;
}

/** Esqueleto de carga para una pagina completa. */
export function pageSkeleton({ stats = 4, chart = true } = {}) {
  return h('div', { class: 'stack gap-20' },
    h('div', { class: 'skeleton skeleton--title' }),
    h('div', { class: 'grid grid--stats' },
      ...Array.from({ length: stats }, () => h('div', { class: 'card' },
        h('div', { class: 'skeleton skeleton--text', style: { width: '45%' } }),
        h('div', { class: 'skeleton', style: { height: '32px', width: '70%', margin: '14px 0 10px' } }),
        h('div', { class: 'skeleton skeleton--text', style: { width: '35%' } })
      ))
    ),
    chart ? h('div', { class: 'grid grid--main' },
      h('div', { class: 'card' }, h('div', { class: 'skeleton skeleton--chart' })),
      h('div', { class: 'card' },
        h('div', { class: 'skeleton skeleton--text', style: { width: '40%' } }),
        h('div', { class: 'skeleton', style: { height: '48px', width: '55%', margin: '14px 0' } }),
        h('div', { class: 'skeleton skeleton--text' }),
        h('div', { class: 'skeleton skeleton--text' }),
        h('div', { class: 'skeleton skeleton--text', style: { width: '60%' } })
      )
    ) : null
  );
}

/** Cabecera de seccion con acciones a la derecha. */
export function sectionTitle(title, ...actions) {
  return h('div', { class: 'section-title' },
    h('h2', {}, title),
    actions.length ? h('div', { class: 'row gap-10 wrap' }, ...actions) : null
  );
}

/** Copia texto al portapapeles con retorno visual. */
export function copyButton(getText, { label = 'Copiar' } = {}) {
  const btn = h('button', { class: 'btn btn--sm btn--ghost', type: 'button' },
    icon('copy', { size: 14 }), label);
  btn.addEventListener('click', async () => {
    const text = getText();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = h('textarea', { style: { position: 'fixed', opacity: '0' }, value: text });
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      btn.replaceChildren(icon('check', { size: 14 }), document.createTextNode('Copiado'));
      setTimeout(() => btn.replaceChildren(icon('copy', { size: 14 }), document.createTextNode(label)), 1800);
    } catch {
      btn.replaceChildren(document.createTextNode('Copia manual'));
    }
  });
  return btn;
}

/** Celda de importe en Robux. */
export const robuxCell = (amount, { positive = false } = {}) =>
  h('span', { class: `num strong ${amount > 0 && positive ? 'robux' : ''}` },
    `${positive && amount > 0 ? '+' : ''}${robux(amount)}`);

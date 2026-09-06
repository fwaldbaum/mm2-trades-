/** Formulario "Enviar un video" con estimacion de ganancias en vivo. */

import { h, mount } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { api } from '../core/api.js';
import { number, robux } from '../core/format.js';
import { field, actionButton } from './ui.js';
import { toastSuccess, toastError } from './toast.js';

export function submitVideoForm({ meta, onSubmitted }) {
  const urlInput = h('input', {
    class: 'input', id: 'video-url', type: 'url', inputmode: 'url',
    placeholder: 'https://youtube.com/watch?v=… · tiktok.com/… · instagram.com/reel/…'
  });
  const typeSelect = h('select', { class: 'select', id: 'content-type' },
    ...meta.content_types.map((t) => h('option', { value: t.key }, t.label))
  );
  const viewsInput = h('input', {
    class: 'input', id: 'views', type: 'text', inputmode: 'numeric', placeholder: 'ej. 12000'
  });

  const fUrl = field({ label: 'Enlace del video', input: urlInput, id: 'video-url' });
  const fType = field({ label: 'Tipo de contenido', input: typeSelect, id: 'content-type' });
  const fViews = field({
    label: 'Views actuales', input: viewsInput, id: 'views',
    hint: 'Orientativo: el staff verifica el numero real antes de aprobar.'
  });

  const estimateBox = h('div', {
    class: 'row between gap-12',
    style: {
      padding: '13px 16px', borderRadius: 'var(--r-md)',
      border: '1px solid var(--line)', background: 'rgba(146,166,224,.04)'
    }
  },
    h('span', { class: 'small muted row gap-8' }, icon('coins', { size: 15 }), 'Ganancia estimada'),
    h('span', { class: 'strong robux num' }, robux(0))
  );

  let timer = null;
  const updateEstimate = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const views = Number(String(viewsInput.value).replace(/[^\d]/g, '')) || 0;
      try {
        const calc = await api.estimate(views, typeSelect.value);
        estimateBox.lastChild.textContent = robux(calc.robux);
      } catch {
        estimateBox.lastChild.textContent = robux(0);
      }
    }, 260);
  };
  viewsInput.addEventListener('input', updateEstimate);
  typeSelect.addEventListener('change', updateEstimate);

  const submit = async () => {
    [fUrl, fType, fViews].forEach((f) => f.setError(null));
    const views = String(viewsInput.value).replace(/[^\d]/g, '');
    try {
      const created = await api.submitVideo({
        url: urlInput.value.trim(),
        content_type: typeSelect.value,
        views: views ? Number(views) : 0
      });
      toastSuccess('Video enviado a revision', `${created.public_id} · te avisamos al resolverlo.`);
      urlInput.value = '';
      viewsInput.value = '';
      estimateBox.lastChild.textContent = robux(0);
      if (onSubmitted) onSubmitted(created);
    } catch (err) {
      const map = { url: fUrl, content_type: fType, views: fViews };
      const target = err.details && map[err.details.field];
      if (target) target.setError(err.message);
      else if (['url_platform_unsupported', 'url_invalid', 'submission_duplicate', 'platform_mismatch'].includes(err.code)) {
        fUrl.setError(err.message);
      } else toastError('No se pudo enviar', err.message);
    }
  };

  const form = h('form', {
    class: 'stack gap-16',
    onSubmit: (e) => { e.preventDefault(); btn.click(); }
  },
    fUrl,
    h('div', { class: 'form-grid' }, fType, fViews),
    estimateBox
  );
  const btn = actionButton('Enviar video', { variant: 'primary', iconName: 'upload', onClick: submit });
  form.appendChild(h('div', { class: 'row gap-12 wrap' }, btn));

  const rules = Array.isArray(meta.rules) ? meta.rules : [];

  return h('div', { class: 'card stack gap-18' },
    h('div', { class: 'row between gap-12 wrap' },
      h('div', { class: 'stack gap-4' },
        h('h2', {}, 'Enviar un video'),
        h('p', { class: 'small muted' }, 'Publicaste contenido promocionando MM2 Trades? Envialo para revision.')
      ),
      h('span', { class: 'stat__icon' }, icon('upload', { size: 16 }))
    ),
    form,
    rules.length
      ? h('details', { style: { marginTop: '2px' } },
          h('summary', {
            class: 'small muted',
            style: { cursor: 'pointer', listStyle: 'none', userSelect: 'none' }
          }, 'Ver las reglas para que un video cuente'),
          h('ul', { class: 'rules-list', style: { marginTop: '12px' } },
            ...rules.map((r) => h('li', {},
              icon('check', { size: 14, cls: 'robux' }),
              h('span', {}, r)))
          )
        )
      : null,
    h('p', { class: 'tiny dim' },
      `Maximo ${meta.max_per_day} envios al dia. Cada video se puede enviar una sola vez.`)
  );
}

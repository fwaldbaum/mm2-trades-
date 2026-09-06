/**
 * Graficos en SVG, sin librerias externas.
 *
 * Decisiones:
 *  - Un solo eje por grafico. Views y ganancias tienen escalas distintas,
 *    asi que se muestran por separado con un conmutador, nunca superpuestas
 *    en dos ejes.
 *  - Paleta categorica validada para superficie oscura (violeta / naranja /
 *    verde): separacion suficiente tambien con daltonismo.
 *  - Leyenda siempre visible cuando hay dos o mas series; con una sola serie
 *    el titulo ya la identifica.
 *  - Tooltip al pasar el puntero, con area de contacto mas ancha que la barra.
 */

import { h, clear } from '../core/dom.js';
import { compact, number, monthLabel } from '../core/format.js';

const NS = 'http://www.w3.org/2000/svg';

export const SERIES_COLORS = ['#9085e9', '#d95926', '#199e70'];
export const VIEWS_COLOR = '#7c5cff';
export const EARNINGS_COLOR = '#3ddc97';

const GRID = 'rgba(146, 166, 224, .09)';
const AXIS_TEXT = '#616e91';

const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  return node;
};

/** Barra con las esquinas superiores redondeadas, apoyada en la linea base. */
function barPath(x, y, w, hgt, r = 4) {
  const radius = Math.min(r, w / 2, Math.max(hgt, 0));
  if (hgt <= 0.5) return `M${x} ${y + hgt}h${w}`;
  return `M${x} ${y + hgt}V${y + radius}a${radius} ${radius} 0 0 1 ${radius} -${radius}h${w - radius * 2}` +
         `a${radius} ${radius} 0 0 1 ${radius} ${radius}V${y + hgt}Z`;
}

/** Escala "bonita" para el eje Y. */
function niceMax(value) {
  if (value <= 0) return 10;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const n = value / base;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * base;
}

/* ------------------------------ Tooltip ---------------------------- */
let tooltipEl = null;
function tooltip() {
  if (!tooltipEl) {
    tooltipEl = h('div', { class: 'chart-tooltip' });
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}
function showTooltip(evt, nodes) {
  const t = tooltip();
  clear(t);
  nodes.forEach((n) => t.appendChild(n));
  t.classList.add('is-visible');
  const rect = t.getBoundingClientRect();
  const x = Math.min(Math.max(evt.clientX - rect.width / 2, 10), window.innerWidth - rect.width - 10);
  t.style.left = `${x}px`;
  t.style.top = `${Math.max(10, evt.clientY - rect.height - 14)}px`;
}
function hideTooltip() {
  if (tooltipEl) tooltipEl.classList.remove('is-visible');
}

/* --------------------------- Estado vacio -------------------------- */
function emptyOverlay(text) {
  return h('div', {
    class: 'muted small',
    style: {
      position: 'absolute', inset: '0', display: 'grid', placeItems: 'center',
      pointerEvents: 'none', textAlign: 'center', padding: '0 20px'
    }
  }, text);
}

/**
 * Grafico de barras.
 *
 * @param {HTMLElement} container
 * @param {object} options
 *   data:        [{ label, values: [n, ...] }]
 *   series:      [{ key, label, color }]
 *   height:      alto util en px
 *   formatValue: funcion para el tooltip
 *   emptyText:   mensaje cuando todo vale cero
 */
export function barChart(container, {
  data = [],
  series = [{ label: 'Valor', color: VIEWS_COLOR }],
  height = 240,
  formatValue = (v) => number(v),
  emptyText = 'Todavia no hay datos en este rango.'
} = {}) {
  container.style.position = 'relative';

  const render = () => {
    clear(container);
    const width = Math.max(container.clientWidth || 640, 280);
    const padL = 54;
    const padR = 10;
    const padT = 14;
    const padB = 28;
    const plotW = Math.max(width - padL - padR, 40);
    const plotH = Math.max(height - padT - padB, 60);

    const flat = data.flatMap((d) => d.values);
    const rawMax = Math.max(...flat, 0);
    const isEmpty = rawMax <= 0;
    const max = niceMax(rawMax || 1);

    const root = el('svg', {
      class: 'chart',
      width: '100%',
      height,
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': `Grafico de barras: ${series.map((s) => s.label).join(', ')}`
    });

    // --- Rejilla y eje Y (recesivos) ---
    const ticks = 4;
    for (let i = 0; i <= ticks; i += 1) {
      const value = (max / ticks) * i;
      const y = padT + plotH - (plotH * i) / ticks;
      root.appendChild(el('line', {
        x1: padL, y1: y, x2: padL + plotW, y2: y,
        stroke: GRID, 'stroke-width': 1,
        'stroke-dasharray': i === 0 ? null : '3 5'
      }));
      const label = el('text', {
        x: padL - 10, y: y + 4, 'text-anchor': 'end',
        fill: AXIS_TEXT, 'font-size': 10.5, 'font-weight': 600
      });
      label.textContent = isEmpty && i > 0 ? '' : compact(value);
      root.appendChild(label);
    }

    // --- Barras ---
    const slot = plotW / Math.max(data.length, 1);
    const groupW = Math.min(slot * 0.66, series.length * 26 + (series.length - 1) * 2);
    const barW = Math.max((groupW - (series.length - 1) * 2) / series.length, 3);

    data.forEach((point, index) => {
      const slotX = padL + slot * index;
      const groupX = slotX + (slot - groupW) / 2;

      series.forEach((s, si) => {
        const value = point.values[si] || 0;
        const barH = isEmpty ? 0 : (value / max) * plotH;
        const x = groupX + si * (barW + 2);
        const y = padT + plotH - barH;
        const path = el('path', {
          class: 'chart__bar',
          d: barPath(x, y, barW, Math.max(barH, isEmpty ? 0 : 1)),
          fill: s.color,
          opacity: isEmpty ? 0.13 : 0.92
        });
        path.style.transformOrigin = `${x + barW / 2}px ${padT + plotH}px`;
        path.style.animation = `bar-grow 620ms ${index * 34 + si * 40}ms var(--ease) both`;
        root.appendChild(path);
      });

      // Etiqueta del eje X (se aligera cuando hay muchas columnas)
      const everyN = data.length > 14 ? Math.ceil(data.length / 8) : 1;
      if (index % everyN === 0) {
        const label = el('text', {
          x: slotX + slot / 2, y: height - 8, 'text-anchor': 'middle',
          fill: AXIS_TEXT, 'font-size': 10.5, 'font-weight': 600
        });
        label.textContent = point.label;
        root.appendChild(label);
      }

      // Zona de contacto: cubre todo el hueco, no solo la barra
      const hit = el('rect', {
        x: slotX, y: padT, width: slot, height: plotH,
        fill: 'transparent', style: 'cursor:crosshair'
      });
      const onMove = (evt) => {
        showTooltip(evt, [
          h('div', { class: 'strong', style: { marginBottom: series.length > 1 ? '5px' : '0' } }, point.full || point.label),
          ...series.map((s, si) => h('div', { class: 'row gap-8', style: { marginTop: '2px' } },
            h('span', { class: 'chart-legend__swatch', style: { background: s.color } }),
            h('span', { class: 'muted' }, `${s.label}:`),
            h('span', { class: 'strong num' }, formatValue(point.values[si] || 0, si))
          ))
        ]);
      };
      hit.addEventListener('mousemove', onMove);
      hit.addEventListener('mouseenter', onMove);
      hit.addEventListener('mouseleave', hideTooltip);
      root.appendChild(hit);
    });

    container.appendChild(root);
    if (isEmpty) container.appendChild(emptyOverlay(emptyText));
  };

  render();

  // Redibuja al cambiar el ancho (rotacion de tablet, panel lateral...)
  if (container._chartObserver) container._chartObserver.disconnect();
  let last = container.clientWidth;
  const observer = new ResizeObserver(() => {
    if (Math.abs(container.clientWidth - last) > 12) { last = container.clientWidth; render(); }
  });
  observer.observe(container);
  container._chartObserver = observer;

  return { render };
}

/** Linea de tendencia compacta para las tarjetas de estadisticas. */
export function sparkline(values, { color = VIEWS_COLOR, width = 260, height = 46 } = {}) {
  const root = el('svg', {
    class: 'stat__spark', viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none', 'aria-hidden': 'true'
  });
  const data = values.length ? values : [0, 0];
  const max = Math.max(...data, 1);
  const step = width / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => [i * step, height - (v / max) * (height - 8) - 4]);

  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const gradId = `spark-${Math.random().toString(36).slice(2, 8)}`;

  const defs = el('defs');
  const grad = el('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
  grad.appendChild(el('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '.35' }));
  grad.appendChild(el('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0' }));
  defs.appendChild(grad);
  root.appendChild(defs);

  root.appendChild(el('path', {
    d: `${line} L${width} ${height} L0 ${height} Z`, fill: `url(#${gradId})`
  }));
  root.appendChild(el('path', {
    d: line, fill: 'none', stroke: color, 'stroke-width': 2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '.9'
  }));
  return root;
}

/** Leyenda. Obligatoria a partir de dos series. */
export function legend(series) {
  return h('div', { class: 'chart-legend' },
    ...series.map((s) => h('span', { class: 'chart-legend__key' },
      h('span', { class: 'chart-legend__swatch', style: { background: s.color } }),
      s.label
    ))
  );
}

/** Convierte la serie mensual del servidor al formato del grafico. */
export function toBuckets(rows, keys) {
  return rows.map((row) => ({
    label: monthLabel(row.month || row.bucket),
    full: row.month || row.bucket,
    values: keys.map((k) => Number(row[k]) || 0)
  }));
}

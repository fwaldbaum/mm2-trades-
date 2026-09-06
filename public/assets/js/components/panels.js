/** Paneles compartidos: tier, formula de ganancias y uso del codigo. */

import { h, mount } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { number, compact, robux } from '../core/format.js';
import { segmented, copyButton, emptyState } from './ui.js';
import { barChart, legend, toBuckets, SERIES_COLORS } from './chart.js';
import { api } from '../core/api.js';

/** Muestra una tasa, o "por definir" si administracion aun no la configuro. */
const rateValue = (value) => (value > 0
  ? h('span', { class: 'rate-row__value robux' }, robux(value))
  : h('span', { class: 'rate-row__value dim small' }, 'Por definir'));

/**
 * Panel "Your tier": tier actual, tasas, siguiente nivel y progreso.
 * Todos los valores llegan del servidor; ninguno esta escrito en el cliente.
 */
export function tierPanel({ tier, nextTier, progress, note = null, compactMode = false }) {
  const rates = (t) => h('div', { class: 'stack' },
    h('div', { class: 'rate-row' },
      h('span', { class: 'muted' }, 'Formato largo / 1K views'), rateValue(t.rates.long_form)),
    h('div', { class: 'rate-row' },
      h('span', { class: 'muted' }, 'Formato corto / 1K views'), rateValue(t.rates.short_form))
  );

  const requirementLines = (t) => {
    const req = t.requirements;
    if (!req.min_subscribers && !req.min_avg_views) {
      return h('p', { class: 'tiny dim' }, 'Requisitos pendientes de configurar por el staff.');
    }
    return h('div', { class: 'stack gap-4' },
      req.min_subscribers
        ? h('span', { class: 'tiny muted' }, `${number(req.min_subscribers)} suscriptores`)
        : null,
      req.min_subscribers && req.min_avg_views ? h('span', { class: 'tiny dim' }, 'o bien') : null,
      req.min_avg_views
        ? h('span', { class: 'tiny muted' }, `${number(req.min_avg_views)} views de media`)
        : null
    );
  };

  return h('div', { class: 'card stack gap-20' },
    h('div', { class: 'row between gap-12' },
      h('span', { class: 'label' }, 'Tu tier'),
      h('span', { class: 'stat__icon' }, icon('star', { size: 15 }))
    ),

    h('div', { class: 'tier-hero' },
      h('span', { class: 'tier-hero__key' }, tier ? tier.key : '—'),
      h('div', { class: 'stack gap-4' },
        h('strong', {}, tier ? tier.name : 'Sin asignar'),
        h('span', { class: 'tiny dim' }, 'Se paga en Robux')
      )
    ),

    tier ? rates(tier) : null,

    nextTier
      ? h('div', { class: 'stack gap-12', style: { borderTop: '1px solid var(--line)', paddingTop: '16px' } },
          h('div', { class: 'row between gap-12' },
            h('span', { class: 'label' }, `Siguiente · ${nextTier.key} ${nextTier.name}`),
            progress ? h('span', { class: 'small strong' }, `${progress.pct} %`) : null
          ),
          progress
            ? h('div', { class: 'stack gap-8' },
                (() => {
                  const bar = h('div', { class: 'progress__bar' });
                  requestAnimationFrame(() => { bar.style.width = `${progress.pct}%`; });
                  return h('div', { class: 'progress' }, bar);
                })(),
                h('div', { class: 'stack gap-4' },
                  ...progress.parts.map((p) => h('div', { class: 'row between gap-12 tiny' },
                    h('span', { class: 'muted' }, p.label),
                    h('span', { class: 'num' }, `${compact(p.current)} / ${compact(p.target)}`)
                  ))
                ),
                progress.met
                  ? h('div', { class: 'tiny robux row gap-6' }, icon('check', { size: 12 }), 'Ya cumples los requisitos. Pide la subida al staff.')
                  : null
              )
            : requirementLines(nextTier),
          compactMode ? null : rates(nextTier)
        )
      : h('div', { class: 'tiny dim', style: { borderTop: '1px solid var(--line)', paddingTop: '16px' } },
          'Estas en el tier mas alto del programa.'),

    note ? h('p', { class: 'tiny dim' }, note) : null
  );
}

/** Explicacion de como se calculan las ganancias (formula configurable). */
export function earningsFormulaPanel(model, { exampleViews = 10000, exampleRate = null } = {}) {
  const rate = exampleRate || 500;
  const result = Math.floor((exampleViews / 1000) * rate);

  return h('div', { class: 'card stack gap-16' },
    h('div', { class: 'row between gap-12 wrap' },
      h('div', { class: 'stack gap-4' },
        h('h2', {}, 'Como se calculan tus ganancias'),
        h('p', { class: 'small muted' }, 'La formula la define el staff y se aplica igual a todos los creadores.')
      ),
      h('span', { class: 'stat__icon' }, icon('coins', { size: 16 }))
    ),

    h('div', { class: 'formula' },
      h('span', { class: 'formula__chip' }, 'views ÷ 1.000'),
      h('span', { class: 'formula__op' }, '×'),
      h('span', { class: 'formula__chip formula__chip--accent' }, 'tasa de tu tier'),
      model.bonus ? h('span', { class: 'formula__op' }, '+') : null,
      model.bonus ? h('span', { class: 'formula__chip' }, `bonus ${model.bonus}`) : null,
      h('span', { class: 'formula__op' }, '='),
      h('span', { class: 'formula__chip formula__chip--result' }, 'ganancia')
    ),

    h('div', { class: 'stack gap-8' },
      h('span', { class: 'label' }, 'Ejemplo'),
      h('div', { class: 'row between gap-12 small' },
        h('span', { class: 'muted' }, `${number(exampleViews)} views`),
        h('span', { class: 'num' }, `× ${robux(rate)} / 1K`)
      ),
      h('div', { class: 'row between gap-12', style: { borderTop: '1px solid var(--line)', paddingTop: '10px' } },
        h('span', { class: 'strong' }, 'Ganancia'),
        h('span', { class: 'strong robux num' }, robux(result))
      )
    ),

    h('p', { class: 'tiny dim' },
      'Las ganancias no caducan ni se reinician: se acumulan en tu balance hasta que decidas retirarlas. ' +
      'La ganancia final se calcula con las views que verifica el staff.'),
    h('div', { class: 'tiny dim mono' }, `formula activa: ${model.formula}`)
  );
}

/** Panel de uso del codigo de creador, con filtro semanal / mensual. */
export function codeUsagePanel(initial) {
  const chartBox = h('div', { style: { marginTop: '16px' } });
  const totalsBox = h('div', { class: 'grid grid--stats', style: { gap: '12px', marginTop: '4px' } });

  const series = [
    { label: 'Clicks', color: SERIES_COLORS[0] },
    { label: 'Usos', color: SERIES_COLORS[1] },
    { label: 'Conversiones', color: SERIES_COLORS[2] }
  ];

  const miniStat = (label, value, accent = false) => h('div', {
    class: 'card', style: { padding: '14px 16px' }
  },
    h('div', { class: 'label', style: { fontSize: '10px' } }, label),
    h('div', {
      class: 'num strong',
      style: { fontSize: '21px', marginTop: '5px', color: accent ? 'var(--robux)' : 'inherit' }
    }, value)
  );

  const paint = (data) => {
    mount(totalsBox,
      miniStat('Clicks', number(data.totals.clicks)),
      miniStat('Usos', number(data.totals.uses)),
      miniStat('Conversiones', number(data.totals.conversions)),
      miniStat('Ingresos generados', robux(data.totals.revenue_robux), true)
    );

    const buckets = toBuckets(data.series || [], ['clicks', 'uses', 'conversions']);
    mount(chartBox);
    if (!buckets.length) {
      chartBox.appendChild(emptyState({
        iconName: 'chart',
        title: 'Aun no hay uso registrado',
        text: 'En cuanto tu audiencia empiece a usar tu codigo veras aqui la evolucion.'
      }));
    } else {
      const box = h('div');
      chartBox.appendChild(box);
      chartBox.appendChild(h('div', { style: { marginTop: '12px' } }, legend(series)));
      barChart(box, { data: buckets, series, height: 220, formatValue: (v) => number(v) });
    }
  };

  const root = h('div', { class: 'card stack gap-16' },
    h('div', { class: 'row between gap-12 wrap' },
      h('div', { class: 'stack gap-4' },
        h('h2', {}, 'Uso de tu codigo'),
        h('p', { class: 'small muted' }, 'Clicks, usos y conversiones que genera tu codigo de creador.')
      ),
      h('div', { class: 'row gap-10 wrap' },
        initial.code
          ? h('span', { class: 'code-pill' },
              h('span', { class: 'code-pill__value' }, initial.code),
              copyButton(() => initial.code, { label: 'Copiar' }))
          : null,
        segmented(
          [{ value: 'weekly', label: 'Semanal' }, { value: 'monthly', label: 'Mensual' }],
          'monthly',
          async (value) => {
            try { paint(await api.codeUsage(value)); } catch { /* mantiene la vista previa */ }
          }
        )
      )
    ),
    totalsBox,
    chartBox
  );

  paint(initial);
  return root;
}

/** Pantalla principal del creador. */

import { h, mount } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { api } from '../core/api.js';
import { store, setState } from '../core/store.js';
import { navigate } from '../core/router.js';
import { number, compact, robux, percent, shortUrl, monthLabel } from '../core/format.js';
import {
  statCard, sectionTitle, segmented, emptyState, pageSkeleton, copyButton, alert
} from '../components/ui.js';
import { barChart, sparkline, VIEWS_COLOR, EARNINGS_COLOR } from '../components/chart.js';
import { tierPanel, earningsFormulaPanel, codeUsagePanel } from '../components/panels.js';
import { submitVideoForm } from '../components/submitForm.js';
import { submissionsTable, withdrawalsTable, activityTimeline } from '../components/tables.js';
import { toastError } from '../components/toast.js';

export async function dashboardPage({ outlet }) {
  mount(outlet, pageSkeleton({ stats: 4 }));

  let data;
  try {
    data = await api.dashboard('6m');
  } catch (err) {
    return mount(outlet, h('div', { class: 'page' },
      alert(err.message, { type: 'danger', title: 'No se pudo cargar el dashboard' })));
  }

  setState({ profile: data.profile });
  const { profile, balance, performance, tier_progress: progress } = data;

  /* ---------------------------- Cabecera ---------------------------- */
  const head = h('div', { class: 'page-head' },
    h('div', { class: 'stack gap-10' },
      h('span', { class: 'badge badge--brand' }, 'Panel de creador'),
      h('h1', {}, 'Bienvenido de nuevo, ', h('span', { style: { color: 'var(--brand-soft)' } }, profile.display_name)),
      h('p', { class: 'muted' }, 'Comparte MM2 Trades, gana recompensas y retira tus ganancias en Robux o items de MM2.')
    ),
    h('div', { class: 'stack gap-8', style: { alignItems: 'flex-end' } },
      h('span', { class: 'label' }, 'Tu codigo'),
      h('span', { class: 'code-pill' },
        h('span', { class: 'code-pill__value' }, profile.code),
        copyButton(() => profile.code)
      ),
      h('span', { class: 'tiny dim', style: { maxWidth: '260px', textAlign: 'right' } },
        'Compartelo para que tu audiencia identifique tu contenido.')
    )
  );

  /* ---------------------------- Tarjetas ---------------------------- */
  const trendValues = data.timeseries.map((t) => t.earnings);
  const stats = h('div', { class: 'grid grid--stats' },
    statCard({
      label: 'Ganancias totales', raw: balance.total_earned, unit: 'R$',
      iconName: 'trending', foot: 'Acumulado historico',
      spark: sparkline(trendValues, { color: VIEWS_COLOR })
    }),
    statCard({
      label: 'Total retirado', raw: balance.withdrawn, unit: 'R$',
      iconName: 'wallet',
      foot: balance.locked
        ? h('span', { class: 'row gap-6' }, icon('clock', { size: 13 }), `${robux(balance.locked)} en curso`)
        : 'Pagos completados'
    }),
    statCard({
      label: 'Disponible para retirar', raw: balance.available, unit: 'R$',
      variant: 'stat--accent', iconName: 'coins',
      foot: balance.pending
        ? h('span', { class: 'row gap-6' }, icon('clock', { size: 13 }), `${robux(balance.pending)} pendiente de aprobar`)
        : 'Listo para retirar'
    }),
    statCard({
      label: 'Tier actual', value: profile.tier ? profile.tier.key : '—',
      animate: false, variant: 'stat--tier', iconName: 'star',
      foot: profile.tier ? `${profile.tier.name} · se paga en Robux` : 'Sin asignar'
    })
  );

  /* ---------------------------- Grafico ----------------------------- */
  // Views y ganancias tienen escalas distintas: se muestran de una en una,
  // con un solo eje, en lugar de superponerlas en un grafico de doble eje.
  let metric = 'views';
  let range = '6m';
  let series = data.timeseries;

  const chartBox = h('div');
  const paintChart = () => {
    const isViews = metric === 'views';
    barChart(chartBox, {
      data: series.map((row) => ({
        label: monthLabel(row.month),
        full: row.month,
        values: [isViews ? row.views : row.earnings]
      })),
      series: [{
        label: isViews ? 'Views' : 'Ganancias',
        color: isViews ? VIEWS_COLOR : EARNINGS_COLOR
      }],
      height: 264,
      formatValue: (v) => (isViews ? number(v) : robux(v)),
      emptyText: 'Todavia no hay contenido aprobado en este rango.'
    });
  };

  const reloadSeries = async () => {
    try {
      const perf = await api.performance(range);
      series = perf.timeseries;
      paintChart();
    } catch {
      toastError('No se pudo actualizar el grafico');
    }
  };

  const chartCard = h('div', { class: 'card stack gap-18' },
    h('div', { class: 'row between gap-12 wrap' },
      h('div', { class: 'stack gap-4' },
        h('h2', {}, 'Rendimiento'),
        h('p', { class: 'small muted' }, 'Evolucion mensual de tu contenido aprobado.')
      ),
      h('div', { class: 'row gap-10 wrap' },
        segmented(
          [{ value: 'views', label: 'Views' }, { value: 'earnings', label: 'Ganancias' }],
          'views',
          (value) => { metric = value; paintChart(); }
        ),
        segmented(
          [
            { value: '3m', label: '3M' }, { value: '6m', label: '6M' },
            { value: '12m', label: '12M' }, { value: 'all', label: 'Todo' }
          ],
          '6m',
          (value) => { range = value; reloadSeries(); }
        )
      )
    ),
    chartBox,
    h('div', { class: 'grid grid--3', style: { gap: '12px' } },
      miniMetric('Views totales', compact(performance.total_views)),
      miniMetric('Videos aprobados', `${performance.submissions_approved} / ${performance.submissions_total}`),
      miniMetric('Media de views', compact(performance.avg_views))
    )
  );
  paintChart();

  /* ---------------------------- Formularios ------------------------- */
  const submitBox = h('div');
  api.submissionMeta()
    .then((meta) => mount(submitBox, submitVideoForm({
      meta,
      onSubmitted: () => dashboardPage({ outlet })
    })))
    .catch(() => mount(submitBox, alert('No se pudo cargar el formulario de envio.', { type: 'danger' })));

  /* ---------------------------- Retiro rapido ----------------------- */
  const withdrawCard = h('div', { class: 'card stack gap-18' },
    h('div', { class: 'row between gap-12 wrap' },
      h('div', { class: 'stack gap-4' },
        h('h2', {}, 'Retirar saldo'),
        h('p', { class: 'small muted' }, 'Elige entre Robux o un item de Murder Mystery 2.')
      ),
      h('span', { class: 'stat__icon' }, icon('wallet', { size: 16 }))
    ),
    h('div', {
      class: 'row between gap-12',
      style: {
        padding: '16px', borderRadius: 'var(--r-md)',
        border: '1px solid rgba(61,220,151,.28)', background: 'var(--robux-dim)'
      }
    },
      h('div', { class: 'stack gap-4' },
        h('span', { class: 'label' }, 'Disponible'),
        h('span', { class: 'strong robux num', style: { fontSize: '25px' } }, robux(balance.available))
      ),
      icon('coins', { size: 26, cls: 'robux' })
    ),
    h('div', { class: 'method-grid' },
      quickMethod('coins', 'Robux', 'Directo a tu cuenta de Roblox.'),
      quickMethod('knife', 'Items MM2', 'Canjea por un item del catalogo.')
    ),
    balance.available > 0
      ? h('button', {
          class: 'btn btn--robux btn--block', type: 'button',
          onClick: () => navigate('/withdraw')
        }, icon('arrowRight', { size: 16 }), 'Solicitar retiro')
      : h('div', { class: 'stack gap-10' },
          h('button', { class: 'btn btn--robux btn--block is-disabled', type: 'button', disabled: true }, 'Sin saldo disponible'),
          h('p', { class: 'tiny dim center' }, 'Envia contenido y espera su aprobacion para generar saldo.')
        ),
    h('p', { class: 'tiny dim' }, data.limits.processing_note)
  );

  /* ---------------------------- Composicion ------------------------- */
  mount(outlet, h('div', { class: 'page' },
    head,
    stats,

    h('div', { class: 'grid grid--main section' }, chartCard, tierPanel({
      tier: profile.tier,
      nextTier: profile.next_tier,
      progress,
      note: store.program ? store.program.tiers_note : null,
      compactMode: true
    })),

    h('div', { class: 'grid grid--2 section' }, submitBox, withdrawCard),

    h('div', { class: 'section' }, codeUsagePanel(data.code_usage)),

    h('div', { class: 'grid grid--2 section' },
      earningsFormulaPanel(data.earnings_model, {
        exampleRate: profile.tier ? profile.tier.rates.short_form : null
      }),
      h('div', { class: 'card stack gap-16' },
        h('div', { class: 'row between gap-12' },
          h('h2', {}, 'Actividad reciente'),
          h('span', { class: 'stat__icon' }, icon('clock', { size: 16 }))
        ),
        activityTimeline(data.activity)
      )
    ),

    h('div', { class: 'section' },
      sectionTitle('Tus envios',
        h('a', { class: 'btn btn--sm btn--ghost', href: '/history' }, 'Ver historial completo')),
      h('div', { class: 'card card--flush' }, submissionsTable(data.submissions))
    ),

    h('div', { class: 'section' },
      sectionTitle('Ultimos retiros',
        h('a', { class: 'btn btn--sm btn--ghost', href: '/history' }, 'Ver todos')),
      h('div', { class: 'card card--flush' },
        withdrawalsTable(data.withdrawals, { onChanged: () => dashboardPage({ outlet }) }))
    ),

    performance.best_video
      ? h('div', { class: 'section' },
          h('div', { class: 'card row between gap-16 wrap' },
            h('div', { class: 'row gap-14' },
              h('span', {
                class: 'stat__icon',
                style: { width: '42px', height: '42px', borderRadius: '13px', color: 'var(--warn)', background: 'var(--warn-dim)' }
              }, icon('star', { size: 19 })),
              h('div', { class: 'stack gap-4' },
                h('span', { class: 'label' }, 'Tu mejor video'),
                h('span', { class: 'strong' }, shortUrl(performance.best_video.url, 42))
              )
            ),
            h('div', { class: 'row gap-24' },
              miniMetric('Views', compact(performance.best_video.views)),
              miniMetric('Ganancia', robux(performance.best_video.final_robux), true),
              miniMetric('Aprobacion', percent(performance.approval_rate))
            )
          )
        )
      : null
  ));
}

function miniMetric(label, value, accent = false) {
  return h('div', { class: 'stack gap-4' },
    h('span', { class: 'label' }, label),
    h('span', {
      class: 'num strong',
      style: { fontSize: '18px', color: accent ? 'var(--robux)' : 'inherit' }
    }, value)
  );
}

function quickMethod(iconName, title, text) {
  return h('div', { class: 'method-card', style: { cursor: 'default' } },
    h('span', { class: 'method-card__icon' }, icon(iconName, { size: 19 })),
    h('span', { class: 'method-card__title' }, title),
    h('span', { class: 'tiny muted' }, text)
  );
}

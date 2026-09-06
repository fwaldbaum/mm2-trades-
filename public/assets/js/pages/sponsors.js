/** Programa de patrocinios: tiers, tasas, formula y rendimiento del codigo. */

import { h, mount } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { number, compact, robux, percent } from '../core/format.js';
import { statCard, pageSkeleton, alert, sectionTitle } from '../components/ui.js';
import { tierPanel, earningsFormulaPanel, codeUsagePanel } from '../components/panels.js';

const rate = (value) => (value > 0
  ? h('span', { class: 'num strong robux' }, robux(value))
  : h('span', { class: 'dim small' }, 'Por definir'));

export async function sponsorsPage({ outlet }) {
  mount(outlet, pageSkeleton({ stats: 3 }));

  let tiers;
  let usage;
  let performance;
  try {
    [tiers, usage, performance] = await Promise.all([
      api.tiers(), api.codeUsage('monthly'), api.performance('12m')
    ]);
  } catch (err) {
    return mount(outlet, h('div', { class: 'page' },
      alert(err.message, { type: 'danger', title: 'No se pudo cargar el programa' })));
  }

  const summary = performance.summary;

  const ladder = h('div', { class: 'tier-ladder' },
    ...tiers.tiers.map((t) => h('div', {
      class: `tier-step ${tiers.current && t.key === tiers.current.key ? 'is-current' : ''}`
    },
      h('span', { class: 'tier-step__key' }, t.key),
      h('div', { class: 'stack gap-4', style: { minWidth: '0' } },
        h('div', { class: 'row gap-8 wrap' },
          h('strong', {}, t.name),
          tiers.current && t.key === tiers.current.key
            ? h('span', { class: 'badge badge--brand' }, 'Tu tier')
            : null
        ),
        t.requirements.min_subscribers || t.requirements.min_avg_views
          ? h('span', { class: 'tiny muted' },
              [
                t.requirements.min_subscribers ? `${compact(t.requirements.min_subscribers)} subs` : null,
                t.requirements.min_avg_views ? `${compact(t.requirements.min_avg_views)} views de media` : null
              ].filter(Boolean).join('  ·  o bien  ·  '))
          : h('span', { class: 'tiny dim' }, 'Requisitos por definir'),
        t.benefits.length
          ? h('span', { class: 'tiny dim truncate' }, t.benefits.join(' · '))
          : null
      ),
      h('div', { class: 'stack gap-4 right tier-step__rates' },
        h('div', { class: 'row gap-8', style: { justifyContent: 'flex-end' } },
          h('span', { class: 'tiny dim' }, 'Largo / 1K'), rate(t.rates.long_form)),
        h('div', { class: 'row gap-8', style: { justifyContent: 'flex-end' } },
          h('span', { class: 'tiny dim' }, 'Corto / 1K'), rate(t.rates.short_form))
      )
    ))
  );

  mount(outlet, h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', { class: 'stack gap-10' },
        h('span', { class: 'badge badge--brand' }, 'Programa' ),
        h('h1', {}, 'Patrocinios y niveles'),
        h('p', { class: 'muted' }, 'Cuanto se paga en cada tier, como se calcula y como rinde tu codigo.')
      )
    ),

    h('div', { class: 'grid grid--3' },
      statCard({
        label: 'Views totales', raw: summary.total_views, iconName: 'eye',
        foot: `${summary.submissions_approved} video(s) aprobado(s)`
      }),
      statCard({
        label: 'Media de views', raw: summary.avg_views, iconName: 'chart',
        foot: `Tasa de aprobacion ${percent(summary.approval_rate)}`
      }),
      statCard({
        label: 'Generado por tu contenido', raw: summary.earned_robux, unit: 'R$',
        variant: 'stat--accent', iconName: 'coins', foot: 'Total acreditado'
      })
    ),

    h('div', { class: 'grid grid--main section' },
      h('div', { class: 'card stack gap-18' },
        h('div', { class: 'row between gap-12 wrap' },
          h('div', { class: 'stack gap-4' },
            h('h2', {}, 'Niveles del programa'),
            h('p', { class: 'small muted' }, 'Cumples el requisito con suscriptores o con media de views, lo que te favorezca.')
          ),
          h('span', { class: 'stat__icon' }, icon('sponsors', { size: 16 }))
        ),
        ladder,
        h('p', { class: 'tiny dim' }, tiers.upgrade_note)
      ),
      tierPanel({
        tier: tiers.current,
        nextTier: tiers.next,
        progress: tiers.progress,
        note: tiers.upgrade_note
      })
    ),

    h('div', { class: 'grid grid--2 section' },
      earningsFormulaPanel(tiers.earnings_model, {
        exampleRate: tiers.current ? tiers.current.rates.short_form : null
      }),
      h('div', { class: 'card stack gap-16' },
        h('div', { class: 'row between gap-12' },
          h('h2', {}, 'Tus cifras'),
          h('span', { class: 'stat__icon' }, icon('trending', { size: 16 }))
        ),
        h('div', { class: 'detail-list' },
          row('Suscriptores registrados', number(tiers.creator_stats.subscribers)),
          row('Media de views por video', number(tiers.creator_stats.avg_views)),
          row('Videos enviados', number(summary.submissions_total)),
          row('Videos aprobados', number(summary.submissions_approved)),
          row('Videos rechazados', number(summary.submissions_rejected)),
          row('En revision', number(summary.submissions_in_review)),
          summary.best_video
            ? row('Mejor video', h('span', { class: 'num strong' }, `${compact(summary.best_video.views)} views`))
            : null
        ),
        h('p', { class: 'tiny dim' },
          'Suscriptores y media de views los actualiza el staff al revisar tu canal.')
      )
    ),

    h('div', { class: 'section' }, codeUsagePanel(usage))
  ));
}

function row(label, value) {
  return h('div', { class: 'detail-row' },
    h('span', { class: 'detail-row__label' }, label),
    h('span', { class: 'detail-row__value strong' }, value)
  );
}

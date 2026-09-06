/** Tablas y paneles de detalle compartidos entre paginas. */

import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { date, dateTime, number, robux, shortUrl, platformLabel, relative } from '../core/format.js';
import { badge, emptyState, detailRow, robuxCell } from './ui.js';
import { openModal, confirmDialog } from './modal.js';
import { api } from '../core/api.js';
import { toastSuccess, toastError } from './toast.js';

/* ------------------------- Detalle de un envio --------------------- */
export function openSubmissionDetail(submission) {
  const s = submission;
  openModal({
    title: `Envio ${s.public_id}`,
    subtitle: s.content_label,
    content: h('div', { class: 'stack gap-16' },
      h('div', { class: 'row between gap-12 wrap' },
        badge(s.status, s.status_label),
        h('a', {
          class: 'btn btn--sm btn--ghost', href: s.url, target: '_blank', rel: 'noopener noreferrer'
        }, icon('external', { size: 14 }), 'Abrir video')
      ),
      h('div', { class: 'detail-list' },
        detailRow('Enlace', h('a', {
          href: s.url, target: '_blank', rel: 'noopener noreferrer', class: 'small'
        }, shortUrl(s.url, 34))),
        detailRow('Plataforma', platformLabel(s.platform)),
        detailRow('Tipo de contenido', s.content_label),
        detailRow('Views declaradas', h('span', { class: 'num' }, number(s.views_reported))),
        detailRow('Views verificadas', s.views_verified === null
          ? h('span', { class: 'dim' }, 'Pendiente de revision')
          : h('span', { class: 'num strong' }, number(s.views_verified))),
        detailRow('Tier aplicado', s.tier_key || '—'),
        detailRow('Tasa por 1.000 views', h('span', { class: 'num' }, robux(s.rate_per_1k))),
        detailRow(
          s.final_robux ? 'Ganancia' : 'Ganancia estimada',
          robuxCell(s.final_robux || s.estimated_robux, { positive: true })
        ),
        detailRow('Enviado', dateTime(s.created_at)),
        detailRow('Revisado', s.reviewed_at ? dateTime(s.reviewed_at) : h('span', { class: 'dim' }, '—')),
        detailRow('Pagado', s.paid_at ? dateTime(s.paid_at) : h('span', { class: 'dim' }, '—'))
      ),
      s.staff_note
        ? h('div', { class: `alert alert--${s.status === 'rejected' ? 'danger' : 'info'}` },
            h('span', { class: 'alert__icon' }, icon('info', { size: 16 })),
            h('div', {},
              h('div', { class: 'strong', style: { marginBottom: '3px' } }, 'Comentario del staff'),
              h('div', {}, s.staff_note))
          )
        : null,
      s.status === 'in_review' || s.status === 'pending'
        ? h('p', { class: 'tiny dim' },
            'El staff comprueba las views contra el enlace antes de aprobar. La ganancia final se calcula con las views verificadas.')
        : null
    ),
    actions: [{ label: 'Cerrar', variant: 'ghost' }]
  });
}

/* ------------------------- Tabla de envios ------------------------- */
export function submissionsTable(items, { compactMode = false } = {}) {
  if (!items.length) {
    return emptyState({
      iconName: 'upload',
      title: 'Aun no has enviado contenido',
      text: 'Publica un video con MM2 Trades y tu codigo, y envialo para empezar a generar ganancias.'
    });
  }

  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table table--cards' },
      h('thead', {},
        h('tr', {},
          h('th', {}, 'Enviado'),
          h('th', {}, 'Contenido'),
          h('th', { class: 'right' }, 'Views'),
          compactMode ? null : h('th', { class: 'right' }, 'Ganancia'),
          h('th', {}, 'Estado'),
          h('th', { class: 'right' }, '')
        )
      ),
      h('tbody', {},
        ...items.map((s) => h('tr', {},
          h('td', { dataset: { label: 'Enviado' } }, h('span', { class: 'small' }, date(s.created_at))),
          h('td', { dataset: { label: 'Contenido' } },
            h('div', { class: 'stack gap-4' },
              h('span', { class: 'small strong' }, s.content_label),
              h('span', { class: 'tiny dim truncate' }, shortUrl(s.url, 30))
            )
          ),
          h('td', { class: 'right', dataset: { label: 'Views' } },
            h('span', { class: 'num' }, number(s.views))),
          compactMode ? null : h('td', { class: 'right', dataset: { label: 'Ganancia' } },
            s.final_robux
              ? robuxCell(s.final_robux, { positive: true })
              : h('span', { class: 'dim num small' }, `~ ${robux(s.estimated_robux)}`)
          ),
          h('td', { dataset: { label: 'Estado' } }, badge(s.status, s.status_label)),
          h('td', { class: 'right', dataset: { label: '' } },
            h('button', {
              class: 'btn btn--sm btn--ghost', type: 'button',
              onClick: () => openSubmissionDetail(s)
            }, 'Ver')
          )
        ))
      )
    )
  );
}

/* ------------------------- Tabla de retiros ------------------------ */
export function withdrawalsTable(items, { onChanged = null } = {}) {
  if (!items.length) {
    return emptyState({
      iconName: 'wallet',
      title: 'Sin retiros todavia',
      text: 'Cuando tengas saldo disponible podras retirarlo en Robux o en items de MM2.'
    });
  }

  const cancel = async (w) => {
    const ok = await confirmDialog({
      title: 'Cancelar retiro',
      message: `Vas a cancelar ${w.public_id}. El importe volvera a tu saldo disponible.`,
      confirmLabel: 'Cancelar retiro',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      await api.cancelWithdrawal(w.id);
      toastSuccess('Retiro cancelado', 'El saldo ya esta de nuevo disponible.');
      if (onChanged) onChanged();
    } catch (err) {
      toastError('No se pudo cancelar', err.message);
    }
  };

  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table table--cards' },
      h('thead', {},
        h('tr', {},
          h('th', {}, 'Fecha'),
          h('th', {}, 'Metodo'),
          h('th', { class: 'right' }, 'Importe'),
          h('th', {}, 'Estado'),
          h('th', {}, 'ID'),
          h('th', { class: 'right' }, '')
        )
      ),
      h('tbody', {},
        ...items.map((w) => h('tr', {},
          h('td', { dataset: { label: 'Fecha' } }, h('span', { class: 'small' }, date(w.created_at))),
          h('td', { dataset: { label: 'Metodo' } },
            h('div', { class: 'row gap-8' },
              h('span', {
                class: 'stat__icon',
                style: { width: '26px', height: '26px', borderRadius: '8px' }
              }, icon(w.method === 'robux' ? 'coins' : 'knife', { size: 13 })),
              h('div', { class: 'stack gap-4', style: { minWidth: '0' } },
                h('span', { class: 'small strong' }, w.method_label),
                w.item ? h('span', { class: 'tiny dim truncate' }, w.item.name) : null
              )
            )
          ),
          h('td', { class: 'right', dataset: { label: 'Importe' } }, robuxCell(w.amount_robux)),
          h('td', { dataset: { label: 'Estado' } }, badge(w.status, w.status_label)),
          h('td', { dataset: { label: 'ID' } }, h('span', { class: 'mono tiny dim' }, `#${w.public_id}`)),
          h('td', { class: 'right', dataset: { label: '' } },
            w.status === 'pending'
              ? h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onClick: () => cancel(w) }, 'Cancelar')
              : h('button', {
                  class: 'btn btn--sm btn--ghost', type: 'button',
                  onClick: () => openWithdrawalDetail(w)
                }, 'Ver')
          )
        ))
      )
    )
  );
}

export function openWithdrawalDetail(w) {
  openModal({
    title: `Retiro ${w.public_id}`,
    subtitle: w.method_label,
    content: h('div', { class: 'stack gap-16' },
      badge(w.status, w.status_label),
      w.item
        ? h('div', { class: 'row gap-14' },
            h('div', {
              style: { width: '76px', height: '76px', borderRadius: '14px', overflow: 'hidden', flex: '0 0 auto', background: '#0a0f1c' }
            }, h('img', { src: w.item.image_url, alt: w.item.name, width: 76, height: 76 })),
            h('div', { class: 'stack gap-4' },
              h('strong', {}, w.item.name),
              h('span', { class: 'tiny muted' }, w.item.rarity),
              h('span', { class: 'small robux num strong' }, robux(w.item.value_robux))
            )
          )
        : null,
      h('div', { class: 'detail-list' },
        detailRow('Metodo', w.method_label),
        detailRow('Importe', robuxCell(w.amount_robux)),
        detailRow('Cuenta de Roblox', w.roblox_username || '—'),
        w.roblox_user_id ? detailRow('ID de Roblox', h('span', { class: 'mono small' }, w.roblox_user_id)) : null,
        detailRow('Solicitado', dateTime(w.created_at)),
        detailRow('Actualizado', relative(w.updated_at)),
        detailRow('Completado', w.completed_at ? dateTime(w.completed_at) : h('span', { class: 'dim' }, '—')),
        detailRow('Referencia', h('span', { class: 'mono small' }, `#${w.public_id}`))
      ),
      w.staff_note
        ? h('div', { class: 'alert alert--info' },
            h('span', { class: 'alert__icon' }, icon('info', { size: 16 })),
            h('div', {}, w.staff_note))
        : null
    ),
    actions: [{ label: 'Cerrar', variant: 'ghost' }]
  });
}

/* ------------------------- Historial de ganancias ------------------ */
export function earningsTable(items) {
  if (!items.length) {
    return emptyState({
      iconName: 'coins',
      title: 'Todavia no hay ganancias',
      text: 'En cuanto se apruebe tu primer video veras aqui el detalle de cada pago.'
    });
  }

  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table table--cards' },
      h('thead', {},
        h('tr', {},
          h('th', {}, 'Fecha'),
          h('th', {}, 'Envio'),
          h('th', { class: 'right' }, 'Views'),
          h('th', { class: 'right' }, 'Tasa / 1K'),
          h('th', {}, 'Tier'),
          h('th', { class: 'right' }, 'Ganancia')
        )
      ),
      h('tbody', {},
        ...items.map((e) => h('tr', {},
          h('td', { dataset: { label: 'Fecha' } }, h('span', { class: 'small' }, date(e.dated_at))),
          h('td', { dataset: { label: 'Envio' } },
            h('div', { class: 'stack gap-4' },
              h('span', { class: 'small strong mono' }, e.public_id),
              h('span', { class: 'tiny dim truncate' }, shortUrl(e.url, 28))
            )
          ),
          h('td', { class: 'right', dataset: { label: 'Views' } }, h('span', { class: 'num' }, number(e.views))),
          h('td', { class: 'right', dataset: { label: 'Tasa / 1K' } }, h('span', { class: 'num small muted' }, robux(e.rate))),
          h('td', { dataset: { label: 'Tier' } }, h('span', { class: 'badge badge--tier' }, e.tier_key || '—')),
          h('td', { class: 'right', dataset: { label: 'Ganancia' } }, robuxCell(e.robux, { positive: true }))
        ))
      )
    )
  );
}

/* ------------------------- Actividad reciente ---------------------- */
const ACTIVITY = {
  submission:        { icon: 'upload', color: 'var(--info)',   text: (a) => `Video ${a.ref} enviado a revision` },
  submission_review: {
    icon: 'check', color: 'var(--robux)',
    text: (a) => a.state === 'approved' || a.state === 'paid'
      ? `Video ${a.ref} aprobado`
      : a.state === 'rejected' ? `Video ${a.ref} rechazado` : `Video ${a.ref} revisado`
  },
  withdrawal:        { icon: 'wallet', color: 'var(--brand-soft)', text: (a) => `Retiro ${a.ref} solicitado` },
  withdrawal_update: {
    icon: 'coins', color: 'var(--robux)',
    text: (a) => a.state === 'completed' ? `Retiro ${a.ref} completado`
      : a.state === 'processing' ? `Retiro ${a.ref} en proceso`
      : a.state === 'cancelled' ? `Retiro ${a.ref} cancelado`
      : `Retiro ${a.ref} actualizado`
  }
};

export function activityTimeline(items) {
  if (!items.length) {
    return emptyState({
      iconName: 'clock', title: 'Sin actividad todavia',
      text: 'Aqui apareceran tus envios, revisiones y retiros.'
    });
  }

  return h('div', { class: 'timeline' },
    ...items.map((a) => {
      const conf = ACTIVITY[a.kind] || ACTIVITY.submission;
      const showAmount = a.amount > 0 && (a.kind === 'submission_review' ? ['approved', 'paid'].includes(a.state) : a.kind !== 'submission');
      return h('div', { class: 'timeline__item' },
        h('div', { class: 'timeline__rail' },
          h('span', { class: 'timeline__dot', style: { color: conf.color } }, icon(conf.icon, { size: 14 })),
          h('span', { class: 'timeline__line' })
        ),
        h('div', { class: 'grow', style: { paddingTop: '4px' } },
          h('div', { class: 'row between gap-12 wrap' },
            h('span', { class: 'small' }, conf.text(a)),
            showAmount
              ? h('span', { class: 'small num strong', style: { color: conf.color } },
                  a.kind === 'submission_review' ? `+${robux(a.amount)}` : robux(a.amount))
              : null
          ),
          h('span', { class: 'tiny dim' }, relative(a.at))
        )
      );
    })
  );
}

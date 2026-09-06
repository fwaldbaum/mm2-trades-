/** Historial: envios, ganancias y retiros. */

import { h, mount, clear } from '../core/dom.js';
import { api } from '../core/api.js';
import { robux, number } from '../core/format.js';
import { statCard, pageSkeleton, alert, segmented } from '../components/ui.js';
import { submissionsTable, withdrawalsTable, earningsTable } from '../components/tables.js';

const TABS = [
  { value: 'submissions', label: 'Envios' },
  { value: 'earnings', label: 'Ganancias' },
  { value: 'withdrawals', label: 'Retiros' }
];

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'in_review', label: 'En revision' },
  { value: 'approved', label: 'Aprobados' },
  { value: 'rejected', label: 'Rechazados' }
];

export async function historyPage({ outlet, query }) {
  mount(outlet, pageSkeleton({ stats: 3, chart: false }));

  let balance;
  let submissions;
  let earnings;
  let withdrawals;
  try {
    [balance, submissions, earnings, withdrawals] = await Promise.all([
      api.balance(),
      api.submissions({ limit: 100 }),
      api.earnings({ limit: 100 }),
      api.withdrawals({ limit: 100 })
    ]);
  } catch (err) {
    return mount(outlet, h('div', { class: 'page' },
      alert(err.message, { type: 'danger', title: 'No se pudo cargar el historial' })));
  }

  let tab = TABS.some((t) => t.value === query.get('tab')) ? query.get('tab') : 'submissions';
  let statusFilter = '';

  const body = h('div', { class: 'card card--flush' });
  const filterBox = h('div');

  const paint = () => {
    clear(filterBox);
    if (tab === 'submissions') {
      filterBox.appendChild(segmented(STATUS_FILTERS, statusFilter, (value) => {
        statusFilter = value;
        paint();
      }));
    }

    if (tab === 'submissions') {
      const rows = statusFilter
        ? submissions.filter((s) => s.status === statusFilter)
        : submissions;
      mount(body, submissionsTable(rows));
    } else if (tab === 'earnings') {
      mount(body, earningsTable(earnings.items));
    } else {
      mount(body, withdrawalsTable(withdrawals, { onChanged: () => historyPage({ outlet, query }) }));
    }
  };

  const totalEarningsRows = earnings.items.reduce((acc, e) => acc + e.robux, 0);

  mount(outlet, h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', { class: 'stack gap-10' },
        h('span', { class: 'badge badge--brand' }, 'Historial' ),
        h('h1', {}, 'Tu historial'),
        h('p', { class: 'muted' }, 'Todo lo que has enviado, ganado y retirado, en un solo sitio.')
      )
    ),

    h('div', { class: 'grid grid--3' },
      statCard({
        label: 'Ganancias acreditadas', raw: totalEarningsRows, unit: 'R$',
        iconName: 'coins', foot: `${earnings.items.length} pago(s)`
      }),
      statCard({
        label: 'Retirado', raw: balance.withdrawn, unit: 'R$',
        iconName: 'wallet', foot: `${withdrawals.filter((w) => w.status === 'completed').length} retiro(s) completado(s)`
      }),
      statCard({
        label: 'Envios', value: number(submissions.length), animate: false,
        iconName: 'upload',
        foot: `${submissions.filter((s) => ['approved', 'paid'].includes(s.status)).length} aprobado(s)`
      })
    ),

    h('div', { class: 'section' },
      h('div', { class: 'section-title' },
        segmented(TABS, tab, (value) => {
          tab = value;
          statusFilter = '';
          history.replaceState({}, '', `/history?tab=${value}`);
          paint();
        }),
        filterBox
      ),
      body
    )
  ));

  paint();
}

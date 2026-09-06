/**
 * Retiros.
 *
 * REGLA DEL PROGRAMA: los unicos metodos son Robux e items de Murder
 * Mystery 2. Esta pantalla solo pinta los metodos que devuelve el servidor,
 * y el servidor solo admite esos dos.
 */

import { h, mount, clear } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { api } from '../core/api.js';
import { setState } from '../core/store.js';
import { number, robux } from '../core/format.js';
import { statCard, field, actionButton, alert, emptyState, pageSkeleton, badge } from '../components/ui.js';
import { confirmDialog } from '../components/modal.js';
import { detailRow } from '../components/ui.js';
import { withdrawalsTable } from '../components/tables.js';
import { toastSuccess, toastError } from '../components/toast.js';

const METHOD_META = {
  robux:    { icon: 'coins', title: 'Robux' },
  mm2_item: { icon: 'knife', title: 'Items MM2' }
};

export async function withdrawPage({ outlet }) {
  mount(outlet, pageSkeleton({ stats: 3, chart: false }));

  let meta;
  let catalog;
  let history;
  try {
    [meta, catalog, history] = await Promise.all([
      api.withdrawalMeta(), api.items(), api.withdrawals({ limit: 20 })
    ]);
  } catch (err) {
    return mount(outlet, h('div', { class: 'page' },
      alert(err.message, { type: 'danger', title: 'No se pudo cargar la pantalla de retiros' })));
  }

  const state = {
    method: meta.methods[0] ? meta.methods[0].key : 'robux',
    item: null,
    balance: meta.balance
  };

  const formBox = h('div');
  const summaryBox = h('div');
  const historyBox = h('div', { class: 'card card--flush' },
    withdrawalsTable(history, { onChanged: () => withdrawPage({ outlet }) }));

  /* ------------------------- Selector de metodo --------------------- */
  const methodCards = h('div', { class: 'method-grid' });
  const paintMethods = () => {
    clear(methodCards);
    meta.methods.forEach((m) => {
      const conf = METHOD_META[m.key] || { icon: 'wallet', title: m.label };
      methodCards.appendChild(h('button', {
        class: `method-card ${state.method === m.key ? 'is-selected' : ''}`,
        type: 'button',
        'aria-pressed': String(state.method === m.key),
        onClick: () => { state.method = m.key; state.item = null; paintMethods(); paintForm(); }
      },
        h('span', { class: 'method-card__icon' }, icon(conf.icon, { size: 20 })),
        h('span', { class: 'method-card__title' }, conf.title),
        h('span', { class: 'tiny muted' }, m.description)
      ));
    });
  };

  /* ------------------------- Cuenta de Roblox ----------------------- */
  const robloxUser = h('input', {
    class: 'input', id: 'rbx-user', type: 'text', autocomplete: 'off',
    placeholder: 'TuUsuarioRoblox', value: meta.roblox.username || ''
  });
  const robloxId = h('input', {
    class: 'input', id: 'rbx-id', type: 'text', inputmode: 'numeric',
    placeholder: 'Opcional', value: meta.roblox.user_id || ''
  });
  const fUser = field({ label: 'Usuario de Roblox', input: robloxUser, id: 'rbx-user' });
  const fId = field({
    label: 'ID de Roblox', input: robloxId, id: 'rbx-id',
    hint: 'Nos ayuda a encontrar tu cuenta sin errores.'
  });

  const robloxBlock = h('div', { class: 'stack gap-16' },
    h('div', { class: 'form-grid' }, fUser, fId),
    h('div', { class: 'alert' },
      h('span', { class: 'alert__icon' }, icon('shield', { size: 16 })),
      h('div', {},
        h('div', { class: 'strong', style: { marginBottom: '3px' } }, 'Nunca pedimos datos sensibles'),
        h('div', { class: 'small muted' },
          'MM2 Trades no solicita tu contrasena de Roblox, cookies, .ROBLOSECURITY ni tokens. Solo necesitamos tu usuario para entregarte el pago.')
      )
    )
  );

  /* ------------------------- Formulario ----------------------------- */
  const amountInput = h('input', {
    class: 'input', id: 'amount', type: 'text', inputmode: 'numeric', placeholder: '0'
  });
  const fAmount = field({
    label: 'Cantidad', id: 'amount',
    input: h('div', { class: 'input-group' }, amountInput,
      h('span', { class: 'input-group__suffix' },
        h('span', {}, 'R$'),
        h('button', {
          class: 'btn btn--sm btn--ghost', type: 'button',
          onClick: () => { amountInput.value = String(state.balance.available); amountInput.dispatchEvent(new Event('input')); }
        }, 'Maximo')
      )
    ),
    hint: `Minimo ${robux(meta.limits.min_robux)} · maximo ${robux(meta.limits.max_robux_per_request)} por solicitud.`
  });
  // El grupo de entrada envuelve al input; el marcador de error debe ir sobre el.
  fAmount.setError = ((original) => (message) => {
    original(message);
    amountInput.classList.toggle('has-error', !!message);
  })(fAmount.setError);

  const paintSummary = () => {
    const amount = state.method === 'robux'
      ? Number(String(amountInput.value).replace(/[^\d]/g, '')) || 0
      : (state.item ? state.item.value_robux : 0);
    const remaining = state.balance.available - amount;

    mount(summaryBox, h('div', {
      class: 'stack gap-10',
      style: {
        padding: '16px', borderRadius: 'var(--r-md)',
        border: '1px solid var(--line-strong)', background: 'rgba(6,9,17,.5)'
      }
    },
      h('span', { class: 'label' }, 'Resumen'),
      h('div', { class: 'detail-list' },
        detailRow('Recibiras', state.method === 'robux'
          ? h('span', { class: 'strong robux num' }, `${number(amount)} Robux`)
          : (state.item
              ? h('span', { class: 'strong' }, state.item.name)
              : h('span', { class: 'dim' }, 'Selecciona un item'))),
        detailRow('Coste del saldo', h('span', { class: 'num strong' }, robux(amount))),
        detailRow('Saldo restante',
          h('span', { class: `num ${remaining < 0 ? 'danger' : ''}`, style: remaining < 0 ? { color: 'var(--danger)' } : {} },
            robux(Math.max(remaining, 0))))
      )
    ));
  };
  amountInput.addEventListener('input', paintSummary);

  /* ------------------------- Catalogo de items ---------------------- */
  const itemsBox = h('div', { class: 'stack gap-20' });
  const paintItems = () => {
    clear(itemsBox);
    if (!catalog.groups.length) {
      itemsBox.appendChild(emptyState({
        iconName: 'gift', title: 'Catalogo vacio',
        text: 'Todavia no hay items publicados. Vuelve a intentarlo mas tarde.'
      }));
      return;
    }
    catalog.groups.forEach((group) => {
      const grid = h('div', { class: 'items-grid' });
      group.items.forEach((item) => {
        const affordable = item.value_robux <= state.balance.available;
        const disabled = !item.available || !affordable;
        const card = h('button', {
          class: `item-card ${state.item && state.item.id === item.id ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`,
          type: 'button',
          disabled,
          style: { '--rarity': `var(--r-${item.rarity})` },
          title: !item.available ? 'Sin stock' : (!affordable ? 'Saldo insuficiente' : item.name),
          onClick: () => { state.item = item; paintItems(); paintSummary(); }
        },
          h('span', { class: 'item-card__check' }, icon('check', { size: 13 })),
          h('span', { class: 'item-card__img' },
            h('img', { src: item.image_url, alt: item.name, loading: 'lazy', width: 158, height: 158 })),
          h('span', { class: 'rarity-tag' }, item.rarity_label),
          h('span', { class: 'item-card__name' }, item.name),
          h('span', { class: 'row between gap-8' },
            h('span', { class: 'item-card__value' }, robux(item.value_robux)),
            h('span', { class: 'tiny dim' }, item.available ? `x${item.stock}` : 'Agotado')
          )
        );
        grid.appendChild(card);
      });
      itemsBox.appendChild(h('div', { class: 'stack gap-12' },
        h('div', { class: 'row between gap-12' },
          h('span', { class: 'rarity-tag', style: { '--rarity': `var(--r-${group.rarity})`, fontSize: '11.5px' } }, group.label),
          h('span', { class: 'tiny dim' }, `${group.items.length} item(s)`)
        ),
        grid
      ));
    });
  };

  /* ------------------------- Envio ---------------------------------- */
  const submit = async () => {
    fAmount.setError(null);
    fUser.setError(null);
    fId.setError(null);

    const payload = {
      method: state.method,
      roblox_username: robloxUser.value.trim(),
      roblox_user_id: robloxId.value.trim() || undefined
    };
    let amount;
    if (state.method === 'robux') {
      amount = Number(String(amountInput.value).replace(/[^\d]/g, '')) || 0;
      if (!amount) return fAmount.setError('Indica cuantos Robux quieres retirar.');
      payload.amount_robux = amount;
    } else {
      if (!state.item) return toastError('Selecciona un item', 'Elige una recompensa del catalogo.');
      amount = state.item.value_robux;
      payload.item_id = state.item.id;
    }

    const ok = await confirmDialog({
      title: 'Confirmar retiro',
      message: state.method === 'robux'
        ? `Vas a solicitar ${number(amount)} Robux a la cuenta ${payload.roblox_username}.`
        : `Vas a canjear "${state.item.name}" por ${robux(amount)} de tu saldo.`,
      confirmLabel: 'Confirmar',
      variant: state.method === 'robux' ? 'robux' : 'primary',
      details: h('div', { class: 'detail-list' },
        detailRow('Metodo', state.method === 'robux' ? 'Robux' : 'Item MM2'),
        detailRow('Coste', h('span', { class: 'num strong' }, robux(amount))),
        detailRow('Cuenta', payload.roblox_username),
        detailRow('Saldo tras el retiro', h('span', { class: 'num' }, robux(state.balance.available - amount)))
      )
    });
    if (!ok) return;

    try {
      const result = await api.requestWithdrawal(payload);
      toastSuccess('Retiro solicitado', `${result.withdrawal.public_id} esta en cola de procesamiento.`);
      const profile = await api.me();
      setState({ profile });
      withdrawPage({ outlet });
    } catch (err) {
      const map = { amount_robux: fAmount, roblox_username: fUser, roblox_user_id: fId };
      const target = err.details && map[err.details.field];
      if (target) target.setError(err.message);
      else if (['amount_below_min', 'amount_above_max', 'insufficient_balance'].includes(err.code)) {
        fAmount.setError(err.message);
      } else if (err.code === 'roblox_account_required') fUser.setError(err.message);
      else toastError('No se pudo solicitar el retiro', err.message);
    }
  };

  const paintForm = () => {
    const isRobux = state.method === 'robux';
    mount(formBox,
      isRobux
        ? h('div', { class: 'stack gap-16' }, fAmount, robloxBlock)
        : h('div', { class: 'stack gap-20' },
            h('div', { class: 'stack gap-6' },
              h('h3', {}, 'Elige tu recompensa'),
              h('p', { class: 'small muted' }, 'El valor del item se descuenta de tu saldo disponible.')
            ),
            itemsBox,
            robloxBlock
          )
    );
    if (!isRobux) paintItems();
    paintSummary();
  };

  const submitBtn = actionButton('Solicitar retiro', {
    variant: 'robux', iconName: 'wallet', block: true, onClick: submit
  });

  /* ------------------------- Composicion ---------------------------- */
  mount(outlet, h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', { class: 'stack gap-10' },
        h('span', { class: 'badge badge--brand' }, 'Retiros'),
        h('h1', {}, 'Retirar tu saldo'),
        h('p', { class: 'muted' }, 'Solo dos formas de cobrar: Robux o items de Murder Mystery 2.')
      )
    ),

    h('div', { class: 'grid grid--3' },
      statCard({
        label: 'Disponible', raw: state.balance.available, unit: 'R$',
        variant: 'stat--accent', iconName: 'coins', foot: 'Listo para retirar'
      }),
      statCard({
        label: 'En curso', raw: state.balance.locked, unit: 'R$',
        iconName: 'clock', foot: 'Retenido en retiros abiertos'
      }),
      statCard({
        label: 'Total retirado', raw: state.balance.withdrawn, unit: 'R$',
        iconName: 'wallet', foot: 'Pagos completados'
      })
    ),

    meta.limits.requires_roblox_verification && !meta.roblox.verified
      ? h('div', { class: 'section' },
          alert('Verifica tu cuenta de Roblox desde tu perfil antes de solicitar un retiro.',
            { type: 'warn', title: 'Verificacion pendiente' }))
      : null,

    h('div', { class: 'grid grid--withdraw section' },
      h('div', { class: 'card stack gap-20' },
        h('div', { class: 'stack gap-6' },
          h('h2', {}, 'Elige como cobrar'),
          h('p', { class: 'small muted' }, 'Estos son los unicos metodos del programa.')
        ),
        methodCards,
        formBox
      ),
      h('div', { class: 'card stack gap-18 is-sticky' },
        h('h2', {}, 'Confirmacion'),
        summaryBox,
        state.balance.available > 0
          ? submitBtn
          : h('button', { class: 'btn btn--robux btn--block is-disabled', disabled: true, type: 'button' }, 'Sin saldo disponible'),
        h('div', { class: 'stack gap-10' },
          h('div', { class: 'row gap-8 tiny muted' }, icon('clock', { size: 13 }), meta.processing_note),
          h('div', { class: 'row gap-8 tiny muted' }, icon('info', { size: 13 }),
            `Puedes tener hasta ${meta.limits.max_open_requests} retiros abiertos a la vez.`),
          h('div', { class: 'row gap-8 tiny muted' }, icon('shield', { size: 13 }),
            'Todos los retiros los revisa el staff antes de pagarse.')
        )
      )
    ),

    h('div', { class: 'section' },
      h('div', { class: 'section-title' }, h('h2', {}, 'Historial de retiros')),
      historyBox
    )
  ));

  paintMethods();
  paintForm();
}

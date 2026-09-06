/** Como funciona el programa, reglas y seguridad. */

import { h, mount } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { api } from '../core/api.js';
import { robux } from '../core/format.js';
import { pageSkeleton, alert, sectionTitle } from '../components/ui.js';

const STEPS = [
  { title: 'Entra al programa', text: 'Crea tu cuenta de creador o solicita el acceso al staff en Discord.' },
  { title: 'Recibe tu codigo', text: 'Al activarse tu cuenta se genera tu codigo unico de creador.' },
  { title: 'Crea contenido', text: 'Publica videos mencionando MM2 Trades y mostrando tu codigo en pantalla.' },
  { title: 'Envia el video', text: 'Pega el enlace en el dashboard y elige el tipo de contenido.' },
  { title: 'El staff lo revisa', text: 'Comprobamos las views reales y que el video cumpla las reglas.' },
  { title: 'Se acredita tu saldo', text: 'La ganancia aprobada entra en tu balance y no caduca nunca.' },
  { title: 'Retira cuando quieras', text: 'Cobra en Robux o canjea items de Murder Mystery 2.' }
];

const SAFETY = [
  'Nunca compartas tu contrasena de Roblox con nadie, tampoco con el staff.',
  'No entregues cookies de sesion, .ROBLOSECURITY ni tokens de acceso: MM2 Trades jamas los pide.',
  'Usa unicamente los canales oficiales del programa para hablar con el equipo.',
  'Desconfia de cualquiera que te ofrezca pagos fuera de este dashboard.',
  'Si detectas actividad sospechosa en tu cuenta, avisa al staff de inmediato.'
];

export async function helpPage({ outlet }) {
  mount(outlet, pageSkeleton({ stats: 0, chart: false }));

  let program;
  try {
    program = await api.program();
  } catch (err) {
    return mount(outlet, h('div', { class: 'page' },
      alert(err.message, { type: 'danger', title: 'No se pudo cargar la ayuda' })));
  }

  const rules = Array.isArray(program.submission.rules) ? program.submission.rules : [];

  mount(outlet, h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', { class: 'stack gap-10' },
        h('span', { class: 'badge badge--brand' }, 'Ayuda'),
        h('h1', {}, 'Como funciona'),
        h('p', { class: 'muted' }, 'Del primer video al primer retiro, paso a paso.')
      )
    ),

    h('div', { class: 'steps' },
      ...STEPS.map((s, i) => h('div', { class: 'step' },
        h('span', { class: 'step__num' }, String(i + 1)),
        h('h3', {}, s.title),
        h('p', { class: 'small muted', style: { marginTop: '6px' } }, s.text)
      ))
    ),

    h('div', { class: 'grid grid--2 section' },
      h('div', { class: 'card stack gap-16' },
        h('div', { class: 'row between gap-12' },
          h('h2', {}, 'Que hace valido un video'),
          h('span', { class: 'stat__icon' }, icon('check', { size: 16 }))
        ),
        rules.length
          ? h('ul', { class: 'rules-list' },
              ...rules.map((r) => h('li', {}, icon('check', { size: 14, cls: 'robux' }), h('span', {}, r))))
          : h('p', { class: 'small muted' }, 'El staff aun no ha publicado las reglas de envio.'),
        h('div', { class: 'detail-list', style: { marginTop: '4px' } },
          h('div', { class: 'detail-row' },
            h('span', { class: 'detail-row__label' }, 'Envios por dia'),
            h('span', { class: 'detail-row__value strong' }, String(program.submission.max_per_day))),
          h('div', { class: 'detail-row' },
            h('span', { class: 'detail-row__label' }, 'Plazo para enviar (formato corto)'),
            h('span', { class: 'detail-row__value strong' }, `${program.submission.window_days.short_form} dias`)),
          h('div', { class: 'detail-row' },
            h('span', { class: 'detail-row__label' }, 'Plazo para enviar (formato largo)'),
            h('span', { class: 'detail-row__value strong' }, `${program.submission.window_days.long_form} dias`))
        )
      ),

      h('div', { class: 'card stack gap-16' },
        h('div', { class: 'row between gap-12' },
          h('h2', {}, 'Como se paga'),
          h('span', { class: 'stat__icon' }, icon('wallet', { size: 16 }))
        ),
        h('p', { class: 'small muted' },
          'El programa paga siempre en Robux. Puedes cobrarlos directamente o canjearlos por items de Murder Mystery 2 del catalogo.'),
        h('div', { class: 'method-grid' },
          h('div', { class: 'method-card', style: { cursor: 'default' } },
            h('span', { class: 'method-card__icon' }, icon('coins', { size: 19 })),
            h('span', { class: 'method-card__title' }, 'Robux'),
            h('span', { class: 'tiny muted' }, 'Se envian a tu cuenta de Roblox.')),
          h('div', { class: 'method-card', style: { cursor: 'default' } },
            h('span', { class: 'method-card__icon' }, icon('knife', { size: 19 })),
            h('span', { class: 'method-card__title' }, 'Items MM2'),
            h('span', { class: 'tiny muted' }, 'Se entregan dentro del juego.'))
        ),
        h('div', { class: 'detail-list' },
          h('div', { class: 'detail-row' },
            h('span', { class: 'detail-row__label' }, 'Retiro minimo'),
            h('span', { class: 'detail-row__value strong num' }, robux(program.withdrawal.min_robux))),
          h('div', { class: 'detail-row' },
            h('span', { class: 'detail-row__label' }, 'Maximo por solicitud'),
            h('span', { class: 'detail-row__value strong num' }, robux(program.withdrawal.max_robux_per_request))),
          h('div', { class: 'detail-row' },
            h('span', { class: 'detail-row__label' }, 'Retiros abiertos a la vez'),
            h('span', { class: 'detail-row__value strong' }, String(program.withdrawal.max_open_requests)))
        ),
        h('p', { class: 'tiny dim' }, program.withdrawal.processing_note),
        h('div', { class: 'alert alert--info' },
          h('span', { class: 'alert__icon' }, icon('info', { size: 16 })),
          h('div', {}, 'No existen otros metodos de cobro. El programa no paga con dinero real, transferencias, tarjetas, cripto ni gift cards.'))
      )
    ),

    h('div', { class: 'section' },
      sectionTitle('Seguridad'),
      h('div', { class: 'card stack gap-16' },
        h('div', { class: 'alert alert--danger' },
          h('span', { class: 'alert__icon' }, icon('shield', { size: 17 })),
          h('div', {},
            h('div', { class: 'strong', style: { marginBottom: '3px' } }, 'MM2 Trades nunca te pedira credenciales'),
            h('div', {}, 'Ni contrasena de Roblox, ni cookies, ni .ROBLOSECURITY, ni tokens. Si alguien te los pide en nombre del programa, es una estafa.'))
        ),
        h('ul', { class: 'rules-list' },
          ...SAFETY.map((s) => h('li', {}, icon('shield', { size: 14, cls: 'muted' }), h('span', {}, s))))
      )
    ),

    h('p', { class: 'tiny dim center section' }, program.disclaimer)
  ));
}

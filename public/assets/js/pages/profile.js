/** Perfil del creador: datos, verificacion segura de Roblox y contrasena. */

import { h, mount } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { api } from '../core/api.js';
import { setState } from '../core/store.js';
import { date, number, robux } from '../core/format.js';
import {
  field, actionButton, alert, pageSkeleton, copyButton, detailRow, sectionTitle, badge
} from '../components/ui.js';
import { toastSuccess, toastError } from '../components/toast.js';

export async function profilePage({ outlet }) {
  mount(outlet, pageSkeleton({ stats: 0, chart: false }));

  let profile;
  let verification;
  try {
    [profile, verification] = await Promise.all([api.me(), api.verification()]);
  } catch (err) {
    return mount(outlet, h('div', { class: 'page' },
      alert(err.message, { type: 'danger', title: 'No se pudo cargar el perfil' })));
  }

  /* ------------------------- Datos editables ------------------------ */
  const displayName = h('input', { class: 'input', id: 'display-name', type: 'text', value: profile.display_name });
  const robloxUser = h('input', { class: 'input', id: 'rbx-user', type: 'text', value: profile.roblox.username || '', placeholder: 'TuUsuarioRoblox' });
  const robloxId = h('input', { class: 'input', id: 'rbx-id', type: 'text', inputmode: 'numeric', value: profile.roblox.user_id || '', placeholder: 'Opcional' });
  const discord = h('input', { class: 'input', id: 'discord', type: 'text', value: profile.contact_discord || '', placeholder: 'tu_usuario' });
  const country = h('input', { class: 'input', id: 'country', type: 'text', value: profile.country || '', placeholder: 'CL' });

  const fName = field({ label: 'Nombre visible', input: displayName, id: 'display-name' });
  const fRbxUser = field({
    label: 'Usuario de Roblox', input: robloxUser, id: 'rbx-user',
    hint: 'Si lo cambias tendras que volver a verificar la cuenta.'
  });
  const fRbxId = field({ label: 'ID de Roblox', input: robloxId, id: 'rbx-id' });
  const fDiscord = field({ label: 'Discord', input: discord, id: 'discord' });
  const fCountry = field({ label: 'Pais', input: country, id: 'country' });

  const save = async () => {
    [fName, fRbxUser, fRbxId, fDiscord, fCountry].forEach((f) => f.setError(null));
    try {
      const updated = await api.updateProfile({
        display_name: displayName.value.trim(),
        roblox_username: robloxUser.value.trim() || null,
        roblox_user_id: robloxId.value.trim() || null,
        contact_discord: discord.value.trim() || null,
        country: country.value.trim() || null
      });
      setState({ profile: updated });
      toastSuccess('Perfil actualizado');
      profilePage({ outlet });
    } catch (err) {
      const map = {
        display_name: fName, roblox_username: fRbxUser,
        roblox_user_id: fRbxId, contact_discord: fDiscord, country: fCountry
      };
      const target = err.details && map[err.details.field];
      if (target) target.setError(err.message);
      else toastError('No se pudo guardar', err.message);
    }
  };

  /* ------------------------- Verificacion de Roblox ----------------- */
  const verifyBox = h('div', { class: 'stack gap-14' });
  const paintVerification = (v) => {
    mount(verifyBox);
    if (v.verified) {
      verifyBox.appendChild(alert(
        `La cuenta ${v.roblox_username} esta verificada. Ya puedes recibir pagos en ella.`,
        { type: 'success', title: 'Cuenta verificada', iconName: 'shield' }
      ));
      return;
    }
    if (v.request && v.request.status === 'pending') {
      verifyBox.appendChild(h('div', { class: 'stack gap-12' },
        alert('Pega esta frase en la descripcion de tu perfil de Roblox y avisa al staff para que la revise.',
          { type: 'warn', title: 'Verificacion en curso' }),
        h('div', {
          class: 'row between gap-12 wrap',
          style: {
            padding: '14px 16px', borderRadius: 'var(--r-md)',
            border: '1px dashed var(--line-strong)', background: 'rgba(6,9,17,.5)'
          }
        },
          h('span', { class: 'mono small grow', style: { wordBreak: 'break-all' } }, v.request.phrase),
          copyButton(() => v.request.phrase)
        ),
        h('p', { class: 'tiny dim' }, 'Cuando el staff la valide podras quitarla de tu perfil.')
      ));
      return;
    }

    const btn = actionButton('Generar frase de verificacion', {
      variant: 'ghost', iconName: 'shield',
      onClick: async () => {
        const username = robloxUser.value.trim();
        if (!username) return toastError('Falta el usuario', 'Escribe tu usuario de Roblox antes de verificar.');
        try {
          const created = await api.requestVerification(username);
          toastSuccess('Frase generada', 'Pegala en la descripcion de tu perfil de Roblox.');
          paintVerification({ verified: false, roblox_username: username, request: { ...created, status: 'pending' } });
        } catch (err) {
          toastError('No se pudo generar', err.message);
        }
      }
    });
    verifyBox.appendChild(h('div', { class: 'stack gap-12' },
      h('p', { class: 'small muted' },
        'Verificamos tu cuenta con una frase que tu mismo publicas en tu perfil de Roblox. No necesitamos ningun dato privado.'),
      btn
    ));
  };

  /* ------------------------- Contrasena ----------------------------- */
  const currentPw = h('input', { class: 'input', id: 'pw-current', type: 'password', autocomplete: 'current-password' });
  const newPw = h('input', { class: 'input', id: 'pw-new', type: 'password', autocomplete: 'new-password' });
  const fCurrent = field({ label: 'Contrasena actual', input: currentPw, id: 'pw-current' });
  const fNew = field({ label: 'Nueva contrasena', input: newPw, id: 'pw-new', hint: 'Minimo 8 caracteres, con letras y numeros.' });

  const changePassword = async () => {
    fCurrent.setError(null);
    fNew.setError(null);
    try {
      await api.changePassword(currentPw.value, newPw.value);
      currentPw.value = '';
      newPw.value = '';
      toastSuccess('Contrasena actualizada', 'Se cerraron las demas sesiones abiertas.');
    } catch (err) {
      if (err.code === 'password_incorrect') fCurrent.setError(err.message);
      else if (err.details && err.details.field === 'new_password') fNew.setError(err.message);
      else toastError('No se pudo cambiar', err.message);
    }
  };

  /* ------------------------- Composicion ---------------------------- */
  const saveBtn = actionButton('Guardar cambios', { variant: 'primary', onClick: save });
  const pwBtn = actionButton('Cambiar contrasena', { variant: 'ghost', onClick: changePassword });

  mount(outlet, h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', { class: 'row gap-16' },
        h('span', { class: 'avatar avatar--lg' }, profile.initials),
        h('div', { class: 'stack gap-8' },
          h('h1', {}, profile.display_name),
          h('div', { class: 'row gap-10 wrap' },
            h('span', { class: 'badge badge--tier' },
              profile.tier ? `${profile.tier.key} · ${profile.tier.name}` : 'Sin tier'),
            profile.roblox.verified
              ? badge('approved', 'Roblox verificado')
              : badge('pending', 'Roblox sin verificar'),
            h('span', { class: 'tiny dim' }, `Miembro desde ${date(profile.joined_at)}`)
          )
        )
      ),
      h('span', { class: 'code-pill' },
        h('span', { class: 'code-pill__value' }, profile.code),
        copyButton(() => profile.code)
      )
    ),

    h('div', { class: 'grid grid--wide' },
      h('div', { class: 'card stack gap-18' },
        h('div', { class: 'stack gap-4' },
          h('h2', {}, 'Datos de tu cuenta'),
          h('p', { class: 'small muted' }, 'Solo puedes editar estos campos. El tier, el codigo y el balance los gestiona el staff.')
        ),
        h('form', {
          class: 'stack gap-16',
          onSubmit: (e) => { e.preventDefault(); saveBtn.click(); }
        },
          fName,
          h('div', { class: 'form-grid' }, fRbxUser, fRbxId),
          h('div', { class: 'form-grid' }, fDiscord, fCountry)
        ),
        h('div', { class: 'row gap-12' }, saveBtn)
      ),

      h('div', { class: 'stack gap-20' },
        h('div', { class: 'card stack gap-14' },
          h('h2', {}, 'Resumen'),
          h('div', { class: 'detail-list' },
            detailRow('Usuario', `@${profile.username}`),
            detailRow('Correo', profile.email || '—'),
            detailRow('Codigo de creador', h('span', { class: 'mono strong' }, profile.code)),
            detailRow('Tier', profile.tier ? `${profile.tier.key} · ${profile.tier.name}` : '—'),
            detailRow('Alta', date(profile.joined_at)),
            detailRow('Ganancias totales', h('span', { class: 'num strong' }, robux(profile.balance.total_earned))),
            detailRow('Retirado', h('span', { class: 'num' }, robux(profile.balance.withdrawn))),
            detailRow('Disponible', h('span', { class: 'num strong robux' }, robux(profile.balance.available))),
            detailRow('Suscriptores', h('span', { class: 'num' }, number(profile.subscribers)))
          )
        ),

        h('div', { class: 'card stack gap-14' },
          h('div', { class: 'row between gap-12' },
            h('h2', {}, 'Cuenta de Roblox'),
            h('span', { class: 'stat__icon' }, icon('shield', { size: 16 }))
          ),
          verifyBox,
          h('div', {
            class: 'stack gap-8',
            style: { borderTop: '1px solid var(--line)', paddingTop: '14px' }
          },
            h('span', { class: 'label' }, 'Nunca te pediremos'),
            ...verification.never_asked.map((t) => h('div', { class: 'row gap-8 tiny muted' },
              icon('x', { size: 12 }), t))
          )
        )
      )
    ),

    h('div', { class: 'section' },
      sectionTitle('Seguridad de la cuenta'),
      h('div', { class: 'card stack gap-16' },
        h('p', { class: 'small muted' }, 'Cambiar la contrasena cierra el resto de sesiones abiertas.'),
        h('form', {
          class: 'form-grid',
          onSubmit: (e) => { e.preventDefault(); pwBtn.click(); }
        }, fCurrent, fNew),
        h('div', { class: 'row gap-12' }, pwBtn)
      )
    )
  ));

  paintVerification(verification);
}

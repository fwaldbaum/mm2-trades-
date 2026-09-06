/** Acceso y alta de creadores. */

import { h, mount } from '../core/dom.js';
import { icon, logoMark } from '../core/icons.js';
import { api } from '../core/api.js';
import { setState } from '../core/store.js';
import { navigate } from '../core/router.js';
import { field, actionButton } from '../components/ui.js';
import { toastError, toastSuccess } from '../components/toast.js';

export function loginPage({ outlet }) {
  let mode = 'login';

  const render = () => {
    const isLogin = mode === 'login';

    const identifier = h('input', {
      class: 'input', id: 'identifier', type: 'text', autocomplete: 'username',
      placeholder: 'tu@correo.com o tu usuario'
    });
    const emailInput = h('input', {
      class: 'input', id: 'email', type: 'email', autocomplete: 'email', placeholder: 'tu@correo.com'
    });
    const usernameInput = h('input', {
      class: 'input', id: 'username', type: 'text', autocomplete: 'username', placeholder: 'tu_usuario'
    });
    const passwordInput = h('input', {
      class: 'input', id: 'password', type: 'password',
      autocomplete: isLogin ? 'current-password' : 'new-password', placeholder: '••••••••'
    });

    const fIdentifier = field({ label: 'Correo o usuario', input: identifier, id: 'identifier' });
    const fEmail = field({ label: 'Correo', input: emailInput, id: 'email' });
    const fUsername = field({ label: 'Usuario', input: usernameInput, id: 'username' });
    const fPassword = field({
      label: 'Contrasena', input: passwordInput, id: 'password',
      hint: isLogin ? null : 'Minimo 8 caracteres, con letras y numeros.'
    });

    const submit = async () => {
      [fIdentifier, fEmail, fUsername, fPassword].forEach((f) => f.setError(null));
      try {
        const profile = isLogin
          ? await api.login(identifier.value.trim(), passwordInput.value)
          : await api.register({
              email: emailInput.value.trim(),
              username: usernameInput.value.trim(),
              password: passwordInput.value
            });
        setState({ profile });
        toastSuccess(isLogin ? `Hola de nuevo, ${profile.display_name}` : 'Cuenta creada. Bienvenido.');
        navigate('/dashboard', { replace: true });
      } catch (err) {
        const map = {
          email: fEmail, username: fUsername, password: fPassword,
          identifier: fIdentifier, new_password: fPassword
        };
        const target = err.details && map[err.details.field];
        if (target) target.setError(err.message);
        else toastError(isLogin ? 'No se pudo iniciar sesion' : 'No se pudo crear la cuenta', err.message);
      }
    };

    const form = h('form', {
      class: 'stack gap-16',
      onSubmit: (e) => { e.preventDefault(); btn.click(); }
    },
      ...(isLogin ? [fIdentifier] : [fEmail, fUsername]),
      fPassword
    );

    const btn = actionButton(isLogin ? 'Entrar' : 'Crear cuenta', {
      variant: 'primary', block: true, onClick: submit
    });
    form.appendChild(btn);

    const tab = (label, value) => h('button', {
      class: `auth__tab ${mode === value ? 'is-active' : ''}`, type: 'button',
      onClick: () => { mode = value; render(); }
    }, label);

    mount(outlet,
      h('div', { class: 'auth' },
        h('div', { class: 'auth__card' },
          h('div', { class: 'auth__brand' },
            h('span', { class: 'brand__mark', style: { width: '48px', height: '48px', borderRadius: '15px' } }, logoMark(48)),
            h('div', {},
              h('h1', { style: { fontSize: '26px' } }, 'MM2 TRADES'),
              h('p', { class: 'muted small', style: { marginTop: '5px' } }, 'Programa de creadores y patrocinios')
            )
          ),
          h('div', { class: 'card' },
            h('div', { class: 'auth__tabs' }, tab('Iniciar sesion', 'login'), tab('Crear cuenta', 'register')),
            form,
            isLogin
              ? h('div', { class: 'auth__demo' },
                  h('div', { class: 'row gap-8', style: { marginBottom: '6px' } },
                    icon('info', { size: 14 }), h('strong', {}, 'Cuenta de demostracion')),
                  h('div', { class: 'mono tiny' }, 'demo@mm2trades.gg · mm2trades2026'),
                  h('button', {
                    class: 'btn btn--sm btn--ghost', type: 'button', style: { marginTop: '10px' },
                    onClick: () => {
                      identifier.value = 'demo@mm2trades.gg';
                      passwordInput.value = 'mm2trades2026';
                      btn.click();
                    }
                  }, 'Entrar con la demo')
                )
              : h('p', { class: 'tiny dim center', style: { marginTop: '16px' } },
                  'Al crear la cuenta entras en el tier inicial y recibes tu codigo de creador.')
          ),
          h('p', { class: 'tiny dim center', style: { marginTop: '18px' } },
            'Nunca te pediremos tu contrasena de Roblox, cookies ni tokens.')
        )
      )
    );

    (isLogin ? identifier : emailInput).focus();
  };

  render();
}

import { el } from '../dom.js';
import { createPassword, unlock, exportKey } from '../crypto.js';

const AUTH_KEY = 'rd.auth';
const SESSION_KEY = 'rd.session';

function hasPassword() {
  return !!localStorage.getItem(AUTH_KEY);
}

function eyeIcon() {
  return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.9"/></svg>';
}

function lockIcon() {
  return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="10.5" rx="3"/><path d="M8 10.5V7.6A4 4 0 0 1 16 7.6v2.9"/></svg>';
}

function isSecureCryptoContext() {
  return window.isSecureContext && !!(window.crypto && window.crypto.subtle);
}

function renderInsecureWarning(root, ctx) {
  const view = el('div', { class: 'view-lock' }, [
    el('div', { class: 'lock-content' }, [
      el('div', { class: 'logo-mark' }, [
        el('span', { style: 'background:var(--sage);' }),
        el('span', { style: 'background:var(--clay);width:32px;' }),
        el('span', { style: 'background:var(--line);width:22px;' }),
      ]),
      el('h1', { class: 'lock-title' }, ['Registro', el('br'), 'diario']),
      el('p', { class: 'lock-sub' }, 'Este navegador no permite cifrado (WebCrypto) en esta dirección. Es una restricción de seguridad del navegador, no un error de la app: sólo funciona por HTTPS o en localhost.'),
      el('p', { class: 'lock-sub' }, ['Para usarla con contraseña desde el celular en casa, abre la versión publicada en GitHub Pages (HTTPS), o accede desde ', el('code', {}, 'localhost'), ' en esta misma computadora.']),
      el('button', {
        class: 'btn-secondary', type: 'button', style: 'margin-top:18px;',
        onclick: () => ctx.skipLock(),
      }, 'Continuar sin bloqueo (solo para pruebas)'),
    ]),
  ]);
  root.replaceChildren(view);
}

export function render(root, ctx) {
  if (!isSecureCryptoContext()) {
    renderInsecureWarning(root, ctx);
    return;
  }

  const creating = !hasPassword();
  let showPlain = false;
  let keepOpen = false;
  let busy = false;

  const passwordField = el('input', { type: 'password', placeholder: creating ? 'Nueva contraseña' : 'Contraseña', autocomplete: creating ? 'new-password' : 'current-password' });
  const confirmField = creating ? el('input', { type: 'password', placeholder: 'Confirma la contraseña', autocomplete: 'new-password' }) : null;

  const fieldWrap = el('div', { class: 'field-password' }, [
    el('span', { html: lockIcon() }),
    passwordField,
    el('button', {
      class: 'icon-toggle',
      type: 'button',
      'aria-label': 'Mostrar contraseña',
      html: eyeIcon(),
      onclick: () => {
        showPlain = !showPlain;
        passwordField.type = showPlain ? 'text' : 'password';
        if (confirmField) confirmField.type = showPlain ? 'text' : 'password';
      },
    }),
  ]);

  const confirmWrap = confirmField
    ? el('div', { class: 'field-password' }, [
      el('span', { html: lockIcon() }),
      confirmField,
    ])
    : null;

  const errorMsg = el('div', { class: 'lock-error', style: 'display:none;' });

  const submitBtn = el('button', { class: 'btn-primary', type: 'button', style: 'box-shadow: 0 12px 26px -12px rgba(74, 138, 118, 0.85);' }, creating ? 'Crear contraseña' : 'Entrar');

  async function submit() {
    if (busy) return;
    const password = passwordField.value;
    if (!password) return;

    try {
      if (creating) {
        const confirm = confirmField.value;
        if (password !== confirm) {
          errorMsg.textContent = 'Las contraseñas no coinciden.';
          errorMsg.style.display = 'block';
          return;
        }
        busy = true;
        submitBtn.textContent = 'Creando…';
        const { key, auth } = await createPassword(password);
        localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
        if (keepOpen) localStorage.setItem(SESSION_KEY, await exportKey(key));
        await ctx.onUnlocked(key);
        return;
      }

      busy = true;
      submitBtn.textContent = 'Comprobando…';
      const auth = JSON.parse(localStorage.getItem(AUTH_KEY));
      const key = await unlock(password, auth);
      busy = false;
      submitBtn.textContent = 'Entrar';
      if (!key) {
        errorMsg.textContent = 'Contraseña incorrecta.';
        errorMsg.style.display = 'block';
        fieldWrap.classList.remove('shake');
        void fieldWrap.offsetWidth;
        fieldWrap.classList.add('shake');
        passwordField.value = '';
        return;
      }
      if (keepOpen) localStorage.setItem(SESSION_KEY, await exportKey(key));
      await ctx.onUnlocked(key);
    } catch (err) {
      busy = false;
      submitBtn.textContent = creating ? 'Crear contraseña' : 'Entrar';
      errorMsg.textContent = `Algo falló: ${err.message}`;
      errorMsg.style.display = 'block';
    }
  }

  submitBtn.addEventListener('click', submit);
  passwordField.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  if (confirmField) confirmField.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  const switchBtn = el('button', { class: 'switch', type: 'button' }, [el('span', { class: 'knob' })]);
  switchBtn.addEventListener('click', () => {
    keepOpen = !keepOpen;
    switchBtn.classList.toggle('on', keepOpen);
  });

  const view = el('div', { class: 'view-lock' }, [
    el('div', { class: 'lock-blob', style: 'top:-140px;left:-90px;width:380px;height:380px;background:var(--surface-alt);' }),
    el('div', { class: 'lock-blob', style: 'top:40px;right:-130px;width:300px;height:300px;background:var(--surface);' }),
    el('div', { class: 'lock-content' }, [
      el('div', { class: 'logo-mark' }, [
        el('span', { style: 'background:var(--sage);' }),
        el('span', { style: 'background:var(--clay);width:32px;' }),
        el('span', { style: 'background:var(--line);width:22px;' }),
      ]),
      el('h1', { class: 'lock-title' }, ['Registro', el('br'), 'diario']),
      el('p', { class: 'lock-sub' }, creating
        ? 'Primera vez aquí. Crea una contraseña para este cuaderno — no hay forma de recuperarla si la olvidas.'
        : 'Un bloque de tiempo a la vez. Introduce tu contraseña para abrir el cuaderno.'),
      el('div', { class: 'lock-form' }, [
        fieldWrap,
        confirmWrap,
        errorMsg,
        submitBtn,
      ].filter(Boolean)),
      el('div', { class: 'keep-open' }, [
        el('span', { class: 'keep-open-label' }, ['Mantener abierto en este', el('br'), 'dispositivo']),
        switchBtn,
      ]),
    ]),
    el('div', { class: 'lock-note' }, [
      el('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', html: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.8h.01"/>' }),
      el('p', {}, creating
        ? 'La pantalla de bloqueo no cifra tus registros ni el código de la app: sólo protege el token de sincronización y frena a quien tome el teléfono desbloqueado.'
        : 'Tus registros viven en este dispositivo y en tu Gist privado. La contraseña también protege el token de sincronización.'),
    ]),
  ]);

  root.replaceChildren(view);
  passwordField.focus();
}

import { el } from '../dom.js';
import * as store from '../store.js';
import * as gist from '../gist.js';
import { unlock, createPassword, encryptToken, decryptToken } from '../crypto.js';

const THEME_KEY = 'rd.theme';

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function timeAgo(date) {
  if (!date) return null;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function render(root, ctx) {
  let unsubGist = null;

  function draw() {
    const header = el('div', { class: 'settings-header' }, [
      el('button', {
        class: 'icon-btn', style: 'width:40px;height:40px;',
        type: 'button', 'aria-label': 'Volver',
        onclick: () => ctx.navigate('day', { date: ctx.date }),
      }, [el('span', { html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>' })]),
      el('div', { class: 'cal-title' }, 'Ajustes'),
    ]);

    // ---- Tus datos ----
    const summary = store.countSummary();
    const fileInput = el('input', { type: 'file', accept: 'application/json', style: 'display:none;' });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const result = store.importDoc(parsed);
        ctx.confirmDialog({
          title: 'Importación completa',
          body: `${result.newDays} días nuevos, ${result.mergedDays} combinados.`,
          confirmLabel: 'Listo',
          hideCancel: true,
          onConfirm: () => {},
        });
      } catch {
        ctx.confirmDialog({
          title: 'Error al importar',
          body: 'El archivo no tiene un formato JSON válido.',
          confirmLabel: 'Entendido',
          hideCancel: true,
          onConfirm: () => {},
        });
      }
      fileInput.value = '';
    });

    function downloadJson() {
      const data = store.exportDoc();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: `registro-${store.todayLocal()}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    const datosCard = el('div', { class: 'settings-card' }, [
      el('button', { class: 'settings-row', type: 'button', onclick: downloadJson }, [
        el('span', { class: 'settings-row-icon sage', html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11.5"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4.5 19.5h15"/></svg>' }),
        el('span', { class: 'settings-row-text' }, [
          el('span', { class: 'settings-row-title' }, 'Descargar JSON'),
          el('span', { class: 'settings-row-sub' }, `${summary.days} días · ${summary.entries} actividades · sin ids`),
        ]),
      ]),
      el('div', { class: 'settings-divider' }),
      el('button', { class: 'settings-row', type: 'button', onclick: () => fileInput.click() }, [
        el('span', { class: 'settings-row-icon clay', html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5"/><path d="M7.5 8L12 3.5 16.5 8"/><path d="M4.5 19.5h15"/></svg>' }),
        el('span', { class: 'settings-row-text' }, [
          el('span', { class: 'settings-row-title' }, 'Importar JSON'),
          el('span', { class: 'settings-row-sub' }, 'Combina por fecha, sin borrar nada'),
        ]),
      ]),
      fileInput,
    ]);

    // ---- Sincronización ----
    let syncCard;
    if (gist.isConnected()) {
      const status = gist.getStatus();
      const lastSync = gist.getLastSync();
      const statusText = {
        idle: 'Gist conectado',
        syncing: 'Sincronizando…',
        offline: 'Sin conexión',
        error: 'Error de sincronización',
        disconnected: 'Desconectado',
      }[status.state] ?? 'Gist conectado';
      const dotClass = { idle: 'ok', syncing: 'syncing', offline: 'offline', error: 'error' }[status.state] ?? 'ok';

      syncCard = el('div', { class: 'sync-card' }, [
        el('div', { class: 'sync-status-row' }, [
          el('span', { class: `sync-dot ${dotClass}` }),
          el('span', { class: 'title' }, statusText),
          lastSync ? el('span', { class: 'meta' }, timeAgo(lastSync)) : null,
        ].filter(Boolean)),
        status.state === 'error' ? el('p', { style: 'font-size:12px;color:var(--danger);margin:8px 0 0;' }, status.detail) : null,
        el('div', { class: 'sync-details' }, [
          el('div', { class: 'sync-details-row' }, [el('span', { class: 'k' }, 'Archivo'), el('span', { class: 'v' }, 'registro-diario.json')]),
          el('div', { class: 'sync-details-row' }, [el('span', { class: 'k' }, 'Gist'), el('span', { class: 'v tabular' }, `${gist.getGistId().slice(0, 4)}…${gist.getGistId().slice(-4)}`)]),
          el('div', { class: 'sync-details-row' }, [el('span', { class: 'k' }, 'Token'), el('span', { class: 'v ok' }, 'Guardado y cifrado')]),
        ]),
        el('div', { class: 'sync-actions' }, [
          el('button', {
            class: 'btn-sync', type: 'button',
            onclick: () => gist.reconcileOnUnlock(),
          }, [
            el('span', { html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a8 8 0 0 0-13.7-5.2L3.5 9"/><path d="M4 12.5a8 8 0 0 0 13.7 5.2l2.8-2.7"/><path d="M3.5 4.5V9h4.5"/><path d="M20.5 19.5V15H16"/></svg>' }),
            'Sincronizar',
          ]),
          el('button', {
            class: 'btn-disconnect', type: 'button',
            onclick: () => ctx.confirmDialog({
              title: 'Desconectar Gist',
              body: 'Se dejará de sincronizar. Tus datos locales no se borran.',
              confirmLabel: 'Desconectar',
              onConfirm: () => { gist.disconnect(); draw(); },
            }),
          }, 'Desconectar'),
        ]),
      ].filter(Boolean));
    } else {
      const tokenInput = el('input', { type: 'password', placeholder: 'ghp_…', autocomplete: 'off' });
      const errorEl = el('p', { style: 'color:var(--danger);display:none;' });
      const connectBtn = el('button', { class: 'btn-connect', type: 'button' }, 'Conectar');
      connectBtn.addEventListener('click', async () => {
        const token = tokenInput.value.trim();
        if (!token) return;
        connectBtn.textContent = 'Conectando…';
        connectBtn.disabled = true;
        try {
          await gist.connect(token, ctx.sessionKey);
          draw();
        } catch (err) {
          errorEl.textContent = err.message;
          errorEl.style.display = 'block';
          connectBtn.textContent = 'Conectar';
          connectBtn.disabled = false;
        }
      });
      syncCard = el('div', { class: 'sync-card' }, [
        el('div', { class: 'connect-form' }, [
          el('p', {}, ['Crea un token clásico en ', el('a', { href: 'https://github.com/settings/tokens', target: '_blank', rel: 'noopener' }, 'github.com/settings/tokens'), ' con el scope ', el('strong', {}, 'gist'), ' y pégalo aquí.']),
          tokenInput,
          errorEl,
          connectBtn,
        ]),
      ]);
    }

    // ---- Acceso ----
    const accesoCard = el('div', { class: 'settings-card' }, [
      el('button', { class: 'settings-row', type: 'button', onclick: () => openChangePassword() }, [
        el('span', { class: 'settings-row-icon neutral', html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="12" r="4"/><path d="M12.5 12h8"/><path d="M17.5 12v3.4"/><path d="M20.5 12v2.4"/></svg>' }),
        el('span', { class: 'settings-row-text' }, [el('span', { class: 'settings-row-title' }, 'Cambiar contraseña')]),
      ]),
      el('div', { class: 'settings-divider' }),
      el('button', {
        class: 'settings-row', type: 'button',
        onclick: () => ctx.lockNow(),
      }, [
        el('span', { class: 'settings-row-icon neutral', html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="10.5" rx="3"/><path d="M8 10.5V7.6A4 4 0 0 1 16 7.6v2.9"/></svg>' }),
        el('span', { class: 'settings-row-text' }, [el('span', { class: 'settings-row-title' }, 'Bloquear ahora')]),
      ]),
    ]);

    // ---- Tema ----
    const currentTheme = localStorage.getItem(THEME_KEY) ?? 'auto';
    function themeBtn(value, label) {
      return el('button', {
        type: 'button', class: currentTheme === value ? 'active' : '',
        onclick: () => { localStorage.setItem(THEME_KEY, value); applyTheme(value); draw(); },
      }, label);
    }
    const themeSegmented = el('div', { class: 'segmented' }, [
      themeBtn('auto', 'Automático'),
      themeBtn('light', 'Claro'),
      themeBtn('dark', 'Oscuro'),
    ]);

    function openChangePassword() {
      const oldPw = el('input', { type: 'password', placeholder: 'Contraseña actual' });
      const newPw = el('input', { type: 'password', placeholder: 'Contraseña nueva' });
      const errorEl = el('p', { style: 'color:var(--danger);font-size:12px;margin:0;' });
      ctx.customDialog({
        title: 'Cambiar contraseña',
        body: el('div', { style: 'display:flex;flex-direction:column;gap:10px;' }, [oldPw, newPw, errorEl]),
        confirmLabel: 'Cambiar',
        onConfirm: async (close) => {
          const auth = JSON.parse(localStorage.getItem('rd.auth'));
          const oldKey = await unlock(oldPw.value, auth);
          if (!oldKey) {
            errorEl.textContent = 'La contraseña actual no es correcta.';
            return false;
          }
          let encryptedToken = null;
          if (gist.isConnected()) {
            const raw = JSON.parse(localStorage.getItem('rd.token'));
            const plain = await decryptToken(oldKey, raw);
            encryptedToken = plain;
          }
          const { key: newKey, auth: newAuth } = await createPassword(newPw.value);
          if (encryptedToken !== null) {
            const reEncrypted = await encryptToken(newKey, encryptedToken);
            localStorage.setItem('rd.token', JSON.stringify(reEncrypted));
          }
          localStorage.setItem('rd.auth', JSON.stringify(newAuth));
          ctx.sessionKey = newKey;
          close();
          return true;
        },
      });
    }

    const view = el('div', { class: 'view-settings' }, [
      header,
      el('div', { class: 'settings-body' }, [
        el('div', {}, [el('div', { class: 'settings-group-label' }, 'Tus datos'), datosCard]),
        el('div', {}, [el('div', { class: 'settings-group-label' }, 'Sincronización'), syncCard]),
        el('div', {}, [el('div', { class: 'settings-group-label' }, 'Acceso'), accesoCard]),
        el('div', {}, [el('div', { class: 'settings-group-label' }, 'Tema'), themeSegmented]),
        el('p', { class: 'settings-footer' }, ['Registro diario · v2', el('br'), 'Los datos nunca pasan por otro servidor que no sea GitHub.']),
      ]),
    ]);

    root.replaceChildren(view);
  }

  draw();
  unsubGist = gist.subscribe(draw);
  ctx.onCleanup(() => unsubGist?.());
}

export { applyTheme };

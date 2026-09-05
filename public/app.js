import { el } from './js/dom.js';
import * as store from './js/store.js';
import * as gist from './js/gist.js';
import * as localServer from './js/local-server.js';
import { importKey } from './js/crypto.js';
import { todayLocal } from './js/time.js';
import { applyTheme } from './js/views/settings.js';
import * as lockView from './js/views/lock.js';
import * as dayView from './js/views/day.js';
import * as entryFormView from './js/views/entry-form.js';
import * as calendarView from './js/views/calendar.js';
import * as settingsView from './js/views/settings.js';

const SESSION_KEY = 'rd.session';
const THEME_KEY = 'rd.theme';

const root = document.getElementById('app');

const views = {
  lock: lockView,
  day: dayView,
  'entry-form': entryFormView,
  calendar: calendarView,
  settings: settingsView,
};

let cleanupFns = [];
let sessionKey = null;

function runCleanup() {
  cleanupFns.forEach((fn) => fn());
  cleanupFns = [];
}

function dateFromHash() {
  const m = /^#(\d{4}-\d{2}-\d{2})$/.exec(location.hash);
  return m ? m[1] : todayLocal();
}

function navigate(viewName, params = {}) {
  runCleanup();
  if (viewName === 'day' && params.date) {
    location.hash = params.date;
  }
  const ctx = {
    ...params,
    date: params.date ?? todayLocal(),
    navigate,
    onCleanup: (fn) => cleanupFns.push(fn),
    confirmDialog,
    customDialog,
    lockNow,
    skipLock,
    get sessionKey() { return sessionKey; },
    set sessionKey(v) { sessionKey = v; },
    onUnlocked,
  };
  views[viewName].render(root, ctx);
  if (params.highlight) {
    requestAnimationFrame(() => {
      const { start, end } = params.highlight;
      const match = root.querySelector(`.entry-card[data-start="${start}"][data-end="${end}"]`);
      if (match) {
        match.scrollIntoView({ block: 'center' });
        match.classList.add('highlight');
        setTimeout(() => match.classList.remove('highlight'), 1200);
      }
    });
  }
}

function confirmDialog({ title, body, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', hideCancel = false, onConfirm }) {
  const backdrop = el('div', { class: 'dialog-backdrop' });
  function close() { backdrop.remove(); }
  const dialog = el('div', { class: 'dialog' }, [
    el('div', { class: 'dialog-title' }, title),
    el('div', { class: 'dialog-body' }, body),
    el('div', { class: 'dialog-actions' }, [
      hideCancel ? null : el('button', { class: 'cancel', type: 'button', onclick: close }, cancelLabel),
      el('button', { class: 'confirm', type: 'button', onclick: () => { onConfirm(); close(); } }, confirmLabel),
    ].filter(Boolean)),
  ]);
  backdrop.append(dialog);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.body.append(backdrop);
}

function customDialog({ title, body, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onConfirm }) {
  const backdrop = el('div', { class: 'dialog-backdrop' });
  function close() { backdrop.remove(); }
  const confirmBtn = el('button', { class: 'confirm primary', type: 'button' }, confirmLabel);
  confirmBtn.addEventListener('click', async () => {
    const ok = await onConfirm(close);
    if (ok === false) return;
  });
  const dialog = el('div', { class: 'dialog' }, [
    el('div', { class: 'dialog-title' }, title),
    el('div', { class: 'dialog-body' }, [body]),
    el('div', { class: 'dialog-actions' }, [
      el('button', { class: 'cancel', type: 'button', onclick: close }, cancelLabel),
      confirmBtn,
    ]),
  ]);
  backdrop.append(dialog);
  document.body.append(backdrop);
}

function lockNow() {
  sessionKey = null;
  localStorage.removeItem(SESSION_KEY);
  runCleanup();
  navigate('lock', {});
}

// Solo para pruebas en un contexto sin WebCrypto (http por IP, no localhost/HTTPS):
// entra sin sesión cifrada. La sincronización con Gist queda deshabilitada.
async function skipLock() {
  sessionKey = null;
  await localServer.init();
  navigate('day', { date: dateFromHash() });
}

async function onUnlocked(key) {
  sessionKey = key;
  await gist.loadToken(key);
  gist.initAutoSync();
  await gist.reconcileOnUnlock();
  await localServer.init();
  navigate('day', { date: dateFromHash() });
}

async function boot() {
  applyTheme(localStorage.getItem(THEME_KEY) ?? 'auto');

  const savedSession = localStorage.getItem(SESSION_KEY);
  if (savedSession) {
    try {
      const key = await importKey(savedSession);
      await onUnlocked(key);
      return;
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }
  navigate('lock', {});
}

window.addEventListener('hashchange', () => {
  if (location.hash && sessionKey) {
    const d = dateFromHash();
    navigate('day', { date: d });
  }
});

boot();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

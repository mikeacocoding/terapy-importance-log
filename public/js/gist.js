import * as store from './store.js';
import { encryptToken, decryptToken } from './crypto.js';

const API = 'https://api.github.com';
const FILE_NAME = 'registro-diario.json';
const DESCRIPTION = 'registro-diario';
const SYNC_DEBOUNCE_MS = 3000;
const REFRESH_AFTER_MS = 5 * 60 * 1000;

const listeners = new Set();
let status = { state: 'disconnected', detail: null }; // disconnected | idle | syncing | offline | error
let plainToken = null; // sólo en memoria durante la sesión
let dirty = false;
let debounceTimer = null;
let lastVisible = Date.now();

function emit() {
  for (const fn of listeners) fn(status);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getStatus() {
  return status;
}

function setStatus(state, detail = null) {
  status = { state, detail };
  emit();
}

function headers() {
  return {
    Authorization: `Bearer ${plainToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export function isConnected() {
  return !!localStorage.getItem('rd.gistId') && !!localStorage.getItem('rd.token');
}

export function getGistId() {
  return localStorage.getItem('rd.gistId');
}

export async function validateToken(token) {
  const res = await fetch(`${API}/gists`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
  if (res.status === 401) throw new Error('Token inválido o sin permisos (revisa el scope "gist").');
  if (!res.ok) throw new Error(`Error al validar el token (${res.status}).`);
  return res.json();
}

async function findExistingGist(token) {
  const res = await fetch(`${API}/gists`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`Error al listar gists (${res.status}).`);
  const gists = await res.json();
  return gists.find((g) => g.description === DESCRIPTION) ?? null;
}

async function createGist(token, content) {
  const res = await fetch(`${API}/gists`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({
      description: DESCRIPTION,
      public: false,
      files: { [FILE_NAME]: { content } },
    }),
  });
  if (!res.ok) throw new Error(`Error al crear el gist (${res.status}).`);
  return res.json();
}

// Conecta con un token nuevo: valida, busca o crea el gist, cifra y guarda.
export async function connect(token, key) {
  await validateToken(token);
  let gist = await findExistingGist(token);
  if (!gist) {
    gist = await createGist(token, JSON.stringify(store.exportDoc(), null, 2));
  }
  const encrypted = await encryptToken(key, token);
  localStorage.setItem('rd.token', JSON.stringify(encrypted));
  localStorage.setItem('rd.gistId', gist.id);
  plainToken = token;
  setStatus('idle');
  return gist.id;
}

export function disconnect() {
  localStorage.removeItem('rd.token');
  localStorage.removeItem('rd.gistId');
  plainToken = null;
  setStatus('disconnected');
}

// Descifra y carga el token en memoria para la sesión actual (llamar al desbloquear).
export async function loadToken(key) {
  const raw = localStorage.getItem('rd.token');
  if (!raw) return false;
  try {
    const encrypted = JSON.parse(raw);
    plainToken = await decryptToken(key, encrypted);
    return true;
  } catch {
    plainToken = null;
    return false;
  }
}

async function fetchRemoteDoc() {
  const gistId = getGistId();
  const res = await fetch(`${API}/gists/${gistId}`, { headers: headers() });
  if (!res.ok) throw new Error(`Error al bajar el gist (${res.status}).`);
  const gist = await res.json();
  const file = gist.files[FILE_NAME];
  if (!file) return { version: 1, updatedAt: null, days: [] };
  let content = file.content;
  if (file.truncated) {
    const rawRes = await fetch(file.raw_url);
    content = await rawRes.text();
  }
  try {
    return JSON.parse(content);
  } catch {
    return { version: 1, updatedAt: null, days: [] };
  }
}

async function pushRemoteDoc() {
  const gistId = getGistId();
  const body = JSON.stringify(store.getDoc(), null, 2);
  const res = await fetch(`${API}/gists/${gistId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ files: { [FILE_NAME]: { content: body } } }),
  });
  if (!res.ok) throw new Error(`Error al subir el gist (${res.status}).`);
}

function markSynced() {
  localStorage.setItem('rd.lastSync', new Date().toISOString());
}

export function getLastSync() {
  const raw = localStorage.getItem('rd.lastSync');
  return raw ? new Date(raw) : null;
}

// Se llama al desbloquear: compara updatedAt local vs remoto y resuelve.
export async function reconcileOnUnlock() {
  if (!isConnected() || !plainToken) return;
  setStatus('syncing');
  try {
    const remote = await fetchRemoteDoc();
    const local = store.getDoc();
    const remoteTime = remote.updatedAt ? Date.parse(remote.updatedAt) : 0;
    const localTime = local.updatedAt ? Date.parse(local.updatedAt) : 0;

    if (remoteTime > localTime) {
      if (dirty) {
        setStatus('error', 'Hay cambios locales sin subir y el gist remoto es más nuevo. Descarga tus datos antes de continuar si quieres conservarlos.');
        return;
      }
      store.replaceDoc(remote);
    } else if (localTime > remoteTime) {
      await pushRemoteDoc();
    }
    markSynced();
    dirty = false;
    setStatus('idle');
  } catch (err) {
    setStatus('error', err.message);
  }
}

async function pushNow() {
  if (!isConnected() || !plainToken) return;
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }
  setStatus('syncing');
  try {
    await pushRemoteDoc();
    dirty = false;
    markSynced();
    setStatus('idle');
  } catch (err) {
    setStatus('error', err.message);
  }
}

export function scheduleSync() {
  dirty = true;
  if (!isConnected()) return;
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(pushNow, SYNC_DEBOUNCE_MS);
}

export function initAutoSync() {
  store.subscribe(() => scheduleSync());

  window.addEventListener('online', () => {
    if (dirty) pushNow();
  });
  window.addEventListener('offline', () => setStatus('offline'));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (now - lastVisible > REFRESH_AFTER_MS) {
      reconcileOnUnlock();
    }
    lastVisible = now;
  });
}

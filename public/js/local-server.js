import * as store from './store.js';
import * as gist from './gist.js';

const DEBOUNCE_MS = 800;
let debounceTimer = null;
let available = false;

async function probe() {
  try {
    const res = await fetch('./api/data');
    available = res.ok;
    return res.ok ? res.json() : null;
  } catch {
    available = false;
    return null;
  }
}

function pushMirror() {
  if (!available) return;
  fetch('./api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(store.getDoc()),
  }).catch(() => {});
}

// El servidor local nunca manda si el Gist está configurado: es sólo un
// espejo de respaldo. Si no hay Gist, es la fuente al arrancar.
export async function init() {
  const remote = await probe();
  if (!available) return;

  if (!gist.isConnected() && remote) {
    const local = store.getDoc();
    const remoteTime = remote.updatedAt ? Date.parse(remote.updatedAt) : 0;
    const localTime = local.updatedAt ? Date.parse(local.updatedAt) : 0;
    if (remoteTime > localTime) {
      store.replaceDoc(remote);
    }
  }

  store.subscribe(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(pushMirror, DEBOUNCE_MS);
  });
}

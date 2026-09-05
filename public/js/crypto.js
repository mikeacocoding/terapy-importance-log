const ITERATIONS = 310000;
const VERIFIER_TEXT = 'registro-diario-v1';

function toB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromB64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0)).buffer;
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

async function encryptString(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return { iv: toB64(iv), ct: toB64(ct) };
}

async function decryptString(key, iv, ct) {
  const dec = new TextDecoder();
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ct));
  return dec.decode(plain);
}

// Crea una contraseña nueva: deriva la clave y guarda el verificador.
export async function createPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const { iv, ct } = await encryptString(key, VERIFIER_TEXT);
  return { key, auth: { salt: toB64(salt), iv, ct } };
}

// Intenta desbloquear con la contraseña dada contra el verificador guardado.
// Devuelve la clave si es correcta, o null si no lo es.
export async function unlock(password, auth) {
  const salt = fromB64(auth.salt);
  const key = await deriveKey(password, salt);
  try {
    const plain = await decryptString(key, auth.iv, auth.ct);
    if (plain !== VERIFIER_TEXT) return null;
    return key;
  } catch {
    return null;
  }
}

export async function encryptToken(key, token) {
  return encryptString(key, token);
}

export async function decryptToken(key, encrypted) {
  return decryptString(key, encrypted.iv, encrypted.ct);
}

export async function exportKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toB64(raw);
}

export async function importKey(b64) {
  return crypto.subtle.importKey('raw', fromB64(b64), { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

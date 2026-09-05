import { todayLocal } from './time.js';

const DOC_KEY = 'rd.doc';

const listeners = new Set();
let doc = load();

function load() {
  try {
    const raw = localStorage.getItem(DOC_KEY);
    if (!raw) return { version: 1, updatedAt: null, days: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.days)) return { version: 1, updatedAt: null, days: [] };
    return parsed;
  } catch {
    return { version: 1, updatedAt: null, days: [] };
  }
}

function persist() {
  localStorage.setItem(DOC_KEY, JSON.stringify(doc));
}

function normalize() {
  doc.days = doc.days.filter((d) => d.entries.length > 0 || d.reflection.trim() !== '');
  doc.days.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const day of doc.days) {
    day.entries.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  }
}

function touch() {
  doc.updatedAt = new Date().toISOString();
  normalize();
  persist();
  emit();
}

function emit() {
  for (const fn of listeners) fn(doc);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDoc() {
  return doc;
}

export function getDay(date) {
  return doc.days.find((d) => d.date === date) ?? null;
}

function ensureDay(date) {
  let day = getDay(date);
  if (!day) {
    day = { date, reflection: '', entries: [] };
    doc.days.push(day);
  }
  return day;
}

export function addEntry(date, entry) {
  const day = ensureDay(date);
  day.entries.push({
    start: entry.start,
    end: entry.end,
    activity: entry.activity ?? '',
    enjoyment: entry.enjoyment ?? null,
    importance: entry.importance ?? null,
  });
  touch();
}

export function updateEntry(date, index, patch) {
  const day = getDay(date);
  if (!day || !day.entries[index]) return;
  Object.assign(day.entries[index], patch);
  touch();
}

// Mueve una entrada de una fecha a otra (cambiar la fecha desde el formulario).
export function moveEntry(fromDate, index, toDate, patch) {
  const fromDay = getDay(fromDate);
  if (!fromDay || !fromDay.entries[index]) return;
  const [entry] = fromDay.entries.splice(index, 1);
  Object.assign(entry, patch);
  const toDay = ensureDay(toDate);
  toDay.entries.push(entry);
  touch();
}

export function deleteEntry(date, index) {
  const day = getDay(date);
  if (!day || !day.entries[index]) return;
  day.entries.splice(index, 1);
  touch();
}

export function setReflection(date, text) {
  const day = ensureDay(date);
  day.reflection = text;
  touch();
}

export function dayHasData(date) {
  const day = getDay(date);
  return !!day && (day.entries.length > 0 || day.reflection.trim() !== '');
}

export function exportDoc() {
  return { version: doc.version, days: doc.days };
}

export function countSummary() {
  const days = doc.days.length;
  const entries = doc.days.reduce((sum, d) => sum + d.entries.length, 0);
  return { days, entries };
}

function entryKey(e) {
  return `${e.start}|${e.end}|${e.activity}`;
}

// Combina un documento importado (formato nuevo o viejo con ids) con el actual.
export function importDoc(incoming) {
  let newDays = 0;
  let mergedDays = 0;
  const incomingDays = Array.isArray(incoming?.days) ? incoming.days : [];

  for (const inDay of incomingDays) {
    if (!inDay || typeof inDay.date !== 'string') continue;
    const existing = getDay(inDay.date);
    const incomingEntries = Array.isArray(inDay.entries) ? inDay.entries : [];
    const cleanEntries = incomingEntries.map((e) => ({
      start: typeof e.start === 'string' ? e.start : '00:00',
      end: typeof e.end === 'string' ? e.end : '00:00',
      activity: typeof e.activity === 'string' ? e.activity : '',
      enjoyment: e.enjoyment ?? null,
      importance: e.importance ?? null,
    }));

    if (!existing) {
      doc.days.push({
        date: inDay.date,
        reflection: typeof inDay.reflection === 'string' ? inDay.reflection : '',
        entries: cleanEntries,
      });
      newDays += 1;
    } else {
      const seen = new Set(existing.entries.map(entryKey));
      let changed = false;
      for (const e of cleanEntries) {
        const key = entryKey(e);
        if (!seen.has(key)) {
          existing.entries.push(e);
          seen.add(key);
          changed = true;
        }
      }
      if (existing.reflection.trim() === '' && typeof inDay.reflection === 'string' && inDay.reflection.trim() !== '') {
        existing.reflection = inDay.reflection;
        changed = true;
      }
      if (changed) mergedDays += 1;
    }
  }

  touch();
  return { newDays, mergedDays };
}

export function replaceDoc(newDoc) {
  doc = {
    version: newDoc.version ?? 1,
    updatedAt: newDoc.updatedAt ?? new Date().toISOString(),
    days: Array.isArray(newDoc.days) ? newDoc.days : [],
  };
  normalize();
  persist();
  emit();
}

export { todayLocal };

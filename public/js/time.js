// Almacenamiento: siempre 24 h "HH:MM". Presentación: siempre 12 h.

export function to12h(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'a.m.' : 'p.m.';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const mm = String(m).padStart(2, '0');
  return `${h12}:${mm} ${period}`;
}

export function formatRange(start, end) {
  return `${to12h(start)} – ${to12h(end)}`;
}

export function nowRounded(step = 15) {
  const now = new Date();
  let minutes = now.getHours() * 60 + now.getMinutes();
  minutes = Math.round(minutes / step) * step;
  minutes = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutes(hhmm, delta) {
  const [h, m] = hhmm.split(':').map(Number);
  let total = h * 60 + m + delta;
  total = ((total % 1440) + 1440) % 1440;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function crossesMidnight(start, end) {
  return toMinutes(end) <= toMinutes(start);
}

export function duration(start, end) {
  let mins = toMinutes(end) - toMinutes(start);
  if (mins <= 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} m`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} m`;
}

export function durationMinutes(start, end) {
  let mins = toMinutes(end) - toMinutes(start);
  if (mins <= 0) mins += 24 * 60;
  return mins;
}

export function formatTotalDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} m`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} m`;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// date es "YYYY-MM-DD" en hora local.
export function parseLocalDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function dateFromParts(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function formatLongDate(date) {
  const d = parseLocalDate(date);
  const dia = DIAS[d.getDay()];
  const mes = MESES[d.getMonth()];
  const cap = dia.charAt(0).toUpperCase() + dia.slice(1);
  return `${cap} ${d.getDate()} de ${mes}`;
}

export function addDays(date, delta) {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + delta);
  return dateFromParts(d.getFullYear(), d.getMonth(), d.getDate());
}

// Lunes = 0 ... domingo = 6
export function isoWeekday(date) {
  const d = parseLocalDate(date);
  return (d.getDay() + 6) % 7;
}

export function startOfWeek(date) {
  return addDays(date, -isoWeekday(date));
}

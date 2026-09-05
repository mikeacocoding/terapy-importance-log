import { el } from '../dom.js';
import * as store from '../store.js';
import * as gist from '../gist.js';
import {
  formatRange, duration, durationMinutes, formatTotalDuration,
  formatLongDate, addDays, startOfWeek, todayLocal, crossesMidnight, parseLocalDate,
} from '../time.js';

const WEEKDAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function meter(value, kind) {
  const filled = value === null || value === undefined ? 0 : Math.round(value);
  const segs = [];
  for (let i = 0; i < 10; i += 1) {
    segs.push(el('span', { class: `meter-seg ${i < filled ? `${kind}-fill` : ''}` }));
  }
  return el('div', { class: 'meter' }, segs);
}

function average(entries, field) {
  const values = entries.map((e) => e[field]).filter((v) => v !== null && v !== undefined);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function syncDotClass(status) {
  if (status.state === 'idle') return 'ok';
  if (status.state === 'syncing') return 'syncing';
  if (status.state === 'offline') return 'offline';
  if (status.state === 'error') return 'error';
  return '';
}

export function render(root, ctx) {
  const date = ctx.date;
  let unsubStore = null;
  let unsubGist = null;

  function draw() {
    const day = store.getDay(date) ?? { date, reflection: '', entries: [] };
    const isToday = date === todayLocal();

    // ---- Encabezado ----
    const settingsBtn = el('button', {
      class: 'icon-btn',
      type: 'button',
      'aria-label': 'Ajustes',
      onclick: () => ctx.navigate('settings'),
    }, [el('span', {
      html: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 8h9"/><path d="M17.5 8H20"/><path d="M4 16h3.5"/><path d="M12 16h8"/><circle cx="15.2" cy="8" r="2.3"/><circle cx="9.7" cy="16" r="2.3"/></svg>',
    })]);

    const status = gist.getStatus();
    const eyebrow = el('div', { class: 'day-eyebrow' }, [
      gist.isConnected() ? el('span', { class: `sync-dot ${syncDotClass(status)}` }) : null,
      'Registro diario',
    ].filter(Boolean));

    const titleBtn = el('button', {
      class: 'day-title',
      type: 'button',
      onclick: () => ctx.navigate('calendar', { date }),
    }, [
      formatLongDate(date),
      isToday ? el('span', { class: 'today-tag' }, ' · Hoy') : null,
    ].filter(Boolean));

    const header = el('div', { class: 'day-header' }, [
      el('div', {}, [eyebrow, titleBtn]),
      settingsBtn,
    ]);

    // ---- Tira de semana ----
    const weekStart = startOfWeek(date);
    const dayCells = [];
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(weekStart, i);
      const hasData = store.dayHasData(d);
      const isFuture = d > todayLocal();
      const isSelected = d === date;
      const classes = ['week-day'];
      if (isSelected) classes.push('selected');
      if (isFuture) classes.push('future');
      if (!hasData) classes.push('no-data');
      dayCells.push(el('button', { class: classes.join(' '), type: 'button', onclick: () => ctx.navigate('day', { date: d }) }, [
        el('div', { class: 'wd-letter' }, WEEKDAY_LETTERS[i]),
        el('div', { class: 'wd-num tabular' }, String(parseLocalDate(d).getDate())),
        el('div', { class: 'wd-dot' }),
      ]));
    }
    const weekStrip = el('div', { class: 'week-strip' }, [
      el('button', {
        class: 'week-nav', type: 'button', 'aria-label': 'Semana anterior',
        onclick: () => ctx.navigate('day', { date: addDays(date, -7) }),
      }, [el('span', { html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>' })]),
      el('div', { class: 'week-days' }, dayCells),
      el('button', {
        class: 'week-nav', type: 'button', 'aria-label': 'Semana siguiente',
        onclick: () => ctx.navigate('day', { date: addDays(date, 7) }),
      }, [el('span', { html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>' })]),
    ]);

    // ---- Resumen ----
    const avgEnjoy = average(day.entries, 'enjoyment');
    const avgImportance = average(day.entries, 'importance');
    const summary = el('div', { class: 'summary' }, [
      el('div', { class: 'summary-card enjoy' }, [
        el('div', { class: 'summary-head' }, [
          el('span', { class: 'summary-label' }, 'Disfrute'),
          el('span', { class: 'summary-value tabular' }, avgEnjoy === null ? '—' : avgEnjoy.toFixed(1).replace('.', ',')),
        ]),
        meter(avgEnjoy, 'enjoy'),
      ]),
      el('div', { class: 'summary-card importance' }, [
        el('div', { class: 'summary-head' }, [
          el('span', { class: 'summary-label' }, 'Importa'),
          el('span', { class: 'summary-value tabular' }, avgImportance === null ? '—' : avgImportance.toFixed(1).replace('.', ',')),
        ]),
        meter(avgImportance, 'importance'),
      ]),
    ]);

    // ---- Lista de actividades ----
    const totalMinutes = day.entries.reduce((sum, e) => sum + durationMinutes(e.start, e.end), 0);
    const sectionHead = el('div', { class: 'section-head' }, [
      el('span', { class: 'section-label' }, 'Actividades'),
      day.entries.length
        ? el('span', { class: 'section-meta' }, `${day.entries.length} ${day.entries.length === 1 ? 'bloque' : 'bloques'} · ${formatTotalDuration(totalMinutes)}`)
        : null,
    ].filter(Boolean));

    let longPressTimer = null;

    function entryCard(entry, index) {
      const overnight = crossesMidnight(entry.start, entry.end);
      const card = el('div', {
        class: 'entry-card',
        tabindex: '0',
        role: 'button',
        'data-start': entry.start,
        'data-end': entry.end,
        onclick: () => ctx.navigate('entry-form', { date, index }),
      }, [
        el('div', { class: 'entry-row1' }, [
          el('span', { class: 'entry-range tabular' }, formatRange(entry.start, entry.end)),
          el('span', { class: 'entry-duration tabular' }, duration(entry.start, entry.end)),
        ]),
        overnight ? el('div', { class: 'entry-overnight' }, 'termina al día siguiente') : null,
        el('div', { class: 'entry-activity' }, entry.activity || '(sin nombre)'),
        el('div', { class: 'entry-meters' }, [
          el('div', { class: 'entry-meter' }, [
            el('div', { class: 'entry-meter-head' }, [
              el('span', { class: 'entry-meter-label' }, 'Disfrute'),
              el('span', { class: 'entry-meter-value enjoy tabular' }, entry.enjoyment ?? '—'),
            ]),
            meter(entry.enjoyment, 'enjoy'),
          ]),
          el('div', { class: 'entry-meter' }, [
            el('div', { class: 'entry-meter-head' }, [
              el('span', { class: 'entry-meter-label' }, 'Importa'),
              el('span', { class: 'entry-meter-value importance tabular' }, entry.importance ?? '—'),
            ]),
            meter(entry.importance, 'importance'),
          ]),
        ]),
      ].filter(Boolean));

      function askDelete() {
        ctx.confirmDialog({
          title: 'Eliminar actividad',
          body: `¿Eliminar «${entry.activity || '(sin nombre)'}»? No se puede deshacer.`,
          confirmLabel: 'Eliminar',
          onConfirm: () => store.deleteEntry(date, index),
        });
      }

      card.addEventListener('pointerdown', () => {
        longPressTimer = setTimeout(askDelete, 550);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => {
        card.addEventListener(ev, () => clearTimeout(longPressTimer));
      });
      card.addEventListener('contextmenu', (e) => { e.preventDefault(); askDelete(); });

      return card;
    }

    const listBody = [];
    if (day.entries.length === 0) {
      listBody.push(el('div', { class: 'empty-state' }, [
        el('p', {}, 'Todavía no hay actividades este día.'),
      ]));
    } else {
      day.entries.forEach((entry, index) => listBody.push(entryCard(entry, index)));
    }

    const reflectionText = el('textarea', {
      class: 'reflection-text',
      placeholder: 'Escribe lo que más pesó hoy…',
      rows: '2',
    });
    reflectionText.value = day.reflection || '';
    let debounceTimer = null;
    reflectionText.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => store.setReflection(date, reflectionText.value), 800);
    });

    const reflectionBlock = el('div', { class: 'reflection-block' }, [
      el('div', { class: 'reflection-head' }, [
        el('span', { html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.7L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/></svg>' }),
        el('span', {}, 'Lo que más pesó hoy'),
      ]),
      reflectionText,
    ]);

    const entriesList = el('div', { class: 'entries-list' }, [sectionHead, ...listBody, reflectionBlock]);

    const bottomBar = el('div', { class: 'bottom-bar' }, [
      el('button', {
        class: 'btn-primary', type: 'button',
        onclick: () => ctx.navigate('entry-form', { date, index: null }),
      }, [
        el('span', { html: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>' }),
        'Registrar actividad',
      ]),
    ]);

    const view = el('div', { class: 'view-day' }, [header, weekStrip, summary, entriesList, bottomBar]);
    root.replaceChildren(view);
  }

  draw();
  unsubStore = store.subscribe(draw);
  unsubGist = gist.subscribe(draw);
  ctx.onCleanup(() => {
    unsubStore?.();
    unsubGist?.();
  });
}

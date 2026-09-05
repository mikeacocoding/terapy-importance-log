import { el } from '../dom.js';
import * as store from '../store.js';
import { nowRounded, addMinutes, formatLongDate, todayLocal } from '../time.js';

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 15, 30, 45];

function to12hParts(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const period = h < 12 ? 'AM' : 'PM';
  return { h12, m, period };
}

function from12hParts(h12, m, period) {
  let h = h12 % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeSelects(initial, { isNow, onChange }) {
  const parts = to12hParts(initial);
  const hourSel = el('select', {}, HOURS_12.map((h) => el('option', { value: h, selected: h === parts.h12 || undefined }, String(h))));
  const minuteOptions = MINUTES.includes(parts.m) ? MINUTES : [...MINUTES, parts.m].sort((a, b) => a - b);
  const minSel = el('select', {}, minuteOptions.map((m) => el('option', { value: m, selected: m === parts.m || undefined }, String(m).padStart(2, '0'))));
  const periodSel = el('select', {}, [
    el('option', { value: 'AM', selected: parts.period === 'AM' || undefined }, 'a.m.'),
    el('option', { value: 'PM', selected: parts.period === 'PM' || undefined }, 'p.m.'),
  ]);

  const wrap = el('div', { class: `time-selects${isNow() ? ' active-now' : ''}` }, [hourSel, minSel, periodSel]);

  function read() {
    return from12hParts(Number(hourSel.value), Number(minSel.value), periodSel.value);
  }

  [hourSel, minSel, periodSel].forEach((sel) => {
    sel.addEventListener('change', () => onChange(read(), wrap));
  });

  return { wrap, read };
}

function sliderBlock({ label, kind, initial }) {
  let value = initial;
  let touched = initial !== null;
  const valueEl = el('span', { class: `slider-value ${kind}` }, value === null ? '—' : String(value));
  const input = el('input', {
    type: 'range', min: '1', max: '10', step: '1', class: `meter-slider ${kind}`,
    value: value === null ? '5' : String(value),
  });

  function updateFill() {
    const v = Number(input.value);
    const pct = ((v - 1) / 9) * 100;
    input.style.setProperty('--fill', `${pct}%`);
  }
  updateFill();

  input.addEventListener('input', () => {
    value = Number(input.value);
    touched = true;
    valueEl.textContent = String(value);
    updateFill();
  });

  const block = el('div', {}, [
    el('div', { class: 'slider-block-head' }, [
      el('span', { class: 'field-label' }, label),
      valueEl,
    ]),
    el('div', { class: 'slider-wrap' }, [input]),
    el('div', { class: 'slider-labels' }, [
      el('span', {}, '1 · nada'),
      el('span', {}, '10 · muchísimo'),
    ]),
  ]);

  return { block, getValue: () => value, hasTouched: () => touched };
}

export function render(root, ctx) {
  const editing = ctx.index !== null && ctx.index !== undefined;
  let currentDate = ctx.date;
  const day = editing ? store.getDay(currentDate) : null;
  const existing = editing ? day.entries[ctx.index] : null;

  const defaultStart = nowRounded(15);
  let startIsDefault = !editing;

  const startState = { value: existing ? existing.start : defaultStart };
  const endState = { value: existing ? existing.end : addMinutes(defaultStart, 60) };

  const nowBadge = el('span', { class: 'now-badge' }, 'AHORA');

  const startTimeUI = timeSelects(startState.value, {
    isNow: () => startIsDefault,
    onChange: (value, wrap) => {
      startState.value = value;
      startIsDefault = false;
      wrap.classList.remove('active-now');
      nowBadge.remove();
    },
  });
  const endTimeUI = timeSelects(endState.value, {
    isNow: () => false,
    onChange: (value) => { endState.value = value; },
  });

  const dateLabel = el('span', { class: 'label' }, formatLongDate(currentDate));
  const dateBtn = el('button', {
    class: 'date-picker-btn', type: 'button',
    onclick: () => ctx.navigate('calendar', {
      date: currentDate,
      onPick: (picked) => {
        ctx.navigate('entry-form', { date: picked, index: ctx.index });
      },
      onCancel: () => ctx.navigate('entry-form', { date: currentDate, index: ctx.index }),
    }),
  }, [
    el('span', { html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 9.8h17"/><path d="M8.3 3.2v3.4"/><path d="M15.7 3.2v3.4"/></svg>', style: 'color:var(--sage);flex-shrink:0;' }),
    dateLabel,
    el('span', { class: 'change' }, 'Cambiar'),
  ]);

  const activityField = el('textarea', { class: 'activity-field', placeholder: '¿Qué hiciste?', rows: '2' });
  activityField.value = existing ? existing.activity : '';

  const enjoySlider = sliderBlock({ label: 'Cuánto lo disfruté', kind: 'enjoy', initial: existing ? existing.enjoyment : null });
  const importanceSlider = sliderBlock({ label: 'Qué tan importante era', kind: 'importance', initial: existing ? existing.importance : null });

  function close() {
    ctx.navigate('day', { date: ctx.date });
  }

  function save() {
    const patch = {
      start: startTimeUI.read(),
      end: endTimeUI.read(),
      activity: activityField.value,
      enjoyment: enjoySlider.hasTouched() ? enjoySlider.getValue() : (existing ? existing.enjoyment : null),
      importance: importanceSlider.hasTouched() ? importanceSlider.getValue() : (existing ? existing.importance : null),
    };
    if (editing) {
      if (currentDate !== ctx.date) {
        store.moveEntry(ctx.date, ctx.index, currentDate, patch);
      } else {
        store.updateEntry(ctx.date, ctx.index, patch);
      }
    } else {
      store.addEntry(currentDate, patch);
    }
    ctx.navigate('day', { date: currentDate, highlight: { start: patch.start, end: patch.end } });
  }

  function askDelete() {
    ctx.confirmDialog({
      title: 'Eliminar actividad',
      body: '¿Eliminar esta actividad? No se puede deshacer.',
      confirmLabel: 'Eliminar',
      onConfirm: () => {
        store.deleteEntry(ctx.date, ctx.index);
        close();
      },
    });
  }

  const startHead = el('div', { class: 'time-field-head' }, [
    el('span', { class: 'field-label' }, 'Desde'),
    startIsDefault ? nowBadge : null,
  ].filter(Boolean));

  const footButtons = [
    el('button', { class: 'btn-secondary', type: 'button', onclick: close }, 'Cancelar'),
    el('button', { class: 'btn-primary', type: 'button', onclick: save }, 'Guardar'),
  ];

  const sheet = el('div', { class: 'sheet' }, [
    el('div', { class: 'sheet-handle' }, [el('span')]),
    el('div', { class: 'sheet-head' }, [
      el('div', { class: 'sheet-title' }, editing ? 'Editar actividad' : 'Nueva actividad'),
      el('button', { class: 'sheet-close', type: 'button', 'aria-label': 'Cerrar', onclick: close }, [
        el('span', { html: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>' }),
      ]),
    ]),
    el('div', { class: 'sheet-body' }, [
      dateBtn,
      el('div', { class: 'time-fields' }, [
        el('div', { class: 'time-field' }, [startHead, startTimeUI.wrap]),
        el('div', { class: 'time-field' }, [
          el('div', { class: 'field-label', style: 'margin-bottom:7px;' }, 'Hasta'),
          endTimeUI.wrap,
        ]),
      ]),
      el('div', {}, [
        el('div', { class: 'field-label', style: 'margin-bottom:7px;' }, 'Actividad'),
        activityField,
      ]),
      enjoySlider.block,
      importanceSlider.block,
      editing ? el('button', { class: 'btn-danger-text', type: 'button', onclick: askDelete }, 'Eliminar actividad') : null,
    ].filter(Boolean)),
    el('div', { class: 'sheet-foot' }, footButtons),
  ]);

  const backdrop = el('div', { class: 'sheet-backdrop' }, [sheet]);
  root.replaceChildren(backdrop);
  activityField.focus();
}

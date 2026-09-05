import { el } from '../dom.js';
import * as store from '../store.js';
import { parseLocalDate, dateFromParts, addDays, todayLocal, formatLongDate } from '../time.js';

const WEEKDAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function render(root, ctx) {
  const picking = typeof ctx.onPick === 'function';
  let selected = ctx.date;
  const initial = parseLocalDate(ctx.date);
  let viewYear = initial.getFullYear();
  let viewMonth = initial.getMonth();

  function draw() {
    const today = todayLocal();

    const header = el('div', { class: 'cal-header' }, [
      el('div', {}, [
        el('div', { class: 'day-eyebrow' }, 'Ir a un día'),
        el('div', { class: 'cal-title' }, 'Elegir fecha'),
      ]),
      el('button', {
        class: 'icon-btn', style: 'width:40px;height:40px;background:var(--surface-alt);border:none;',
        type: 'button', 'aria-label': 'Cerrar',
        onclick: () => (ctx.onCancel ? ctx.onCancel() : ctx.navigate('day', { date: ctx.date })),
      }, [el('span', { html: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>' })]),
    ]);

    const navRow = el('div', { class: 'cal-nav-row' }, [
      el('button', {
        class: 'icon-btn', type: 'button', 'aria-label': 'Mes anterior',
        onclick: () => { viewMonth -= 1; if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; } draw(); },
      }, [el('span', { html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>' })]),
      el('div', { class: 'cal-month-label' }, [
        el('div', { class: 'm' }, MONTH_NAMES[viewMonth]),
        el('div', { class: 'y tabular' }, String(viewYear)),
      ]),
      el('button', {
        class: 'icon-btn', type: 'button', 'aria-label': 'Mes siguiente',
        onclick: () => { viewMonth += 1; if (viewMonth > 11) { viewMonth = 0; viewYear += 1; } draw(); },
      }, [el('span', { html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>' })]),
    ]);

    const gridHead = el('div', { class: 'cal-grid-head' }, WEEKDAY_LETTERS.map((l) => el('span', {}, l)));

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const leadingBlank = (firstOfMonth.getDay() + 6) % 7; // lunes = 0
    const totalDays = daysInMonth(viewYear, viewMonth);
    const prevMonthDays = daysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);

    const cells = [];
    const totalCells = Math.ceil((leadingBlank + totalDays) / 7) * 7;
    for (let i = 0; i < totalCells; i += 1) {
      const dayNum = i - leadingBlank + 1;
      let cellDate, displayNum, otherMonth;
      if (dayNum < 1) {
        displayNum = prevMonthDays + dayNum;
        otherMonth = true;
        cellDate = null;
      } else if (dayNum > totalDays) {
        displayNum = dayNum - totalDays;
        otherMonth = true;
        cellDate = null;
      } else {
        displayNum = dayNum;
        otherMonth = false;
        cellDate = dateFromParts(viewYear, viewMonth, dayNum);
      }

      const classes = ['cal-cell'];
      let hasData = false;
      if (cellDate) {
        hasData = store.dayHasData(cellDate);
        if (hasData) classes.push('has-data');
        if (cellDate > today) classes.push('future');
        if (cellDate === selected) classes.push('selected');
      } else {
        classes.push('other-month');
      }

      cells.push(el('div', {
        class: classes.join(' '),
        onclick: cellDate ? () => { selected = cellDate; draw(); } : null,
        style: cellDate ? 'cursor:pointer;' : 'cursor:default;',
      }, [
        el('span', { class: 'num tabular' }, String(displayNum)),
        el('span', { class: 'dot' }),
      ]));
    }
    const grid = el('div', { class: 'cal-grid' }, cells);

    const legend = el('div', { class: 'cal-legend' }, [
      el('span', { class: 'cal-legend-item' }, [el('span', { class: 'legend-dot' }), 'Con registros']),
    ]);

    function goToday() { selected = today; const d = parseLocalDate(today); viewYear = d.getFullYear(); viewMonth = d.getMonth(); draw(); }
    function goYesterday() { const d = addDays(today, -1); selected = d; const p = parseLocalDate(d); viewYear = p.getFullYear(); viewMonth = p.getMonth(); draw(); }
    function goBeforeYesterday() { const d = addDays(today, -2); selected = d; const p = parseLocalDate(d); viewYear = p.getFullYear(); viewMonth = p.getMonth(); draw(); }

    const shortcuts = el('div', { class: 'cal-shortcuts' }, [
      el('button', { type: 'button', class: selected === today ? 'active' : '', onclick: goToday }, 'Hoy'),
      el('button', { type: 'button', class: selected === addDays(today, -1) ? 'active' : '', onclick: goYesterday }, 'Ayer'),
      el('button', { type: 'button', class: selected === addDays(today, -2) ? 'active' : '', onclick: goBeforeYesterday }, 'Anteayer'),
    ]);

    function openSelected() {
      if (picking) {
        ctx.onPick(selected);
      } else {
        ctx.navigate('day', { date: selected });
      }
    }

    const footer = el('div', { class: 'cal-footer' }, [
      el('button', { class: 'btn-primary', type: 'button', onclick: openSelected }, `Abrir ${formatLongDate(selected).toLowerCase()}`),
    ]);

    const view = el('div', { class: 'view-calendar' }, [header, navRow, gridHead, grid, legend, el('div', { style: 'flex-grow:1;' }), shortcuts, footer]);
    root.replaceChildren(view);
  }

  draw();
}

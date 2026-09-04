const express = require('express');
const crypto = require('crypto');
const { readData, transact } = require('../db');

const router = express.Router();

function uid() {
  return crypto.randomUUID();
}

// Returns undefined if the caller didn't send the field at all (so PUT
// can leave it untouched), null for an intentionally cleared value, or
// a value clamped to [1, 10] otherwise.
function normalizeScore(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(1, Math.round(n)));
}

function findDay(data, dayId) {
  return data.days.find((d) => d.id === dayId);
}

function findEntry(day, entryId) {
  return day.entries.find((e) => e.id === entryId);
}

router.get('/', async (req, res) => {
  const data = await readData();
  res.json(data.days);
});

router.post('/', async (req, res) => {
  const { date } = req.body || {};
  if (!date || typeof date !== 'string') {
    return res.status(400).json({ error: 'date es requerido' });
  }
  let created = false;
  const day = await transact((data) => {
    let existing = data.days.find((d) => d.date === date);
    if (existing) return existing;
    existing = { id: uid(), date, entries: [], reflection: '' };
    data.days.push(existing);
    created = true;
    return existing;
  });
  res.status(created ? 201 : 200).json(day);
});

router.delete('/:dayId', async (req, res) => {
  const { dayId } = req.params;
  let found = false;
  await transact((data) => {
    const idx = data.days.findIndex((d) => d.id === dayId);
    if (idx === -1) return;
    data.days.splice(idx, 1);
    found = true;
  });
  if (!found) return res.status(404).json({ error: 'dia no encontrado' });
  res.status(204).end();
});

router.post('/:dayId/entries', async (req, res) => {
  const { dayId } = req.params;
  const { start, end, activity, enjoyment, importance } = req.body || {};
  let error = null;
  const entry = await transact((data) => {
    const day = findDay(data, dayId);
    if (!day) {
      error = 404;
      return null;
    }
    const newEntry = {
      id: uid(),
      start: typeof start === 'string' && start !== '' ? start : '00:00',
      end: typeof end === 'string' && end !== '' ? end : '00:00',
      activity: typeof activity === 'string' ? activity : '',
      enjoyment: normalizeScore(enjoyment) ?? null,
      importance: normalizeScore(importance) ?? null,
    };
    day.entries.push(newEntry);
    return newEntry;
  });
  if (error) return res.status(404).json({ error: 'dia no encontrado' });
  res.status(201).json(entry);
});

router.put('/:dayId/entries/:entryId', async (req, res) => {
  const { dayId, entryId } = req.params;
  const { start, end, activity, enjoyment, importance } = req.body || {};
  let error = null;
  const entry = await transact((data) => {
    const day = findDay(data, dayId);
    if (!day) {
      error = 404;
      return null;
    }
    const e = findEntry(day, entryId);
    if (!e) {
      error = 404;
      return null;
    }
    if (start !== undefined) e.start = typeof start === 'string' ? start : e.start;
    if (end !== undefined) e.end = typeof end === 'string' ? end : e.end;
    if (activity !== undefined) e.activity = typeof activity === 'string' ? activity : e.activity;
    if (enjoyment !== undefined) e.enjoyment = normalizeScore(enjoyment);
    if (importance !== undefined) e.importance = normalizeScore(importance);
    return e;
  });
  if (error) return res.status(404).json({ error: 'no encontrado' });
  res.json(entry);
});

router.delete('/:dayId/entries/:entryId', async (req, res) => {
  const { dayId, entryId } = req.params;
  let error = null;
  await transact((data) => {
    const day = findDay(data, dayId);
    if (!day) {
      error = 404;
      return;
    }
    const idx = day.entries.findIndex((e) => e.id === entryId);
    if (idx === -1) {
      error = 404;
      return;
    }
    day.entries.splice(idx, 1);
  });
  if (error) return res.status(404).json({ error: 'no encontrado' });
  res.status(204).end();
});

router.put('/:dayId/reflection', async (req, res) => {
  const { dayId } = req.params;
  const { reflection } = req.body || {};
  let error = null;
  const day = await transact((data) => {
    const d = findDay(data, dayId);
    if (!d) {
      error = 404;
      return null;
    }
    d.reflection = typeof reflection === 'string' ? reflection : '';
    return d;
  });
  if (error) return res.status(404).json({ error: 'dia no encontrado' });
  res.json(day);
});

module.exports = router;

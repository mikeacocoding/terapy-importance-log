const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'registro.json');
const TMP_FILE = path.join(DATA_DIR, 'registro.json.tmp');

const EMPTY_DOC = { version: 1, updatedAt: null, days: [] };

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await writeDoc(EMPTY_DOC);
  }
}

async function readDoc() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.days)) return EMPTY_DOC;
    return parsed;
  } catch {
    return EMPTY_DOC;
  }
}

async function writeDoc(doc) {
  const json = JSON.stringify(doc, null, 2);
  await fs.writeFile(TMP_FILE, json, 'utf8');
  await fs.rename(TMP_FILE, DATA_FILE);
}

module.exports = { ensureData, readDoc, writeDoc, DATA_FILE };

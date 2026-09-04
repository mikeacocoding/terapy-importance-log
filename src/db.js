const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'registro.json');
const TMP_FILE = path.join(DATA_DIR, 'registro.json.tmp');

// Serializes every read-modify-write cycle so concurrent requests
// can't interleave and corrupt the file or lose an update.
let queue = Promise.resolve();

async function writeFileAtomic(data) {
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(TMP_FILE, json, 'utf8');
  await fs.rename(TMP_FILE, DATA_FILE);
}

async function readRaw() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.days)) return { days: [] };
    return parsed;
  } catch {
    return { days: [] };
  }
}

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await writeFileAtomic({ days: [] });
  }
}

function transact(mutator) {
  const task = queue.then(async () => {
    const data = await readRaw();
    const result = await mutator(data);
    await writeFileAtomic(data);
    return result;
  });
  // Keep the queue alive even if this task rejects; the rejection
  // still propagates to whoever awaited `task` directly.
  queue = task.then(() => {}, () => {});
  return task;
}

async function readData() {
  await queue;
  return readRaw();
}

module.exports = { ensureData, readData, transact, DATA_FILE };

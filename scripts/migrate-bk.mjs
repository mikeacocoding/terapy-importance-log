import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'data', 'bk.json');
const DEST = path.join(__dirname, '..', 'data', 'registro-export.json');

async function main() {
  const raw = await readFile(SRC, 'utf8');
  const parsed = JSON.parse(raw);

  const days = (parsed.days ?? [])
    .map((day) => ({
      date: day.date,
      reflection: typeof day.reflection === 'string' ? day.reflection : '',
      entries: (day.entries ?? [])
        .map((e) => ({
          start: e.start,
          end: e.end,
          activity: e.activity ?? '',
          enjoyment: e.enjoyment ?? null,
          importance: e.importance ?? null,
        }))
        .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0)),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const output = { version: 1, days };
  await writeFile(DEST, JSON.stringify(output, null, 2), 'utf8');

  const entryCount = days.reduce((sum, d) => sum + d.entries.length, 0);
  console.log(`Migrados ${days.length} días y ${entryCount} actividades a ${DEST}`);
}

main();

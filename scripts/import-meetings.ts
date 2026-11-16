import { parseMeetings } from '../src/shared/meetings';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
// Explicit local operator action; never fetches arbitrary URLs or writes the civic DB.
const input = process.argv[2];
if (!input) throw new Error('Usage: bun scripts/import-meetings.ts reviewed-snapshot.json');
const meetings = parseMeetings(await Bun.file(input).json());
if (meetings.some(m => Date.parse(m.checkedAt) > Date.now())) throw new Error('Source check cannot be in the future');
const output = process.env.MEETINGS_PATH ?? 'data/public-meetings.json';
await mkdir(dirname(output), { recursive: true });
const temporary = `${output}.${crypto.randomUUID()}.tmp`;
try {
  await Bun.write(temporary, JSON.stringify(meetings, null, 2));
  await rename(temporary, output);
} finally { await rm(temporary, { force: true }); }
console.log(`Imported ${meetings.length} operator-reviewed meeting notices.`);

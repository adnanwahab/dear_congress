import { DEMO_ITEMS } from '../src/engine/demo';
import { checkCitation } from '../src/server/check-citation';
import { CITATION_LIMIT, type CitationCheck } from '../src/shared/citation-availability';
const [id, operator, mode] = process.argv.slice(2);
const item = DEMO_ITEMS.find(item => item.id === id);
if (!item || !operator?.trim() || (mode !== '--record' && mode !== '--probe')) {
  throw new Error('Usage: bun scripts/check-citations.ts <sample-id> <operator> --probe|--record. --record explicitly validates and records link availability only.');
}
const result = await checkCitation(item, operator);
console.log(JSON.stringify({ ...result, limitation: CITATION_LIMIT }, null, 2));
if (mode === '--record') {
  const path = new URL('../data/citation-checks.json', import.meta.url);
  const history: CitationCheck[] = await Bun.file(path).json();
  history.push(result);
  await Bun.write(path, JSON.stringify(history, null, 2) + '\n');
}

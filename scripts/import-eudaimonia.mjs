import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const metadata = {
  schema: 'civic-synthesis-bill-collection/v1', collection_id: 'eudaimonia-100',
  collection_title: '100 Bills for Human Flourishing', version: '1', date: '2026-11-13',
  language: 'en-US', source_type: 'editorial_policy_concepts', record_type: 'draft_proposals_not_enacted_law',
  initial_publication: 'unreviewed_catalog', votes: 'advisory_only', costs: 'unestimated', impact_evidence: 'requires_independent_review',
};
const expectedCategories = [
  'Economic security and freedom from desperation', 'Housing and livable cities',
  'Physical and mental health', 'Education and human development',
  'Meaningful work, autonomy, and time', 'Friendship, community, and belonging',
  'Justice, dignity, and second chances', 'Democracy, wisdom, and government',
  'Technology, AI, and digital freedom', 'Nature, safety, and future generations',
];
const fields = ['Jurisdiction', 'Problem', 'Proposed change', 'Trade-offs and safeguards', 'Success metrics', 'Flourishing dimensions'];
const keys = ['jurisdiction', 'problem', 'proposedChange', 'safeguards', 'metrics', 'dimensions'];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function plain(value, limit, context) {
  if (!value || value.length > limit || /[<>`\[\]{}\u0000-\u001f\u007f]|!\[|&(?:#|\w+;)|(?:javascript|data|vbscript):/i.test(value)) throw new Error(`${context}: expected plain text, 1–${limit} characters; HTML, links, code and controls are forbidden`);
  return value;
}
export function parseCollection(source) {
  if (Buffer.byteLength(source) > 250000) throw new Error('Collection exceeds 250000 bytes');
  const front = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!front) throw new Error('Missing YAML collection front matter');
  const seen = new Set();
  for (const line of front[1].split('\n')) {
    const match = line.match(/^([a-z_]+): (.+)$/);
    if (!match || seen.has(match[1]) || metadata[match[1]] !== match[2]) throw new Error(`Invalid or duplicate collection metadata: ${line}`);
    seen.add(match[1]);
  }
  if (seen.size !== Object.keys(metadata).length) throw new Error('Missing collection metadata');
  const records = []; let category = ''; let bill;
  function finish() {
    if (!bill) return;
    if (keys.some(key => !Object.hasOwn(bill, key))) throw new Error(`${bill.id}: expected exactly six fields`);
    if (!['federal', 'state', 'city', 'county'].includes(bill.jurisdiction)) throw new Error(`${bill.id}: invalid jurisdiction`);
    records.push({ ...bill, revision: hash(bill), status: 'unreviewed_catalog', sourceType: 'editorial_policy_concepts' });
    bill = undefined;
  }
  for (const [index, line] of source.slice(front[0].length).split('\n').entries()) {
    if (line.startsWith('## ')) { finish(); category = /^(Import contract|Appendix)/.test(line.slice(3)) ? '' : plain(line.slice(3), 120, 'Category'); continue; }
    if (line.startsWith('### ')) {
      finish(); const m = line.match(/^### (HFL-\d{3}): (.+)$/);
      if (!m || !category) throw new Error(`Line ${index + 1}: invalid bill heading or category`);
      bill = { id: m[1], title: plain(m[2], 180, m[1]), category, version: 1 }; continue;
    }
    if (bill && line.trim()) {
      const m = line.match(/^[*-] \*\*([^*]+):\*\* (.+)$/);
      const n = m ? fields.indexOf(m[1]) : -1;
      if (n < 0 || Object.hasOwn(bill, keys[n])) throw new Error(`${bill.id}: malformed, unknown or duplicate field: ${line}`);
      bill[keys[n]] = plain(m[2], 2000, `${bill.id} ${fields[n]}`);
    }
  }
  finish();
  records.sort((a,b) => a.id.localeCompare(b.id));
  if (records.length !== 100 || records.some((b,i) => b.id !== `HFL-${String(i+1).padStart(3,'0')}`)) throw new Error('Expected each ID HFL-001–HFL-100 exactly once');
  if (new Set(records.map(b => b.title.toLowerCase())).size !== 100) throw new Error('Duplicate bill title');
  if (records.some((b, i) => b.category !== expectedCategories[Math.floor(i / 10)])) throw new Error('Bill category does not match the HFL ID range in collection version 1');
  const categories = [...new Set(records.map(b => b.category))];
  if (categories.length !== 10 || categories.some(c => records.filter(b => b.category === c).length !== 10)) throw new Error('Expected exactly 10 categories with 10 bills each');
  return { metadata, categories, bills: records };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [input, flag, output, ...extra] = process.argv.slice(2);
    if (!input || extra.length || !((flag === '--dry-run' && !output) || (flag === '--out' && output))) throw new Error('Usage: bun scripts/import-eudaimonia.mjs SOURCE --dry-run | --out OUTPUT');
    const collection = parseCollection(await readFile(input, 'utf8'));
    if (output) { await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(collection, null, 2) + '\n'); }
    console.log(`Validated ${collection.bills.length} curated drafts in ${collection.categories.length} categories${output ? ` → ${output}` : ' (dry run)'}`);
  } catch (error) { console.error(`Catalog import failed: ${error.message}`); process.exitCode = 1; }
}

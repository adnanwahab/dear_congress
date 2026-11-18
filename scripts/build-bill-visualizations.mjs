/**
 * Build a lightweight client manifest from one independently editable JSON
 * visualization definition per bill.
 *
 * bun scripts/build-bill-visualizations.mjs --seed  (create missing definitions)
 * bun scripts/build-bill-visualizations.mjs         (regenerate manifest)
 * bun scripts/build-bill-visualizations.mjs --check (CI, no writes)
 *
 * The source catalog remains the single source for legislative prose.
 * Definitions intentionally describe only an illustrative layout and theme.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = JSON.parse(readFileSync(join(root, 'src/generated/eudaimonia-100.json'), 'utf8'));
const directory = join(root, 'content/bill-visualizations');
const destination = join(root, 'src/generated/bill-visualizations.json');
const schema = 'civic-synthesis/bill-visualization/v1';
const manifestSchema = 'civic-synthesis/bill-visualizations-manifest/v1';
const layouts = ['journey', 'comparison', 'systems', 'timeline', 'comparison', 'systems', 'journey', 'timeline', 'systems', 'comparison', 'systems'];
const motifs = ['security', 'home', 'health', 'learning', 'work', 'community', 'justice', 'democracy', 'technology', 'nature', 'democracy'];
const accents = ['#8be5b7', '#ffcf9c', '#f8a8b8', '#b8b2ff', '#8bd4f6', '#f6be96', '#efa9d9', '#85e3d7', '#acd5ff', '#b7da91', '#9eb8fc'];
const legalLayouts = new Set(['journey', 'comparison', 'systems', 'timeline']);
const legalMotifs = new Set(motifs);
const billIds = new Set(source.bills.map(bill => bill.id));
const check = process.argv.includes('--check');
const seed = process.argv.includes('--seed');

if (check && seed) throw new Error('Choose --check or --seed, not both');
if (seed) mkdirSync(directory, { recursive: true });

const currentFiles = existsSync(directory) ? readdirSync(directory).filter(name => /^HFL-\d{3}\.json$/.test(name)) : [];
const extras = currentFiles.filter(name => !billIds.has(name.slice(0, -5)));
if (extras.length) throw new Error(`Unrecognized visualization files: ${extras.join(', ')}`);

const visualizations = source.bills.map(bill => {
  const path = join(directory, `${bill.id}.json`);
  if (seed && !existsSync(path)) {
    const categoryIndex = source.categories.indexOf(bill.category);
    if (categoryIndex < 0) throw new Error(`Unknown category on ${bill.id}`);
    const spec = {
      schema, billId: bill.id, sourceRevision: bill.revision,
      layout: layouts[categoryIndex], motif: motifs[categoryIndex],
      focusDimension: bill.dimensions.split(';').map(part => part.trim())[0],
      accent: accents[categoryIndex], curation: 'seeded-from-catalog',
    };
    writeFileSync(path, JSON.stringify(spec, null, 2) + '\n');
  }
  if (!existsSync(path)) throw new Error(`Missing visualization file: ${path}. Run with --seed first.`);
  const spec = JSON.parse(readFileSync(path, 'utf8'));
  if (spec.schema !== schema || spec.billId !== bill.id) throw new Error(`Invalid identity in ${path}`);
  if (spec.sourceRevision !== bill.revision) throw new Error(`Stale catalog revision for ${bill.id}; review the visualization and update its sourceRevision`);
  if (!legalLayouts.has(spec.layout) || !legalMotifs.has(spec.motif)) throw new Error(`Unsupported layout or motif in ${path}`);
  if (!/^#[a-f0-9]{6}$/i.test(spec.accent)) throw new Error(`Invalid accent in ${path}`);
  if (!bill.dimensions.split(';').map(part => part.trim()).includes(spec.focusDimension)) throw new Error(`Unknown flourishing dimension in ${path}`);
  if (!['seeded-from-catalog', 'human-curated'].includes(spec.curation)) throw new Error(`Invalid curation in ${path}`);
  const keys = ['schema','billId','sourceRevision','layout','motif','focusDimension','accent','curation'];
  if (Object.keys(spec).sort().join(',') !== keys.sort().join(',')) throw new Error(`Unexpected fields in ${path}`);
  return spec;
});

const manifest = {
  schema: manifestSchema,
  sourceCollection: source.metadata.collection_id,
  visualizations,
};
const serialized = JSON.stringify(manifest, null, 2) + '\n';
if (check) {
  if (!existsSync(destination) || readFileSync(destination, 'utf8') !== serialized) {
    throw new Error('Visualization manifest is stale. Run bun scripts/build-bill-visualizations.mjs and commit the output.');
  }
  console.log(`Verified ${visualizations.length} bill visualizations and manifest.`);
} else {
  writeFileSync(destination, serialized);
  console.log(`Built manifest for ${visualizations.length} bill visualizations.`);
}

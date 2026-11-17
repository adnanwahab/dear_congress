/** Local-only cold-context waterfall. No public-site requests or production state. */
import { strict as assert } from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBrowser } from '../src/server/browser-build';
import counties from '../src/client/data/counties.json';

const playwrightModule = process.env.PLAYWRIGHT_MODULE;
const build = await buildBrowser(true);
assert(build.success);
const assets = await Promise.all(build.outputs.filter(o => o.path.endsWith('.js')).map(async o => {
  const text = await o.text();
  return { path: '/' + o.path.split('/').pop(), bytes: o.size, gzipBytes: Bun.gzipSync(await o.arrayBuffer()).length,
    county: text.includes(counties[0]!.path), maplibre: text.includes('maplibregl-'),
    plotting: /deck\.gl|@deck\.gl/.test(text) };
}));
assert(assets.some(a => a.county));
assert(assets.some(a => a.maplibre));
const html = await build.outputs.find(o => o.type.startsWith('text/html'))!.text();
const entry = html.match(/<script[^>]+src="([^"]+)"/)![1]!;
const initial = new Set<string>();
const scanner = new Bun.Transpiler({ loader: 'js' });
async function visit(path: string) {
  if (initial.has(path)) return;
  initial.add(path);
  const output = build.outputs.find(o => '/' + o.path.split('/').pop() === path)!;
  for (const dependency of scanner.scanImports(await output.text())) if (dependency.kind !== 'dynamic-import') await visit(dependency.path);
}
await visit(entry);
if (process.argv.includes('--build-only')) {
  console.log(JSON.stringify({ kind: 'static-build-report', assets, initial: [...initial],
    initialJsBytes: assets.filter(a => initial.has(a.path)).reduce((s, a) => s + a.bytes, 0),
    initialJsGzipBytes: assets.filter(a => initial.has(a.path)).reduce((s, a) => s + a.gzipBytes, 0) }, null, 2));
  process.exit(0);
}
assert(playwrightModule, 'Set PLAYWRIGHT_MODULE to an installed Playwright module');
const { chromium } = await import(playwrightModule);
const directory = await mkdtemp(join(tmpdir(), 'she-941-'));
for (const key of Object.keys(process.env)) if (!['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP'].includes(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: 'production', PORT: '0', DB_PATH: join(directory, 'db.json'),
  HBL_DB_PATH: join(directory, 'governance.sqlite'), HBL_SINGLE_WRITER: '1', HBL_MERGE_ENABLED: '0',
  HBL_MERGE_DRY_RUN: '1', HBL_KILL_SWITCH: '1', OUTCOMES_MODE: 'off',
  ANON_COOKIE_SECRET: crypto.randomUUID() + crypto.randomUUID() });
const { server } = await import('../server');
const browser = await chromium.launch({ headless: true });
const runs = [];
try {
  for (const width of [1440, 390]) for (const route of ['/', '/votes', '/map']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    // Fail closed on external dependencies: measurements never contact a public host.
    await page.route('**/*', async (request: any) => new URL(request.request().url()).origin === server.url.origin ? request.continue() : request.abort());
    const errors: string[] = [];
    page.on('pageerror', (error: Error) => errors.push(error.message));
    await page.goto(new URL(route, server.url).href);
    await page.locator('main h1').first().waitFor();
    await page.waitForTimeout(1500);
    const timing = await page.evaluate(() => ({
      navigation: performance.getEntriesByType('navigation').map(e => e.toJSON()),
      resources: performance.getEntriesByType('resource').map(e => e.toJSON()),
    }));
    const requested = assets.filter(a => timing.resources.some((r: any) => new URL(r.name).pathname === a.path));
    assert.equal(requested.some(a => a.county), route === '/map');
    assert(!requested.some(a => a.maplibre || a.plotting));
    assert.deepEqual(errors, []);
    runs.push({ route, width, observationMs: 1500, jsBytes: requested.reduce((s, a) => s + a.bytes, 0),
      jsGzipBytes: requested.reduce((s, a) => s + a.gzipBytes, 0), requested, ...timing });
    await context.close();
  }
  console.log(JSON.stringify({ revision: Bun.spawnSync(['git', 'rev-parse', 'HEAD']).stdout.toString().trim(), assets, runs }, null, 2));
} finally { await browser.close(); server.stop(true); await rm(directory, { recursive: true, force: true }); }

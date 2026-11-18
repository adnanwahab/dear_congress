/** Real Chromium journey against an isolated database. Fixture is explicitly marked. */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '../tests/accessibility/node_modules/playwright/index.mjs');
const directory = await mkdtemp(join(tmpdir(), 'civic-policy-browser-'));
const output = new URL('../artifacts/policy-impact/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const server = Bun.spawn([process.execPath, 'server.ts'], {
  cwd: new URL('../', import.meta.url).pathname,
  env: { PATH: process.env.PATH, DB_PATH: join(directory, 'db.json'), PORT: '0', HBL_PREVIEW_FIXTURE: '1', DEBUG_REQUEST_LOGS: '0', ANON_COOKIE_SECRET: 'browser-only-secret-at-least-32-characters' },
  stdout: 'pipe', stderr: 'pipe', stdin: 'ignore',
});
let logs = '', resolveReady, startupTimer;
const ready = new Promise(resolve => { resolveReady = resolve; });
const collect = async (stream, detect) => { for await (const chunk of stream) { const text = new TextDecoder().decode(chunk); logs += text; if (detect) { const match = logs.match(/running at (http:\/\/\S+)/); if (match) resolveReady(match[1].replace('0.0.0.0', 'localhost')); } } };
const draining = Promise.all([collect(server.stdout,true), collect(server.stderr,false)]);
let browser;
try {
  const base = await Promise.race([ready, new Promise((_,reject) => startupTimer = setTimeout(() => reject(Error('Server startup failed: '+logs)),30000))]);
  clearTimeout(startupTimer);
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'proposals/new?demo=housing');
  await page.getByRole('button',{name:'Create public synthetic housing demo'}).click();
  await page.waitForURL(/versions\/2\/impact/);
  await page.getByRole('heading',{name:'section-1 · Added'}).waitFor();
  assert.match(await page.locator('.pi').innerText(),/h_lots/);
  const oldPath = new URL(page.url()).pathname;
  const id = oldPath.split('/')[2];
  await page.getByLabel(/I reviewed the legal text/).check();
  await page.getByRole('button',{name:'See What Changes',exact:true}).click();
  await page.getByRole('status').filter({hasText:'unavailable:'}).waitFor();
  await page.screenshot({path:join(output,'01-version-diff-unavailable.png'),fullPage:true});
  const original = (await (await page.request.get(base+`api/citizen-proposals/${id}`)).json()).proposal;
  const before = await (await page.request.get(base+`api/citizen-proposals/${id}/versions`)).json();
  assert.equal(before.previews.length,1);
  await page.getByLabel('Clause section-1',{exact:true}).fill('Revised proposed housing text requiring a separate model review.');
  await page.getByLabel(/Publish this as a new immutable/).check();
  await page.getByRole('button',{name:'Save new version',exact:true}).click();
  await page.waitForURL(/versions\/3\/impact/);
  await page.getByRole('heading',{name:'section-1 · Amended'}).waitFor();
  await page.getByLabel(/I reviewed the legal text/).check();
  await page.getByRole('button',{name:'See What Changes',exact:true}).click();
  await page.getByRole('status').filter({hasText:'unsupported:'}).waitFor();
  await page.getByRole('button',{name:'support (0)',exact:true}).click();
  await page.getByRole('button',{name:'support (1)',exact:true}).waitFor();
  const after = await (await page.request.get(base+`api/citizen-proposals/${id}/versions`)).json();
  const latestOriginal = (await (await page.request.get(base+`api/citizen-proposals/${id}`)).json()).proposal;
  assert.equal(after.versions.length,3); assert.equal(after.previews.length,2);
  assert.equal(after.previews[0].id,before.previews[0].id);
  assert.equal(latestOriginal.proposedChange,original.proposedChange); assert.equal(latestOriginal.countTotal,0);
  await page.screenshot({path:join(output,'02-revision-and-separate-response.png'),fullPage:true});
  await page.goto(base+'proposals/demo-housing-fixture/versions/2/impact?base=1');
  await page.getByText('LOCAL DEVELOPMENT FIXTURE · not an HBL preview or prediction',{exact:true}).waitFor();
  const frame=page.frameLocator('iframe');
  await frame.getByLabel('Month').fill('60');
  await frame.getByText('Month 60 · Baseline 100 · Proposal 110.0',{exact:true}).waitFor();
  await page.screenshot({path:join(output,'03-fixture-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:join(output,'04-fixture-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS: version → diff → preview → revision; version-bound responses; fixture iframe time scrub; mobile reflow',proposalUrl:base+`proposals/${id}`,impactUrl:base+oldPath.slice(1),fixtureUrl:base+'proposals/demo-housing-fixture/versions/2/impact?base=1',screenshots:output},null,2));
} finally { clearTimeout(startupTimer); if(browser) await browser.close();server.kill();await server.exited;await draining;await rm(directory,{recursive:true,force:true}); }

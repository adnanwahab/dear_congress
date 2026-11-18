/** Real Chromium journey against an isolated database. Fixture is explicitly marked. */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '../tests/accessibility/node_modules/playwright/index.mjs');
const directory = await mkdtemp(join(tmpdir(), 'civic-policy-browser-'));
const output = new URL('../artifacts/policy-impact/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
let server, draining, browser;
async function startServer() {
  server = Bun.spawn([process.execPath, 'server.ts'], {
    cwd: new URL('../', import.meta.url).pathname,
    env: { PATH: process.env.PATH, DB_PATH: join(directory, 'db.json'), PORT: '0', HBL_PREVIEW_FIXTURE: '1', DEBUG_REQUEST_LOGS: '0', ANON_COOKIE_SECRET: 'browser-only-secret-at-least-32-characters' },
    stdout: 'pipe', stderr: 'pipe', stdin: 'ignore',
  });
  let logs = '', resolveReady, startupTimer;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const collect = async (stream, detect) => { for await (const chunk of stream) { const text = new TextDecoder().decode(chunk); logs += text; if (detect) { const match = logs.match(/running at (http:\/\/\S+)/); if (match) resolveReady(match[1].replace('0.0.0.0', 'localhost')); } } };
  draining = Promise.all([collect(server.stdout,true), collect(server.stderr,false)]);
  try { return await Promise.race([ready, new Promise((_,reject) => startupTimer = setTimeout(() => reject(Error('Server startup failed: '+logs)),30000))]); }
  finally { clearTimeout(startupTimer); }
}
async function stopServer() { if (server) { server.kill(); await server.exited; await draining; server = undefined; } }
try {
  let base = await startServer();
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
  assert.equal(before.canEdit,true,'The harness must use the real publishing browser cookie.');
  assert.equal(before.versions.length,2);
  assert.deepEqual(before.previews[0].payload.simulation,{seed:42,runs:100,months:24});
  const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
  assert.equal(before.previews[0].payload.source.contentHash,createHash('sha256').update(canonical(before.previews[0].payload.legal)).digest('hex'));
  assert.equal(before.previews[0].payload.source.versionId,before.versions[1].versionId);
  assert.equal(before.previews[0].payload.baseline.versionId,before.versions[0].versionId);
  await page.getByRole('button',{name:'support (0)',exact:true}).click();
  await page.getByRole('button',{name:'support (1)',exact:true}).waitFor();
  const votedV2 = await (await page.request.get(base+`api/citizen-proposals/${id}/versions`)).json();
  assert.deepEqual(votedV2.responses['2'],{counts:{support:1,oppose:0,unsure:0},ownVote:'support'});
  await page.getByLabel('Clause section-1',{exact:true}).fill('Revised proposed housing text requiring a separate model review.');
  await page.getByLabel(/Publish this as a new immutable/).check();
  await page.getByRole('button',{name:'Save new version',exact:true}).click();
  await page.waitForURL(/versions\/3\/impact/);
  await page.getByRole('heading',{name:'section-1 · Amended'}).waitFor();
  const newPath = new URL(page.url()).pathname;
  const unvotedV3 = await (await page.request.get(base+`api/citizen-proposals/${id}/versions`)).json();
  assert.deepEqual(unvotedV3.responses['2'],votedV2.responses['2']);
  assert.deepEqual(unvotedV3.responses['3'],{counts:{support:0,oppose:0,unsure:0},ownVote:null},'Substantive revisions must require renewed participation.');
  assert.equal(await page.getByRole('button',{name:'support (0)',exact:true}).getAttribute('aria-pressed'),'false');
  await page.getByLabel(/I reviewed the legal text/).check();
  await page.getByRole('button',{name:'See What Changes',exact:true}).click();
  await page.getByRole('status').filter({hasText:'unsupported:'}).waitFor();
  await page.getByRole('button',{name:'support (0)',exact:true}).click();
  await page.getByRole('button',{name:'support (1)',exact:true}).waitFor();
  const after = await (await page.request.get(base+`api/citizen-proposals/${id}/versions`)).json();
  const latestOriginal = (await (await page.request.get(base+`api/citizen-proposals/${id}`)).json()).proposal;
  assert.equal(after.versions.length,3); assert.equal(after.previews.length,2);
  assert.deepEqual(after.versions.slice(0,2),before.versions,'Earlier legal text, hashes and version identities must remain immutable.');
  assert.deepEqual(after.previews[0],before.previews[0],'A later revision must retain the exact earlier preview and frozen simulation inputs.');
  assert.deepEqual(after.responses['2'],votedV2.responses['2']);
  assert.deepEqual(after.responses['3'],{counts:{support:1,oppose:0,unsure:0},ownVote:'support'});
  assert.notEqual(after.previews[0].id,after.previews[1].id);
  assert.notEqual(after.previews[0].payload.source.contentHash,after.previews[1].payload.source.contentHash);
  assert.equal(latestOriginal.proposedChange,original.proposedChange); assert.equal(latestOriginal.countTotal,0);
  await page.screenshot({path:join(output,'02-revision-and-separate-response.png'),fullPage:true});
  // Replay saved local previews. These deliberately unavailable/unsupported records
  // prove Civic retention, not a completed remote simulation or model replay.
  for (const [version,path,status] of [[2,oldPath,'unavailable:'],[3,newPath,'unsupported:']]) {
    await page.goto(base+path.slice(1)+`?base=${version-1}`);
    await page.getByRole('heading',{name:`Advisory response · version ${version}`,exact:true}).waitFor();
    await page.getByRole('status').filter({hasText:status}).waitFor();
    const saved = after.versions.find(v=>v.version===version);
    assert.equal(await page.getByLabel('Clause section-1',{exact:true}).inputValue(),saved.clauses.find(c=>c.clauseId==='section-1').text);
    assert.equal(await page.getByRole('button',{name:'support (1)',exact:true}).getAttribute('aria-pressed'),'true');
    await page.reload();
    await page.getByRole('status').filter({hasText:status}).waitFor();
    const replay = await (await page.request.get(base+`api/citizen-proposals/${id}/versions`)).json();
    assert.deepEqual(replay,after,'Reloading must retain both exact previews, legal histories and version-bound responses.');
    await page.screenshot({path:join(output,`replay-version-${version}.png`),fullPage:true});
  }
  await stopServer();
  base = await startServer();
  for (const [version,path,status] of [[2,oldPath,'unavailable:'],[3,newPath,'unsupported:']]) {
    await page.goto(base+path.slice(1)+`?base=${version-1}`);
    await page.getByRole('status').filter({hasText:status}).waitFor();
    const restarted = await (await page.request.get(base+`api/citizen-proposals/${id}/versions`)).json();
    assert.deepEqual(restarted,after,'Restart must preserve legal versions, previews, ballot separation and publishing-browser authority.');
  }
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
  const receipt = {
    testedCommit:Bun.spawnSync(['git','rev-parse','HEAD']).stdout.toString().trim(),
    trackedWorktreeChanges:Bun.spawnSync(['git','diff','--quiet','HEAD']).exitCode !== 0,
    testedAt:new Date().toISOString(),
    scope:'Isolated Civic database and authorized publishing browser; no production writes or live HBL request.',
    criteria:{legalHistory:'PASS',canonicalHandoffHash:'PASS',immutablePreviewInputs:'PASS',renewedVersionParticipation:'PASS',oldAndNewPreviewReload:'PASS',serverRestart:'PASS',localFixtureIframeAndMobile:'PASS',liveHblSimulation:'NOT RUN',hblRecordedCheckpoints:'NOT RUN',webgpuRendering:'NOT RUN',hblExplanationGraph:'NOT RUN'},
    simulationInputs:before.previews[0].payload.simulation,
    sourceVersions:after.versions.map(v=>({versionId:v.versionId,contentHash:v.contentHash})),
    previews:after.previews.map(p=>({id:p.id,status:p.status,sourceHash:p.payload.source.contentHash})),
    limitations:'The local iframe has invented fixture values and is not HBL checkpoint or GPU acceptance. No model version, deployed release or actual simulated metric differences were verified.',
    proposalUrl:base+`proposals/${id}`,impactUrl:base+oldPath.slice(1),screenshots:output,
  };
  await writeFile(join(output,'civic-acceptance.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
} finally { if(browser) await browser.close();await stopServer();await rm(directory,{recursive:true,force:true}); }

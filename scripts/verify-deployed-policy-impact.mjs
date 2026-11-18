/** Read-only acceptance against an existing public preview. Never submits or revises. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '../tests/accessibility/node_modules/playwright/index.mjs');
const preview = 'pp_7026a659b383a72aa37f31d99a580f508f717e638e6e1f6a5b3ba659bab2d67e';
const target = `https://happybearlandia.fly.dev/world/impact?preview=${preview}`;
const output = new URL('../artifacts/policy-impact-live/', import.meta.url).pathname;
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true});
const report = {target,testedAt:new Date().toISOString(),modes:[],deploymentRelease:'NOT RUN: public response does not establish a release identifier'};
try {
  for (const noGpu of [false,true]) {
    const context = await browser.newContext({viewport:{width:1440,height:1000}});
    if(noGpu) await context.addInitScript(()=>Object.defineProperty(navigator,'gpu',{get:()=>undefined,configurable:true}));
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{
      assert.equal(request.method(),'GET','Live acceptance must remain read-only.');
      assert.equal(request.headers().authorization,undefined,'No bearer credential belongs in browser requests.');
    });
    const response=await page.goto(target);
    assert.equal(response.status(),200);
    await page.waitForFunction(()=>window.hblPolicyImpact?.getState().selected,{timeout:90000});
    const mode={name:noGpu?'forced-no-webgpu':'browser-default',headers:response.headers(),errors,checkpoints:[]};
    assert.match(mode.headers['content-security-policy'],/frame-ancestors [^;]*https:\/\/civic-synthesis\.fly\.dev(?:;| |$)/);
    mode.gpu=await page.evaluate(async()=>{if(!navigator.gpu)return {available:false};try {const a=await navigator.gpu.requestAdapter();return {available:!!a,info:a?.info?{vendor:a.info.vendor,architecture:a.info.architecture,device:a.info.device,description:a.info.description}:null};}catch(e){return {available:false,error:e.message};}});
    const identity=await page.evaluate(()=>{const s=window.hblPolicyImpact.getState();return {modelVersion:s.manifest.modelVersion,input:s.manifest.input,job:s.results.job,runIndex:s.runIndex,seed:s.results.runs.find(r=>r.runIndex===s.runIndex).seed};});
    mode.identity=identity;
    assert.equal(identity.input.schemaVersion,'policy-impact-preview.v1');
    assert.deepEqual(identity.input.simulation,{seed:42,runs:100,months:24});
    const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`:JSON.stringify(value);
    assert.equal(createHash('sha256').update(canonical(identity.input.legal)).digest('hex'),identity.input.source.contentHash);
    for(const [index,month] of [0,12,24].entries()) {
      await page.locator('#month').fill(String(index));
      await page.waitForFunction(m=>window.hblPolicyImpact.getState().month===m,month);
      const observed=await page.evaluate(()=>{
        const s=window.hblPolicyImpact.getState(),p=s.results.runs.find(r=>r.runIndex===s.runIndex);
        const a=p.baseline.checkpoints.find(c=>c.month===s.month).state,b=p.proposal.checkpoints.find(c=>c.month===s.month).state;
        return {month:s.month,seed:p.seed,runIndex:p.runIndex,selectedStatesMatch:JSON.stringify(a)===JSON.stringify(s.selected.baseline)&&JSON.stringify(b)===JSON.stringify(s.selected.proposal),stateMonths:[s.selected.baseline.month,s.selected.proposal.month],metrics:document.querySelector('#metrics').innerText,scorecard:s.analysis.scorecard,eventNote:document.querySelector('#event-note').innerText,eventCount:document.querySelectorAll('#events>li').length,events:[...document.querySelectorAll('#events>li')].map(n=>n.firstChild.textContent),graphNodeCount:document.querySelectorAll('[data-node]').length,cityText:[document.querySelector('#city-a').innerText,document.querySelector('#city-b').innerText],canvasCount:document.querySelectorAll('#city-a canvas,#city-b canvas').length};
      });
      assert.equal(observed.selectedStatesMatch,true);
      assert.deepEqual(observed.stateMonths,[month,month]);
      assert.equal(observed.seed,identity.seed);
      const expectedEvents=await page.evaluate(()=>{const s=window.hblPolicyImpact.getState(),p=s.results.runs.find(r=>r.runIndex===s.runIndex);return ['baseline','proposal'].flatMap(arm=>(p[arm].events||[]).filter(e=>(e.simulationTime??e.month??0)<=s.month));});
      assert.equal(observed.eventCount,expectedEvents.length);
      const format=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
      for(const card of await page.locator('[data-metric]').all()) {
        const metricId=await card.getAttribute('data-metric');
        const metric=observed.scorecard.find(m=>m.id===metricId);
        if(metric?.status==='available'&&Number.isFinite(metric.baseline)&&Number.isFinite(metric.current)) {
          assert.ok((await card.innerText()).includes(`A ${format(metric.baseline)} → B ${format(metric.current)}`),`Recorded metric ${metricId} must match its card`);
        } else assert.match(await card.innerText(),/Unavailable/);
      }
      assert.match(observed.eventNote,new RegExp(`month ${month}`));
      assert.ok(observed.graphNodeCount>0);
      await page.locator('[data-node="outcomes"]').focus();
      await page.keyboard.press('Enter');
      const detail=JSON.parse(await page.locator('#node-detail').innerText());
      assert.equal(detail.node.record.month,month);
      assert.equal(detail.node.record.seed,identity.seed);
      assert.equal(detail.node.record.modelVersion,identity.modelVersion);
      observed.provenance=detail;
      await page.locator('[data-node="mapping:upzone"]').focus();
      await page.keyboard.press('Enter');
      const mapping=JSON.parse(await page.locator('#node-detail').innerText());
      assert.equal(mapping.node.record.sourceClauseId,'section-1');
      assert.equal(mapping.node.record.sourcePolicyId,'h_lots');
      assert.ok(mapping.edges.every(e=>e.kind==='reviewed assumption'));
      assert.ok(mapping.node.record.assumptions.length>0);
      assert.ok(mapping.node.record.limitations.length>0);
      observed.mapping=mapping;
      await page.screenshot({path:`${output}/${mode.name}-month-${month}.png`,fullPage:true});
      mode.checkpoints.push(observed);
    }
    await page.locator('[data-run-index="1"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>window.hblPolicyImpact.getState().runIndex===1);
    mode.secondPair=await page.locator('#selection').innerText();
    await page.reload();
    await page.waitForFunction(()=>window.hblPolicyImpact?.getState().selected,{timeout:90000});
    mode.reload=await page.evaluate(()=>{const s=window.hblPolicyImpact.getState();return {month:s.month,runIndex:s.runIndex,modelVersion:s.manifest.modelVersion,preview:s.manifest.id};});
    assert.equal(mode.reload.preview,preview);
    assert.equal(mode.reload.modelVersion,identity.modelVersion);
    mode.renderedCities=mode.gpu.available&&mode.checkpoints.every(c=>c.canvasCount===2)?'NOT RUN: canvas presence alone does not prove correct rendered state':'NOT RUN: native WebGPU cities unavailable';
    assert.deepEqual(errors,[]);
    mode.textAndRecordedState='PASS';
    report.modes.push(mode);
    await context.close();
  }
  const page=await browser.newPage();
  const civicUrl='https://civic-synthesis.fly.dev/proposals/citizen_c8aae87d-c360-4439-a4f2-6dce82442ad1/versions/2/impact?base=1';
  const response=await page.goto(civicUrl);
  assert.equal(response.status(),200);
  await page.locator('iframe').waitFor({timeout:30000});
  const iframe=await page.locator('iframe').getAttribute('src');
  assert.equal(iframe,target);
  const sandbox=await page.locator('iframe').getAttribute('sandbox');
  assert.ok(sandbox);
  assert.ok(!sandbox.includes('allow-top-navigation'));
  report.civic={url:civicUrl,iframe,sandbox,headers:response.headers(),text:await page.locator('main').innerText()};
  assert.ok(report.civic.headers['content-security-policy'].split(';').map(s=>s.trim()).includes("frame-src 'self' https://happybearlandia.fly.dev"));
  report.civic.deployment=await (await page.request.get('https://civic-synthesis.fly.dev/version')).json();
  const versions=await (await page.request.get('https://civic-synthesis.fly.dev/api/citizen-proposals/citizen_c8aae87d-c360-4439-a4f2-6dce82442ad1/versions')).json();
  const linked=versions.previews.find(p=>p.remoteId===preview);
  assert.ok(linked,'Civic must retain this exact remote preview identity');
  assert.deepEqual(linked.payload,report.modes[0].identity.input);
  assert.equal(linked.remoteMetadata.modelVersion,report.modes[0].identity.modelVersion);
  assert.equal(versions.canEdit,false,'This test must not own or mutate the deployed proposal');
  const publicData=JSON.stringify(versions);
  for(const privateField of ['ownerHash','votesByVoterHash','versionVotes']) assert.ok(!publicData.includes(`"${privateField}"`));
  report.civic.previewBinding='PASS';
  await page.screenshot({path:`${output}/civic-embedded.png`,fullPage:true});
} catch(error) { report.failure=error.stack; process.exitCode=1; }
finally { await browser.close(); await writeFile(`${output}/acceptance.json`,JSON.stringify(report,null,2)+'\n'); }
console.log(JSON.stringify({failure:report.failure,modes:report.modes.map(m=>({name:m.name,gpu:m.gpu,textAndRecordedState:m.textAndRecordedState,renderedCities:m.renderedCities})),artifact:`${output}/acceptance.json`},null,2));

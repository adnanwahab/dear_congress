/** Real normal-route browser/SQLite acceptance. Disposable local reviews only. */
import assert from 'node:assert/strict';
import {mkdtemp, rm, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes, randomUUID} from 'node:crypto';
import {Database} from 'bun:sqlite';
import {originalReviewBills} from '../src/shared/bill-catalog.ts';
const playwrightModule=new URL(process.env.PLAYWRIGHT_MODULE || '../tests/accessibility/node_modules/playwright/index.mjs',import.meta.url);
const {chromium}=await import(playwrightModule.href);
const {expect}=await import(process.env.PLAYWRIGHT_TEST_MODULE || new URL('../@playwright/test/index.mjs',playwrightModule).href);
const directory=await mkdtemp(join(tmpdir(),'civic-ballot-acceptance-'));
const output=process.env.CATALOG_BALLOT_OUTPUT || join(tmpdir(),'civic-ballot-acceptance-evidence');
const roles=['legal','evidence','fiscal','editorial','publisher'];
const reviewers=roles.map(role=>({id:'test-'+role,name:'Isolated fixture '+role,roles:[role],token:randomBytes(32).toString('hex')}));
const bill=originalReviewBills.find(row=>row.id==='HFL-021');
const reviewPath=join(directory,'review.sqlite'), ballotPath=join(directory,'ballots.sqlite');
const cookieSecret=randomBytes(32).toString('hex');
let server, draining, browser, base, port='0';
async function start(){
  server=Bun.spawn([process.execPath,'server.ts'],{cwd:new URL('../',import.meta.url).pathname,
    env:{PATH:process.env.PATH,DB_PATH:join(directory,'app.json'),PORT:port,
      CATALOG_REVIEW_DB:reviewPath,CATALOG_DB_PATH:ballotPath,CATALOG_REVIEWERS:JSON.stringify(reviewers),
      ANON_COOKIE_SECRET:cookieSecret,DEBUG_REQUEST_LOGS:'0'},stdout:'pipe',stderr:'pipe',stdin:'ignore'});
  let logs='',ready,timer;
  const started=new Promise(resolve=>{ready=resolve;});
  const read=async stream=>{for await(const chunk of stream){logs+=new TextDecoder().decode(chunk);const match=logs.match(/running at (http:\/\/\S+)/);if(match)ready(match[1].replace('0.0.0.0','localhost'));}};
  draining=Promise.all([read(server.stdout),read(server.stderr)]);
  try{base=await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Local server startup failed')),30000);})]);port=new URL(base).port;}
  finally{clearTimeout(timer);}
}
async function stop(){if(server){server.kill();await server.exited;await draining;server=undefined;}}
try{
  await mkdir(output,{recursive:true});await start();
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  const contexts=await Promise.all([browser.newContext(),browser.newContext({viewport:{width:390,height:844}})]);
  const pages=await Promise.all(contexts.map(context=>context.newPage()));
  const errors=[];pages.forEach(page=>page.on('pageerror',error=>errors.push(error.message)));
  const read=async(context,path='ballot')=>(await(await context.request.get(base+`api/catalog-bills/${bill.id}/${path}`)).json());
  for(const page of pages){await page.goto(base+'votes?bill=HFL-001');await expect(page.getByRole('region',{name:'Catalog advisory participation'}).getByText(/awaiting human review/)).toBeVisible();await expect(page.getByRole('group',{name:'Your advisory choice',exact:true})).toHaveCount(0);}
  const request=contexts[0].request;
  const review=async(role,path,data)=>request.post(base+path,{headers:{origin:new URL(base).origin,authorization:'Bearer '+reviewers.find(r=>r.roles.includes(role)).token},data});
  // Authentication is real, but credentials and approvals belong only to this disposable fixture.
  const bad=await request.post(base+`api/review/bills/${bill.id}/publish`,{data:{revision:bill.revision,jurisdiction:bill.jurisdiction,reason:'Unauthenticated attempt.'}});assert.equal(bad.status(),401);
  for(const role of roles.slice(0,4)){const response=await review(role,`api/review/bills/${bill.id}/decisions`,{revision:bill.revision,jurisdiction:bill.jurisdiction,category:role,decision:'approved',reason:'Isolated test-authenticated fixture; not a real-world review.'});assert.equal(response.status(),201);}
  const attested=await review('publisher',`api/review/bills/${bill.id}/publish`,{revision:bill.revision,jurisdiction:bill.jurisdiction,reason:'Separate test publisher verifies four fixture categories.'});assert.equal(attested.status(),201);
  const now=Date.now();
  const opened=await review('publisher',`api/catalog-bills/${bill.id}/publications`,{revision:bill.revision,opensAt:new Date(now-1000).toISOString(),closesAt:new Date(now+86400000).toISOString()});assert.equal(opened.status(),200);
  const publication=await opened.json();
  for(const page of pages){await page.goto(base+`votes?bill=${bill.id}`);await expect(page.getByRole('group',{name:'Your advisory choice',exact:true})).toBeVisible();}
  const group=page=>page.getByRole('group',{name:'Your advisory choice',exact:true});
  await group(pages[0]).getByRole('button',{name:'Yes',exact:true}).click();await expect(pages[0].getByRole('status').filter({hasText:'Saved by server.'})).toBeVisible();
  await group(pages[1]).getByRole('button',{name:'Unsure',exact:true}).click();await expect(pages[1].getByRole('status').filter({hasText:'Saved by server.'})).toBeVisible();
  assert.equal((await read(contexts[0])).ownChoice,'support');assert.equal((await read(contexts[1])).ownChoice,'unsure');assert.equal((await read(contexts[0])).counts.total,2);
  await group(pages[0]).getByRole('button',{name:'No',exact:true}).click();await expect(group(pages[0]).getByRole('button',{name:'No',exact:true})).toHaveAttribute('aria-pressed','true');
  const payload={revision:bill.revision,publicationId:publication.publicationId,choice:'oppose',requestId:randomUUID()};
  const put=(data,origin=new URL(base).origin)=>request.put(base+`api/catalog-bills/${bill.id}/ballot`,{headers:{origin},data});
  const duplicates=await Promise.all([put(payload),put(payload)]);const receipts=await Promise.all(duplicates.map(async r=>{assert.equal(r.status(),200);return r.json();}));assert.equal(receipts[0].receipt.id,receipts[1].receipt.id);
  assert.equal((await put({...payload,choice:'support'})).status(),409);
  assert.equal((await put({...payload,requestId:randomUUID(),revision:'0'.repeat(64)})).status(),409);
  assert.equal((await put({...payload,requestId:randomUUID(),publicationId:randomUUID()})).status(),409);
  assert.equal((await put({...payload,requestId:randomUUID()},'https://wrong-origin.test')).status(),403);
  // An aborted response must not report success; no successful HTTP response is fabricated.
  await pages[0].route('**/api/catalog-bills/*/ballot',async route=>route.request().method()==='PUT'?route.abort('failed'):route.continue());
  await group(pages[0]).getByRole('button',{name:'Yes',exact:true}).click();await expect(pages[0].getByRole('alert')).toBeVisible();await expect(pages[0].getByRole('status').filter({hasText:'Saved by server.'})).toHaveCount(0);
  await pages[0].unroute('**/api/catalog-bills/*/ballot');
  assert.equal((await read(contexts[0])).ownChoice,'oppose');
  // A real stalled request must hit the component deadline, without a mock success.
  await pages[0].route('**/api/catalog-bills/*/ballot',route=>{
    if(route.request().method()!=='PUT')return route.continue();
    // Intentionally leave transport unresolved until AbortSignal cancels it.
  });
  await group(pages[0]).getByRole('button',{name:'Yes',exact:true}).click();
  await expect(group(pages[0]).getByRole('button',{name:'Yes',exact:true})).toBeEnabled({timeout:12000});
  await expect(pages[0].getByRole('alert')).toBeVisible();
  await expect(pages[0].getByRole('status').filter({hasText:'Saved by server.'})).toHaveCount(0);
  await pages[0].unroute('**/api/catalog-bills/*/ballot');
  assert.equal((await read(contexts[0])).ownChoice,'oppose');
  await pages[1].getByRole('button',{name:'Withdraw my choice'}).click();await expect(pages[1].getByRole('button',{name:'Withdraw my choice'})).toHaveCount(0);assert.equal((await read(contexts[1])).ownChoice,null);
  await stop();await start();
  for(const page of pages)await page.goto(base+`votes?bill=${bill.id}`);
  await expect(group(pages[0]).getByRole('button',{name:'No',exact:true})).toHaveAttribute('aria-pressed','true');await expect(group(pages[1]).getByRole('button',{name:'Unsure',exact:true})).toHaveAttribute('aria-pressed','false');
  const replay=await(await put(payload)).json();assert.equal(replay.receipt.id,receipts[0].receipt.id);assert.equal(replay.replayed,true);assert.equal((await read(contexts[0])).counts.total,1);
  for(const [index,page]of pages.entries())await page.screenshot({path:join(output,`persisted-session-${index+1}.png`),fullPage:true});
  const revoked=await review('legal',`api/review/bills/${bill.id}/decisions`,{revision:bill.revision,jurisdiction:bill.jurisdiction,category:'legal',decision:'changes_requested',reason:'Isolated fixture invalidates its former review.'});assert.equal(revoked.status(),201);
  assert.equal((await put({...payload,requestId:randomUUID()})).status(),409);assert.equal((await read(contexts[0])).ownChoice,'oppose');
  for(const page of pages){await page.reload();await expect(group(page)).toHaveCount(0);}
  const db=new Database(ballotPath,{readonly:true});
  try{assert.equal(db.query('SELECT count(*) n FROM catalog_current_ballots').get().n,1);assert.equal(db.query('SELECT count(*) n FROM catalog_publications').get().n,1);}finally{db.close();}
  assert.deepEqual(errors,[]);
  await writeFile(join(output,'receipt.json'),JSON.stringify({fixtureOnly:true,productionWrites:false,billId:bill.id,revision:bill.revision,publicationId:publication.publicationId,twoSessions:true,restart:true,duplicateReceipt:true,closedWritesRejected:true},null,2)+'\n');
  console.log('PASS real catalog ballot: authenticated fixture, two sessions, change/withdraw/retry/restart, stale/closed/origin rejection and no false success');
}finally{await browser?.close();await stop();await rm(directory,{recursive:true,force:true});}

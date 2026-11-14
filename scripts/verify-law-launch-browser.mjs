/** Real browser + real HBL model; test-only transport forwarding, no mocked receipts.
 * Start both disposable servers first. Set PLAYWRIGHT_MODULE to an installed Playwright
 * module specifier/path, CIVIC_TEST_ORIGIN and HBL_TEST_ORIGIN to loopback origins.
 */
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
function localOrigin(value){const u=new URL(value);assert(['127.0.0.1','localhost','[::1]'].includes(u.hostname)&&u.protocol==='http:','Disposable loopback server required');return u.origin;}
const civic=localOrigin(process.env.CIVIC_TEST_ORIGIN||'http://127.0.0.1:4399');
const hbl=localOrigin(process.env.HBL_TEST_ORIGIN||'http://127.0.0.1:4498');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
const errors=[],warnings=[],responses=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')warnings.push(m.text())});
// Keep the actual production CSP. Forward only the exact model endpoint to a
// disposable real provider; browser still renders/parses the returned model data.
await page.route('https://happybearlandia.fly.dev/api/law-behavior',async route=>{
 const response=await route.fetch({url:hbl+'/api/law-behavior'});await route.fulfill({response});
});
page.on('response',async r=>{if(r.url().endsWith('/api/law-behavior'))try{responses.push(await r.json())}catch{}});
try{
 await page.goto(civic+'/synth');await page.getByRole('button',{name:'Run two futures',exact:true}).waitFor();
 assert.equal(await page.locator('.civic-law-behavior iframe,.civic-law-behavior img').count(),0);
 assert.equal(await page.getByText('Advanced synthesis, scoring and frozen plan comparisons').evaluate(n=>n.parentElement.open),false);
 await page.getByRole('button',{name:'Run two futures',exact:true}).click();await page.locator('.civic-law-provenance').waitFor({timeout:60000});
 assert.equal(responses.length,1);assert.equal(responses[0].manifest.seed,42);assert.equal(responses[0].manifest.implementationStrength,1);
 const slider=page.locator('.civic-law-controls input[type=range]');await slider.fill('50');assert.equal(await page.locator('.civic-law-provenance').count(),0);
 await page.getByRole('button',{name:'Run two futures',exact:true}).click();await page.locator('.civic-law-provenance').waitFor({timeout:60000});
 assert.equal(responses.length,2);assert.equal(responses[1].manifest.implementationStrength,.5);assert.equal(responses[1].manifest.seed,42);
 assert.deepEqual(responses[0].frames.map(f=>f.baseline),responses[1].frames.map(f=>f.baseline));
 await page.getByLabel('Recorded simulation time').fill('0');await page.getByLabel('Synthetic actor').selectOption({index:1});
 await page.getByText('Why did this change? Model evidence and limitations',{exact:true}).click();
 assert((await page.locator('.civic-law-behavior').innerText()).includes('project/event IDs or a validated causal explanation; those are unavailable here'));
 const href=await page.getByRole('link',{name:'Explore this future in HappyBearLandia'}).getAttribute('href');assert.equal(new URL(href).searchParams.get('implementationStrength'),'0.5');
 const share=await page.getByRole('link',{name:'Reproducible scenario link'}).getAttribute('href');
 await page.getByRole('link',{name:'Reproducible scenario link'}).click();assert.equal(await slider.inputValue(),'50');assert.equal(await page.locator('.civic-law-provenance').count(),0);
 assert.equal(new URL(page.url()).searchParams.get('revision'),'2');
 await page.setViewportSize({width:320,height:800});
 const screenshot=process.env.CIVIC_SCREENSHOT||'/private/tmp/civic-launch-320.png';await page.screenshot({path:screenshot,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('button',{name:'Run two futures',exact:true}).focus();assert.equal(await page.getByRole('button',{name:'Run two futures',exact:true}).evaluate(e=>e===document.activeElement),true);
 await page.goto(civic+'/synth?civicContext=1&lawId=31');await page.getByRole('alert').filter({hasText:'invalid or unsupported context'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Run two futures',exact:true}).isDisabled(),true);assert.equal(responses.length,2);
 await page.goto(civic+share.replace(/modelVersion=[^&]+/,'modelVersion=unavailable.v0'));await page.getByRole('button',{name:'Run two futures',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Model version mismatch'}).waitFor({timeout:60000});assert.equal(await page.locator('.civic-law-lanes').count(),0);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'passed',realRequests:responses.length,seed:42,baselineMatched:true,editedStrength:.5,reducedMotion:true,mobileWidth:320,unsupportedRejected:true,versionMismatchRejected:true,errors,warnings,screenshot}));
}finally{await browser.close()}

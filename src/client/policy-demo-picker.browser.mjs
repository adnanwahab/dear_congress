/** Isolated component smoke; not proof of mounted production save/preview routes. */
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || '../../tests/accessibility/node_modules/playwright/index.mjs');
const directory = await mkdtemp(join(tmpdir(),'civic-demo-picker-'));
const output = process.env.POLICY_DEMO_OUTPUT || join(tmpdir(),'civic-policy-demo-picker-evidence');
let server, browser;
try {
  await mkdir(output,{recursive:true});
  const entry=join(directory,'entry.tsx');
  await writeFile(entry,`import {createElement} from ${JSON.stringify(fileURLToPath(import.meta.resolve('react')))};
import {createRoot} from ${JSON.stringify(fileURLToPath(import.meta.resolve('react-dom/client')))};
import {PolicyDemoPicker} from ${JSON.stringify(new URL('./PolicyDemoPicker.tsx',import.meta.url).pathname)};
createRoot(document.getElementById('app')).render(createElement(PolicyDemoPicker,{onSelect:async()=>{throw Error('fixture failure')}}));`);
  const bundle=await Bun.build({entrypoints:[entry],target:'browser',jsx:{runtime:'automatic',importSource:'react'}});
  if(!bundle.success) throw new Error(bundle.logs.join('\n'));
  const js=await bundle.outputs[0].text();
  server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(request){return new URL(request.url).pathname==='/app.js'?new Response(js,{headers:{'content-type':'application/javascript'}}):new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><script type="module" src="/app.js"></script>',{headers:{'content-type':'text/html'}});}});
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.port}`);
    const select=page.getByLabel('Choose a policy');await select.focus();assert.equal(await select.evaluate(el=>document.activeElement===el),true);
    for(const id of ['housing','drainage','transit','unsupported']){
      await select.selectOption(id);
      await page.getByText(id==='unsupported'?'Not Modeled. Legal diff retained.':`Software mapping: ${id==='housing'?'h_lots':id==='drainage'?'f_drainage':'t_brt'}.`,{exact:false}).waitFor();
      assert.equal(await page.locator('iframe,a[href*="preview"]').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.screenshot({path:join(output,`${id}-${width}.png`),fullPage:true});
    }
    await page.getByRole('button',{name:'Use this illustrative draft'}).focus();await page.keyboard.press('Enter');
    await page.getByRole('status').filter({hasText:'No save or simulation success'}).waitFor();
  }
  assert.deepEqual(errors,[]);console.log('PASS isolated picker: four exact drafts, desktop/mobile reflow, keyboard activation and honest failure');
} finally {await browser?.close();server?.stop(true);await rm(directory,{recursive:true,force:true});}

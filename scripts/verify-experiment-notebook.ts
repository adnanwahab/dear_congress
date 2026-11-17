/** Isolated browser fixture: no server, live provider, votes or production state.
 * PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs bun scripts/verify-experiment-notebook.ts
 */
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const directory=await mkdtemp(join(tmpdir(),'civic-notebook-browser-'));
try{
 const entry=join(directory,'fixture.tsx');
 await writeFile(entry,`import {createRoot} from ${JSON.stringify(resolve('node_modules/react-dom/client'))};import {LawBehaviorExplorer} from ${JSON.stringify(resolve('src/client/LawBehaviorExplorer.tsx'))};createRoot(document.getElementById('root')).render(<LawBehaviorExplorer seed={42} hblOrigin="https://happybearlandia.fly.dev"/>);`);
 const build=await Bun.build({entrypoints:[entry],target:'browser',outdir:directory,jsx:{runtime:'automatic',importSource:resolve('node_modules/react')}});
 assert(build.success,String(build.logs));
 const js=await build.outputs.find(x=>x.path.endsWith('.js'))!.text();
 const css=await build.outputs.find(x=>x.path.endsWith('.css'))!.text();
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  for(const touch of [false,true]){
   const context=await browser.newContext({viewport:{width:touch?320:1280,height:850},hasTouch:touch,isMobile:touch,reducedMotion:'reduce'});
   const page=await context.newPage();let requests=0;const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
   await page.route('**/*',async(route:any)=>{
    const url=new URL(route.request().url());
    if(url.origin==='https://notebook.test')return route.fulfill({contentType:url.pathname==='/app.js'?'text/javascript':url.pathname==='/app.css'?'text/css':'text/html',body:url.pathname==='/app.js'?js:url.pathname==='/app.css'?css:'<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><main id="root"></main><script type="module" src="/app.js"></script>'});
    assert.equal(url.href,'https://happybearlandia.fly.dev/api/law-behavior');requests++;
    const input=route.request().postDataJSON();
    return route.fulfill({json:{schemaVersion:'hbl-law-behavior-receipt.v1',status:'completed',law:{id:'law-83',number:83,title:'Transit fixture'},engine:'population',unit:'minute',manifest:{modelVersion:'browser-fixture.v1',seed:input.seed,population:24,implementationStrength:input.implementationStrength,pairedInitialState:true,start:0,end:720,recordedCheckpoints:2,scope:'synthetic test fixture'},frames:[0,720].map(time=>({time,baseline:{metrics:{trips:time},actors:[]},edited:{metrics:{trips:time+1},actors:[]}})),limitations:['Test fixture, no model execution.']}});
   });
   await page.goto('https://notebook.test/synth');
   const action=async(name:string)=>{const button=page.getByRole('button',{name,exact:true});if(touch)await button.tap();else{await button.focus();await page.keyboard.press('Enter');}};
   await action('Run two futures');await page.locator('.civic-law-provenance').waitFor();
   await page.getByRole('textbox',{name:'Run name'}).fill('Transit baseline');await action('Save named run');
   await action('Duplicate Transit baseline');
   await page.getByRole('checkbox',{name:'Compare Transit baseline',exact:true}).check();await page.getByRole('checkbox',{name:'Compare Transit baseline copy',exact:true}).check();
   await page.getByRole('region',{name:'Recorded final checkpoint comparison'}).waitFor();
   await page.reload();await action('Replay Transit baseline');
   assert.equal(requests,1);assert.equal(await page.getByLabel('Recorded simulation time').inputValue(),'0');
   await page.getByLabel('Recorded simulation time').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByLabel('Recorded simulation time').inputValue(),'1');
   assert(await page.getByRole('link',{name:'Download receipt for Transit baseline',exact:true}).getAttribute('href'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Notebook browser checks passed: keyboard, touch at 320px, reduced motion, save/duplicate/compare/reload/replay; fixture receipts only.');
 }finally{await browser.close();}
}finally{await rm(directory,{recursive:true,force:true});}

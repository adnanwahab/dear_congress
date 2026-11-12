const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1365,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let responseMode='normal';
 const policy={version:'1',timezone:'America/Chicago',quorum:10,minExposureHours:24,requiredApprovals:1,allowedBases:[],requiredChecks:[],enabled:false,dryRun:true,maxRecoveryHours:6};
 await page.route('**/api/hbl/**',async route=>{
  const url=new URL(route.request().url()),m=/\/repos\/([^/]+)\/(pulls|issues)(?:\/(\d+))?/.exec(url.pathname);
  if(!m)return route.fulfill({status:200,json:{}});
  if(responseMode==='unavailable')return route.fulfill({status:503,json:{error:{message:'Source unavailable fixture'}}});
  const [,repo,collection,number]=m,kind=collection==='issues'?'issue':'pr';
  if(repo==='digital_pensieve'&&!number)await new Promise(r=>setTimeout(r,350));
  const p={kind,number:7,repositoryId:1,title:`${repo} ${kind} fixture`,body:'<script>throw new Error("untrusted")</script>\nSynthetic browser contract fixture',author:'fixture',url:`https://github.com/adnanwahab/${repo}/${kind==='issue'?'issues':'pull'}/7`,updatedAt:'2026-11-12T00:00:00Z',headSha:kind==='pr'?'a'.repeat(40):'',base:kind==='pr'?'pilot':'',draft:kind==='pr',state:'open',version:`${repo}:${kind}:7`,firstSeenAt:1,labels:['feature'],tally:{yes:3,no:1,participation:4,feedback:0},community:{yes:0,no:0,participation:0,choice:null},eligibility:{eligible:false,state:'blocked',reason:kind==='issue'?'Priority only; never merge candidates':'Merge integration disabled'},workflow:{state:'not-configured',reason:'Companion integration is not configured.'},links:['https://linear.app/team/issue/SHE-7']};
  const viewer={authenticated:true,approved:true,alias:'Fixture account',csrf:'fixture'};
  return route.fulfill({json:number?{contract:'hbl-governance.v1',pull:p,viewer,choice:null,feedback:[],historicalVotes:[]}:{contract:'hbl-governance.v1',repository:`adnanwahab/${repo}`,kind,pulls:responseMode==='empty'?[]:responseMode==='pages'?Array.from({length:25},(_,i)=>({...p,number:i+1})): [p],policy,nextBatch:null,lastSync:'2026-11-12T00:00:00Z',stale:responseMode==='partial',sourceStatus:responseMode==='partial'?'partial':'live',warning:responseMode==='partial'?'Only part of repository fetched. Counts incomplete.':undefined,roster:{approved:100,capacity:100},viewer,integration:{state:'disabled',reason:'Operator configuration required.'}}});
 });
 for(const repo of ['dear_congress','happybearlandia','digital_pensieve'])for(const kind of ['pr','issue']){
  await page.goto(`http://127.0.0.1:54431/vote/${repo}?view=${kind==='issue'?'issues':'prs'}`);
  await page.getByRole('link',{name:`#7 ${repo} ${kind} fixture`,exact:true}).click();
  await page.getByRole('heading',{name:`#7 ${repo} ${kind} fixture`,exact:true}).waitFor();
  assert.equal(await page.getByText('Synthetic browser contract fixture',{exact:false}).count(),1);
  if(kind==='issue')assert.equal(await page.getByRole('heading',{name:'Code checks and review evidence'}).count(),0);
 }
 // Selector from detail must return to list; keyboard changes and history preserve view.
 await page.getByLabel('Application').selectOption('dear_congress');
 await page.getByRole('link',{name:'#7 dear_congress issue fixture',exact:true}).waitFor();
 assert.match(page.url(),/\/vote\/dear_congress\?view=issues$/);
 await page.getByRole('button',{name:'Pull requests',exact:true}).focus();await page.keyboard.press('Enter');
 await page.getByRole('link',{name:'#7 dear_congress pr fixture',exact:true}).waitFor();
 await page.goBack();await page.getByRole('link',{name:'#7 dear_congress issue fixture',exact:true}).waitFor();
 await page.goForward();await page.getByRole('link',{name:'#7 dear_congress pr fixture',exact:true}).waitFor();
 // Delayed obsolete repository response must not replace current list.
 await page.getByLabel('Application').selectOption('digital_pensieve');await page.getByLabel('Application').selectOption('happybearlandia');
 await page.getByRole('link',{name:'#7 happybearlandia pr fixture',exact:true}).waitFor();await page.waitForTimeout(500);
 assert.equal(await page.getByRole('link',{name:'#7 digital_pensieve pr fixture',exact:true}).count(),0);
 await page.screenshot({path:'docs/evidence/she-251-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Issues',exact:true}).click();
 await page.getByRole('link',{name:'#7 happybearlandia issue fixture',exact:true}).waitFor();
 await page.screenshot({path:'docs/evidence/she-251-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile layout overflow');
 await page.reload();await page.getByRole('link',{name:'#7 happybearlandia issue fixture',exact:true}).waitFor();
 responseMode='unavailable';await page.getByLabel('Application').selectOption('dear_congress');await page.getByRole('alert').waitFor();assert.equal(await page.getByText('No game patches yet',{exact:true}).count(),0);
 responseMode='empty';await page.getByLabel('Application').selectOption('digital_pensieve');await page.getByText('No game patches yet',{exact:true}).waitFor();
 responseMode='partial';await page.getByLabel('Application').selectOption('happybearlandia');await page.getByText('Stale cached source',{exact:true}).waitFor();await page.getByText('Only part of repository fetched. Counts incomplete.',{exact:true}).waitFor();
 responseMode='pages';await page.getByLabel('Application').selectOption('dear_congress');await page.getByRole('link',{name:'#1 dear_congress issue fixture',exact:true}).waitFor();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('link',{name:'#21 dear_congress issue fixture',exact:true}).waitFor();
 await page.goto('http://127.0.0.1:54431/vote');await page.getByRole('heading',{name:'Civic Synthesis',exact:true}).waitFor();await page.getByRole('link',{name:'Repository voting ↗',exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: six list/detail routes, safe plain text, selector, keyboard, history, refresh, stale-response isolation, mobile width, unavailable/empty/partial states and pagination. Screenshots use synthetic contract fixtures.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});

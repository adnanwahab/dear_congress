import {expect,test} from 'bun:test';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {emptyDB,buildContext,synthesize,DEFAULT_WEIGHTS,extract} from '../engine/engine';
import {SEED_JOURNALS} from '../engine/catalog';
import {createPublicPlan} from './public-plan';
test('public plan matches existing real-only synthesis without changing live state or exporting private inputs',()=>{
 const db=emptyDB(),now=new Date('2026-11-02T12:00:00Z');
 db.entries=SEED_JOURNALS.map((s,i)=>({id:`entry-${i}`,author:'PRIVATE_AUTHOR',text:s.text,createdAt:now.toISOString(),extraction:extract(s.text),corrected:false,seeded:true}));
 db.entries.push({id:'private-journal',author:'PRIVATE_AUTHOR',text:'PRIVATE_JOURNAL_SENTINEL',createdAt:now.toISOString(),extraction:extract('I need housing'),corrected:false});
 db.votesByVoter.PRIVATE_VOTER={};db.lastPlan={A:['h_lots']};db.challengerStreak={A:{h_vouchers:2}};
 const before=structuredClone(db),result=createPublicPlan(db,{now,sourceUrl:'https://dc.test/api/plan'});
 const expected=synthesize(buildContext(structuredClone(before),undefined,{includeSynthetic:false,now:now.toISOString()}),DEFAULT_WEIGHTS,.25,40,before.lastPlan,before.challengerStreak);
 expect(result.packages.map(p=>p.items.map(i=>i.proposal.id))).toEqual(expected.map(p=>p.items.map(i=>i.proposal.id)));
 expect(db).toEqual(before);expect(result.balanced?.id).toBe('A');expect(result.alternatives.length).toBe(result.packages.length-1);
 const json=JSON.stringify(result);for(const secret of ['PRIVATE_AUTHOR','PRIVATE_JOURNAL_SENTINEL','PRIVATE_VOTER','sourceText','estimates','variantChoices','challengerStreak'])expect(json).not.toContain(secret);
 expect(createPublicPlan(db,{now}).provenance.planHash).toBe(result.provenance.planHash);expect(result.provenance.storedSnapshot).toBe(false);
});

test('GET /api/plan is public, read-only and leaves stored plan/streak/snapshots untouched',async()=>{
 const db=emptyDB();db.schemaVersion=2;db.lastPlan={A:['h_lots']};db.challengerStreak={A:{h_vouchers:2}};db.simulationSnapshots=[];
 const path=join(tmpdir(),`dc-public-plan-${crypto.randomUUID()}.json`);await Bun.write(path,JSON.stringify(db));
 const saved={DB_PATH:process.env.DB_PATH,PORT:process.env.PORT,DEBUG_REQUEST_LOGS:process.env.DEBUG_REQUEST_LOGS};let server:{url:URL;stop:(force?:boolean)=>void}|undefined;
 try{
  process.env.DB_PATH=path;process.env.PORT='0';process.env.DEBUG_REQUEST_LOGS='0';
  const module=await import(`../../server.ts?public-plan=${crypto.randomUUID()}`);server=module.server;
  const before=await Bun.file(path).text();
  for(let i=0;i<2;i++){const response=await fetch(new URL('/api/plan',server!.url));expect(response.status).toBe(200);const value=await response.json();expect(value.schemaVersion).toBe('dear-congress-public-plan.v1');expect(value.balanced.id).toBe('A');expect(value.provenance.legalStatus).toContain('not enacted');}
  expect(await Bun.file(path).text()).toBe(before);
 }finally{server?.stop(true);await Bun.file(path).delete();for(const [key,value]of Object.entries(saved))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});

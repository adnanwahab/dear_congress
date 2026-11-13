import {test,expect} from 'bun:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GovernanceStore} from './store';
import type {Pull} from '../../shared/hbl-governance';
const pull=(version='v1'):Pull=>({number:1,repositoryId:12,title:'Change',body:'',author:'someone',url:'https://github.com/a/b/pull/1',updatedAt:'',headSha:version,base:'main',draft:false,state:'open',version,firstSeenAt:0,labels:[]});
test('atomic roster capacity, idempotent updates, release and reuse seats',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hbl-store-')),path=join(dir,'test.sqlite');
 const a=new GovernanceStore(path),b=new GovernanceStore(path);
 try {
 const attempts=await Promise.allSettled(Array.from({length:120},(_,i)=>Promise.resolve().then(()=> (i%2?a:b).setMembership(i+1,`member-${i}`,true,1))));
 expect(attempts.filter(r=>r.status==='fulfilled')).toHaveLength(100);expect(a.rosterCount()).toBe(100);
 a.setMembership(1,'renamed',true,2);expect(a.rosterCount()).toBe(100);
 a.setMembership(1,'renamed',false,3);b.setMembership(121,'replacement',true,4);expect(a.rosterCount()).toBe(100);
 } finally {a.db.close();b.db.close();rmSync(dir,{recursive:true,force:true});}
});
test('votes append revisions, versions invalidate, frozen cutoff survives restart and excludes current revoked members',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hbl-cutoff-')),path=join(dir,'test.sqlite');let s=new GovernanceStore(path);
 try {
 s.upsertPull(pull(),1);s.setMembership(1,'voter',true,1);s.setMembership(2,'other',true,1);
 s.vote(1,1,'v1','yes',2);s.vote(1,1,'v1','no',5);s.vote(2,1,'v1','yes',3);
 expect(s.tally(1,'v1',5)).toMatchObject({yes:2,no:0}); // strict cutoff excludes equality
 s.upsertPull(pull('v2'),6);expect(()=>s.vote(1,1,'v1','yes',7)).toThrow('stale_version');expect(s.choice(1,1,'v2')).toBeNull();
 expect(s.freeze(5,8)[0]?.version).toBe('v1');expect(s.tally(1,'v1',5).yes).toBe(2);
 s.db.close();s=new GovernanceStore(path);s.vote(1,1,'v2','yes',9);
 expect(s.freeze(5,10)[0]?.version).toBe('v1');expect(s.tally(1,'v1',5).yes).toBe(2);
 s.setMembership(2,'other',false,11);expect(s.tally(1,'v1',5).yes).toBe(1);
 expect((s.db.query('SELECT count(*) n FROM vote_revisions').get() as any).n).toBe(4);
 } finally {s.db.close();rmSync(dir,{recursive:true,force:true});}
});
test('feedback and outbox persist atomically with idempotency and frozen choice',()=>{
 const s=new GovernanceStore(':memory:');s.upsertPull(pull(),1);s.setMembership(1,'alias',true,1);s.vote(1,1,'v1','yes',2);
 const first=s.createFeedback(1,1,'v1','reason',true,'key',3);
 s.vote(1,1,'v1','no',4);expect(s.createFeedback(1,1,'v1','reason',true,'key',5)).toEqual(first);
 expect(()=>s.createFeedback(1,1,'v1','changed',true,'key',5)).toThrow('idempotency_conflict');
 expect(s.feedback(1)[0]?.choice).toBe('yes');expect((s.db.query('SELECT count(*) n FROM outbox').get() as any).n).toBe(1);s.db.close();
});
test('independent SQLite writers cannot overbook the last roster seats',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hbl-writers-')),path=join(dir,'test.sqlite');const s=new GovernanceStore(path);
 try {
 const modulePath=new URL('./store.ts',import.meta.url).href;
 const children=Array.from({length:4},(_,worker)=>Bun.spawn([process.execPath,'--eval',`import {GovernanceStore} from ${JSON.stringify(modulePath)};const s=new GovernanceStore(${JSON.stringify(path)});for(let i=1;i<=30;i++){try{s.setMembership(${worker*30}+i,'voter-'+(${worker*30}+i),true,1)}catch(e){if(e.code!=='roster_full')throw e}}s.db.close();`],{stdout:'pipe',stderr:'pipe'}));
 const results=await Promise.all(children.map(async child=>({exit:await child.exited,error:await new Response(child.stderr).text()})));
 expect(results).toEqual(results.map(()=>({exit:0,error:''})));expect(s.rosterCount()).toBe(100);
 }finally{s.db.close();rmSync(dir,{recursive:true,force:true});}
});
test('cutoff ignores later approvals and rejects public aliases containing email or raw provider IDs',()=>{
 const s=new GovernanceStore(':memory:');s.upsertPull(pull(),1);s.setMembership(1,'alias',true,10);s.vote(1,1,'v1','yes',11);
 expect(s.tally(1,'v1',10).participation).toBe(0);
 expect(()=>s.setMembership(2,'person@example.org',true,12)).toThrow('invalid_member');
 expect(()=>s.setMembership(2,'123456',true,12)).toThrow('invalid_member');s.db.close();
});

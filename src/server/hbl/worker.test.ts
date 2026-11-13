import {expect,test} from 'bun:test';
import {GovernanceStore} from './store';
import {BatchWorker} from './worker';
import {DEFAULT_POLICY} from './policy';
import {fixture} from './policy.test';
const now=Date.parse('2026-11-12T15:01:00Z');
function setup(uncertain=false) {
  const store=new GovernanceStore(':memory:'); store.upsertPull(fixture,now-48*3600000);
  for(let i=1;i<=10;i++) { store.setMembership(i,`member-${i}`,true,now-48*3600000); store.vote(i,1,fixture.version,'yes',now-3600000); }
  let merges=0;
  const source={listPulls:async()=>[fixture],detail:async()=>structuredClone(fixture),merge:async()=>{merges++;if(uncertain)throw new Error('unknown');return {merged:true,sha:'a'.repeat(40)};}};
  const policy={...DEFAULT_POLICY,enabled:true,dryRun:false,allowedBases:['main'],requiredChecks:['test']};
  return {store,source,policy,merges:()=>merges};
}
test('unique daily durable run prevents duplicate merge after restart',async()=>{
  const s=setup(); expect((await new BatchWorker(s.store,s.source,s.policy,{clock:()=>now}).run()).receipts[0]?.status).toBe('merged');
  const restored=await new BatchWorker(s.store,s.source,s.policy,{clock:()=>now+10000}).run(); expect(s.merges()).toBe(1);
  expect(restored.receipts[0]).toMatchObject({policyVersion:'1',cutoff:'2026-11-12T15:00:00.000Z',version:fixture.version,headSha:'head',base:'main',baseSha:'base',tally:{yes:10,no:0,participation:10},apiResult:'merged',mergeCommit:'a'.repeat(40)});
  expect(restored.receipts[0]?.snapshotRef).toContain('frozen_pulls:'); expect(restored.receipts[0]?.evidence?.checks.length).toBe(1);
});
test('uncertain merge is durable and never blindly retried',async()=>{
  const s=setup(true); expect((await new BatchWorker(s.store,s.source,s.policy,{clock:()=>now}).run()).status).toBe('unknown');
  expect((await new BatchWorker(s.store,s.source,s.policy,{clock:()=>now+300000}).run()).status).toBe('unknown'); expect(s.merges()).toBe(1);
});
test('provider merged true without a valid commit is an unknown outcome',async()=>{
  const s=setup(); s.source.merge=async()=>({merged:true,sha:'invalid'});
  const result=await new BatchWorker(s.store,s.source,s.policy,{clock:()=>now}).run();
  expect(result.status).toBe('unknown'); expect(result.receipts[0]?.mergeCommit).toBeNull(); expect(result.receipts[0]?.apiResult).toBe('unknown');
});
test('source failure produces a complete blocked receipt',async()=>{
  const s=setup(); s.source.detail=async()=>{throw new Error('provider credential must not leak');};
  const result=await new BatchWorker(s.store,s.source,s.policy,{clock:()=>now}).run();
  expect(result.receipts[0]).toMatchObject({number:1,status:'blocked',headSha:'head',tally:{yes:10},apiResult:'not-requested'});
  expect(JSON.stringify(result)).not.toContain('credential');
});
test('dry run and kill switch prevent mutation',async()=>{
  const s=setup(); await new BatchWorker(s.store,s.source,{...s.policy,dryRun:true},{clock:()=>now}).run(); expect(s.merges()).toBe(0);
  expect((await new BatchWorker(s.store,s.source,s.policy,{clock:()=>now,killSwitch:()=>true}).run()).status).toBe('disabled');
});
test('active lease blocks concurrent worker and expired merging lease needs reconciliation',async()=>{
  const s=setup(); new BatchWorker(s.store,s.source,s.policy); const cutoff=Date.parse('2026-11-12T15:00:00Z');
  s.store.db.query('INSERT INTO hbl_batch_runs VALUES(?,?,1,?,?,?)').run(cutoff,'other',now+1000,'running','[]');
  expect((await new BatchWorker(s.store,s.source,s.policy,{clock:()=>now}).run()).status).toBe('leased');
  s.store.db.query("UPDATE hbl_batch_runs SET status='merging'").run();
  expect((await new BatchWorker(s.store,s.source,s.policy,{clock:()=>now+10000}).run()).status).toBe('unknown'); expect(s.merges()).toBe(0);
});
test('changed base between immediate evidence reads blocks the merge',async()=>{
  const s=setup(); let reads=0;
  s.source.detail=async()=>{ const p=structuredClone(fixture); if(++reads===2) p.evidence!.baseSha='new-base'; return p; };
  const result=await new BatchWorker(s.store,s.source,s.policy,{clock:()=>now}).run();
  expect(result.receipts[0]?.status).toBe('blocked'); expect(s.merges()).toBe(0);
  expect(result.receipts[0]?.baseSha).toBe('new-base'); expect(result.receipts[0]?.apiResult).toBe('not-requested');
});
test('expired running lease restarts safely with a higher fencing token',async()=>{
  const s=setup(); new BatchWorker(s.store,s.source,s.policy); const cutoff=Date.parse('2026-11-12T15:00:00Z');
  s.store.db.query('INSERT INTO hbl_batch_runs VALUES(?,?,1,?,?,?)').run(cutoff,'other',now-1000,'running','[]');
  expect((await new BatchWorker(s.store,s.source,s.policy,{clock:()=>now}).run()).receipts[0]?.status).toBe('merged');
  expect((s.store.db.query('SELECT fence FROM hbl_batch_runs').get() as {fence:number}).fence).toBe(2);
});

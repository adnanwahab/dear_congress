import {test,expect} from 'bun:test';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {POLICY_DEMOS} from '../shared/policy-demo-catalog';
import {PolicyOriginStore,POLICY_BASELINE} from './policy-origin-store';
import {canonical,digest,saveVersion,versionData,createPreview} from './policy-preview';
import {publishCitizenProposal,voteCitizenProposal,type CitizenProposalStore} from './citizen-proposals';
const site='https://civic.test';
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'civic-origin-')),path=join(dir,'origin.sqlite'),json=join(dir,'proposals.json');
 let data:CitizenProposalStore={entries:[]};
 const save=async()=>{writeFileSync(json,JSON.stringify(data));};
 let origin=new PolicyOriginStore(path,data,save,site);
 return {dir,path,json,get data(){return data;},get origin(){return origin;},save,
  restart(newSite=site){origin.close();data=JSON.parse(readFileSync(json,'utf8'));origin=new PolicyOriginStore(path,data,save,newSite);},
  close(){origin.close();rmSync(dir,{recursive:true,force:true});}};
}
test('all templates create actual immutable saved versions and restart-safe exact model inputs',async()=>{
 const f=fixture(),owner=randomUUID(),key=randomUUID();
 try{
  for(const demo of POLICY_DEMOS){
   const binding=await f.origin.create(demo.id,owner,demo.id==='housing'?key:randomUUID(),true);
   const p=f.data.citizenProposals!.find(p=>p.id===binding.proposalId)!;
   expect(binding.proposalVersionId).toBe(p.id+':v2');expect(binding.baselineVersionId).toBe(p.id+':v1');
   expect(p.legalVersions![0]!.clauses).toEqual([{...POLICY_BASELINE}]);
   expect(p.legalVersions![1]!.clauses.slice(1)).toEqual(demo.input.legal.clauses.map(c=>({clauseId:c.clauseId,text:c.afterText})));
   const prepared=f.origin.prepare(p.id,owner,1,2,true);
   if(prepared.status==='prepared'){
    expect(prepared.payload.source.system).toBe('civic-synthesis');
    expect(prepared.payload.source.proposalId).toBe(p.id);expect(prepared.payload.source.versionId).toBe(p.id+':v2');
    expect(prepared.payload.source.contentHash).toBe(digest(canonical(prepared.payload.legal)));
    expect(prepared.payload.source.contentHash).not.toBe(demo.legalHash);
    expect(prepared.savedContentHash).toBe(p.legalVersions![1]!.contentHash);
    expect(prepared.payload.simulation).toEqual({seed:42,runs:100,months:24});
    expect(prepared.payload.legal.clauses[0]!.afterText).toBe(demo.input.legal.clauses[0].afterText);
    expect(prepared.payload.legal.clauses[0]!.sourcePolicyId).toBe(demo.mappingId);
    expect(prepared.payload.baseline.versionId).toBe(prepared.payload.legal.baseVersionId);
    expect(JSON.stringify(prepared.payload)).not.toContain('ownerHash');
   }else{expect(prepared.status).toBe('unsupported');expect(prepared).not.toHaveProperty('payload');expect(prepared).toHaveProperty('legal');}
   await f.save();f.restart();
   expect(f.origin.prepare(p.id,owner,1,2,true)).toEqual(prepared);
  }
  const retried=await f.origin.create('housing',owner,key,true);
  expect(f.origin.db.query('SELECT count(*) n FROM policy_catalog_origins').get()).toMatchObject({n:4});
  expect(retried.proposalId).toBe(f.data.citizenProposals![0]!.id);
  expect(f.origin.db.query('SELECT count(*) n FROM policy_transfer_consents').get()).toMatchObject({n:3});
  expect(()=>f.origin.db.exec('DELETE FROM policy_catalog_origins')).toThrow('immutable');
  expect(()=>f.origin.db.exec('UPDATE policy_transfer_consents SET payloadHash=\'bad\'')).toThrow('append-only');
 }finally{f.close();}
});
test('v3 retains original v2 input, previews and separate advisory ballots',async()=>{
 const f=fixture(),owner=randomUUID();
 try{
  const b=await f.origin.create('drainage',owner,randomUUID(),true),p=f.data.citizenProposals![0]!;
  const input=f.origin.prepare(p.id,owner,1,2,true);
  // Existing local creator is exercised honestly: legacy registry has no new mapping,
  // so its recorded preview stays unsupported, not a fabricated successful HBL run.
  const local=createPreview(p,owner,2,{baseVersion:1,confirmedPublicTransfer:true},site);
  expect(local.status).toBe('unsupported');const old=JSON.stringify(local);
  voteCitizenProposal(f.data,p.id,owner,{proposalVersion:2,choice:'support'});
  saveVersion(p,owner,{expectedVersion:2,title:p.legalVersions![1]!.title,type:'bill',
    clauses:p.legalVersions![1]!.clauses.map(c=>({...c,text:c.text+' revised'})),confirmedPublic:true,idempotencyKey:randomUUID()});
  voteCitizenProposal(f.data,p.id,owner,{proposalVersion:3,choice:'oppose'});
  await f.save();f.restart();
  expect(f.origin.prepare(b.proposalId,owner,1,2,true)).toEqual(input);
  const third=f.origin.prepare(b.proposalId,owner,2,3,true);expect(third.status).toBe('unsupported');
  if(third.status==='unsupported')expect(third.legal?.clauses.every(c=>c.sourcePolicyId===null)).toBe(true);
  const saved=f.data.citizenProposals![0]!;expect(JSON.stringify(saved.policyPreviews![0])).toBe(old);
  const ballots=versionData(saved,owner).responses!;
  expect(ballots['2']!.counts.support).toBe(1);expect(ballots['3']!.counts.support).toBe(0);expect(ballots['3']!.counts.oppose).toBe(1);
 }finally{f.close();}
});
test('rejects missing origin, forgery, ownership, consent, edits, private flags and configured-origin drift',async()=>{
 const f=fixture(),owner=randomUUID();
 try{
  await expect(f.origin.create('housing',owner,randomUUID(),false)).rejects.toThrow('consent');
  const b=await f.origin.create('housing',owner,randomUUID(),true),p=f.data.citizenProposals![0]!;
  expect(()=>f.origin.prepare(p.id,owner,1,2,false)).toThrow('consent');
  expect(()=>f.origin.prepare(p.id,randomUUID(),1,2,true)).toThrow('ownership');
  expect(()=>f.origin.prepare('forged',owner,1,2,true)).toThrow('origin');
  expect(()=>f.origin.prepare(p.id,owner,1,99,true)).toThrow('actual saved');
  const original=structuredClone(p);
  for(const edit of [
   ()=>{p.legalVersions![1]!.title+=' forged';},
   ()=>{p.legalVersions![1]!.clauses[1]!.text+=' forged';},
   ()=>{p.legalVersions![1]!.type='constitutional-amendment';},
   ()=>{p.legalVersions![1]!.contentHash='0'.repeat(64);},
   ()=>{p.legalVersions![1]!.versionId='forged';},
   ()=>{p.provenance=undefined;},()=>{p.sourceEntryId='journal-private';},
   ()=>{Object.assign(p,{visibility:'private'});},()=>{Object.assign(p,{status:'draft'});},
   ()=>{Object.assign(p,{private:true});},
  ]){
   edit();expect(()=>f.origin.prepare(p.id,owner,1,2,true)).toThrow();
   for(const k of Object.keys(p))delete (p as unknown as Record<string,unknown>)[k];Object.assign(p,structuredClone(original));
  }
  const citizen=publishCitizenProposal(f.data,owner,{title:original.title,problem:'An arbitrary citizen copy.',proposedChange:POLICY_BASELINE.text,jurisdiction:'city',confirmedPublic:true,idempotencyKey:randomUUID()}).record;
  citizen.provenance='synthetic';citizen.legalVersions=structuredClone(p.legalVersions);
  expect(()=>f.origin.prepare(citizen.id,owner,1,2,true)).toThrow('origin');
  await f.save();f.restart('https://another-civic.test');
  expect(()=>f.origin.prepare(b.proposalId,owner,1,2,true)).toThrow('provenance');
 }finally{f.close();}
});
test('failed repository persistence never issues a durable mapping authority',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'civic-origin-failure-')),data:CitizenProposalStore={entries:[]},owner=randomUUID();
 const origin=new PolicyOriginStore(join(dir,'origin.sqlite'),data,async()=>{throw Error('Injected save failure');},site);
 try{
  await expect(origin.create('housing',owner,randomUUID(),true)).rejects.toThrow('save failure');
  expect(origin.db.query('SELECT count(*) n FROM policy_catalog_origins').get()).toMatchObject({n:0});
  expect(()=>origin.prepare(data.citizenProposals![0]!.id,owner,1,2,true)).toThrow('origin');
 }finally{origin.close();rmSync(dir,{recursive:true,force:true});}
});
test('a committed proposal with interrupted origin issuance is ineligible until an exact restart retry',async()=>{
 const f=fixture(),owner=randomUUID(),key=randomUUID();
 try{
  f.origin.db.exec("CREATE TEMP TRIGGER interrupt_origin BEFORE INSERT ON policy_catalog_origins BEGIN SELECT RAISE(ABORT,'Injected origin interruption'); END");
  await expect(f.origin.create('transit',owner,key,true)).rejects.toThrow('origin interruption');
  const committed=JSON.parse(readFileSync(f.json,'utf8')) as CitizenProposalStore;
  const id=committed.citizenProposals![0]!.id;
  expect(committed.citizenProposals![0]!.legalVersions).toHaveLength(2);
  expect(()=>f.origin.prepare(id,owner,1,2,true)).toThrow('origin');
  f.restart();
  expect(()=>f.origin.prepare(id,owner,1,2,true)).toThrow('origin');
  const repaired=await f.origin.create('transit',owner,key,true);
  expect(repaired.proposalId).toBe(id);expect(f.data.citizenProposals).toHaveLength(1);
  expect(f.origin.prepare(id,owner,1,2,true).status).toBe('prepared');
 }finally{f.close();}
});
test('concurrent issuance cannot silently replace or claim another configured origin binding',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'civic-origin-race-')),data:CitizenProposalStore={entries:[]},owner=randomUUID(),key=randomUUID();
 const path=join(dir,'origin.sqlite');
 const other=new PolicyOriginStore(path,data,async()=>{},'https://other-civic.test');
 const first=new PolicyOriginStore(path,data,async()=>{await other.create('housing',owner,key,true);},site);
 try{
  await expect(first.create('housing',owner,key,true)).rejects.toThrow('Concurrent');
  expect(first.db.query('SELECT count(*) n FROM policy_catalog_origins').get()).toMatchObject({n:1});
  expect(()=>first.prepare(data.citizenProposals![0]!.id,owner,1,2,true)).toThrow('provenance');
 }finally{first.close();other.close();rmSync(dir,{recursive:true,force:true});}
});

import {policyPreviewFixture} from "./policy-preview-fixture";
import { describe, expect, test } from 'bun:test';
import { publishCitizenProposal, createCitizenProposalHandlers } from './citizen-proposals';
import { createPreview, saveVersion, versions, submitPreview } from './policy-preview';
import { HOUSING_DEMO_TITLE, HOUSING_DEMO_TEXT } from '../shared/policy-preview';
import type { CitizenProposalRecord } from '../shared/citizen-proposals';
const owner = 'publishing-browser';
function proposal() {
  return publishCitizenProposal({entries:[]},owner,{ title:HOUSING_DEMO_TITLE,problem:'Synthetic example',proposedChange:HOUSING_DEMO_TEXT[0],jurisdiction:'city',confirmedPublic:true,idempotencyKey:crypto.randomUUID() }).record;
}
function revision(p: CitizenProposalRecord, extra = {}) {
  return {expectedVersion:versions(p).at(-1)!.version,title:p.title,type:'bill',clauses:[{clauseId:'section-1',text:String(HOUSING_DEMO_TEXT[1])}],confirmedPublic:true,idempotencyKey:crypto.randomUUID(),...extra};
}
function preview() { const p=proposal(); p.provenance='synthetic';saveVersion(p,owner,revision(p,{clauses:[{clauseId:'section-0',text:HOUSING_DEMO_TEXT[0]},{clauseId:'section-1',text:HOUSING_DEMO_TEXT[1]}]}));return {p, result:createPreview(p,owner,2,{baseVersion:1,confirmedPublicTransfer:true},'https://civic.example')}; }
describe('versioned policy previews',()=>{
  test('canonical handoff hash matches the companion executable validator golden',()=>{expect(policyPreviewFixture().previews[0]!.payload.source.contentHash).toBe('65c7ae6ce5facb992265593464b790aae5a484b68a9f2ef6e8911abb5261a9fd');});
  test('owner, consent, stale revisions, immutable snapshots, retry keys and original ballots',()=>{
    const p=proposal(); p.votesByVoterHash.original='support'; const input=revision(p);
    expect(()=>saveVersion(p,'another-browser',input)).toThrow('publishing browser');
    expect(()=>saveVersion(p,owner,{...input,confirmedPublic:false})).toThrow('Confirm');
    const before=versions(p)[0]!;const next=saveVersion(p,owner,input);
    expect(saveVersion(p,owner,input)).toEqual(next);
    expect(()=>saveVersion(p,owner,{...input,title:'Different'})).toThrow('Retry key');
    expect(()=>saveVersion(p,owner,{...input,idempotencyKey:crypto.randomUUID()})).toThrow('Revision changed');
    input.clauses[0]!.text='mutation';expect(next.clauses[0]!.text).toBe(HOUSING_DEMO_TEXT[1]);
    expect(versions(p)[0]).toEqual(before);expect(p.proposedChange).toBe(HOUSING_DEMO_TEXT[0]);expect(p.votesByVoterHash.original).toBe('support');
  });
  test('exact contract, determinism, scope, privacy and duplicate requests',()=>{
    const {p,result}=preview();
    expect(createPreview(p,owner,2,{baseVersion:1,confirmedPublicTransfer:true},'https://civic.example')).toBe(result);
    expect(p.policyPreviews).toHaveLength(1);expect(result.payload.schemaVersion).toBe('policy-impact-preview.v1');
    expect(result.payload.source.system).toBe('civic-synthesis');expect(result.payload.baseline.kind).toBe('prior-proposal-version');
    expect(result.payload.legal.clauses[0]).toEqual({clauseId:'section-1',sourcePolicyId:'h_lots',operation:'add',beforeText:'',afterText:HOUSING_DEMO_TEXT[1]});
    expect(result.payload.simulation).toEqual({seed:42,runs:100,months:24});
    expect(JSON.stringify(result)).not.toContain(p.ownerHash);expect(JSON.stringify(result)).not.toContain('votesByVoterHash');
    expect(()=>createPreview(p,'another-browser',2,{baseVersion:1,confirmedPublicTransfer:true},'https://civic.example')).toThrow('publishing browser');
    expect(()=>createPreview(p,owner,2,{baseVersion:1},'https://civic.example')).toThrow('Review');
    const third=saveVersion(p,owner,revision(p,{clauses:[{clauseId:'section-1',text:'Different legal language'}]}));
    const newer=createPreview(p,owner,third.version,{baseVersion:2,confirmedPublicTransfer:true},'https://civic.example');
    const custom = saveVersion(p,owner,revision(p,{title:'User supplied title',clauses:versions(p)[1]!.clauses}));
    expect(createPreview(p,owner,custom.version,{baseVersion:1,confirmedPublicTransfer:true},'https://civic.example').status).toBe('unsupported');
    expect(newer.id).not.toBe(result.id);expect(newer.status).toBe('unsupported');expect(result.payload.source.versionId).toBe(`${p.id}:v2`);
  });
  test('constitutional and arbitrary text never receive invented mappings; contact data blocked',()=>{
    const p=proposal();saveVersion(p,owner,revision(p,{type:'constitutional-amendment'}));
    const result=createPreview(p,owner,2,{baseVersion:1,confirmedPublicTransfer:true},'https://example.test');
    expect(result.status).toBe('unsupported');expect(result.payload.source.type).toBe('constitutional-amendment');expect(result.payload.legal.clauses[0]!.sourcePolicyId).toBeNull();
    expect(()=>saveVersion(p,owner,revision(p,{clauses:[{clauseId:'section-1',text:'Contact jane@example.com'}]}))).toThrow('contact');
    expect(()=>saveVersion(p,owner,revision(p,{clauses:[{clauseId:'same',text:'A'},{clauseId:'same',text:'B'}]}))).toThrow('unique');
  });
  test('authenticated remote idempotency, bounded retries and canonical origin validation',async()=>{
    const {result}=preview();let calls=0;
    const fetcher=(async(input:any,init:any)=>{calls++;expect(init.headers.authorization).toBe('Bearer SECRET');expect(init.headers['idempotency-key']).toBe(result.id);expect(init.redirect).toBe('error');expect(JSON.parse(init.body)).toEqual(result.payload);return calls<3?new Response('',{status:503}):Response.json({id:'remote1',url:'https://happybearlandia.fly.dev/world/impact?preview=remote1',job:{status:'running'}});}) as unknown as typeof fetch;
    const remote=await submitPreview(result,{url:'https://happybearlandia.fly.dev',token:'SECRET'},fetcher);
    expect(calls).toBe(3);expect(remote.status).toBe('running');expect(remote.remoteId).toBe('remote1');
    const invalid=await submitPreview(result,{url:'https://happybearlandia.fly.dev',token:'SECRET'},(async()=>Response.json({id:'remote1',job:{status:'completed'},url:'https://evil.example/world/impact?preview=remote1'})) as unknown as typeof fetch);
    expect(invalid.status).toBe('unavailable');expect(invalid.url).toBeUndefined();
    expect((await submitPreview(result,{url:'https://happybearlandia.fly.dev'})).status).toBe('unavailable');
  });
  test('completed results are recorded and remote failures never echo secrets',async()=>{
    const {result}=preview();let paths:string[]=[];
    const patch=await submitPreview(result,{url:'https://happybearlandia.fly.dev',token:'SECRET'},(async(input:any)=>{paths.push(String(input));return paths.length===1?Response.json({id:'job',job:{status:'completed'},url:'https://happybearlandia.fly.dev/world/impact?preview=job'}):Response.json({timeline:[{month:120}],mappings:['h_lots']});}) as unknown as typeof fetch);
    expect(paths[1]).toEndWith('/api/policy-previews/job/results?runIndex=0');expect(patch.results?.data).toEqual({timeline:[{month:120}],mappings:['h_lots']});
    const error=await submitPreview(result,{url:'https://happybearlandia.fly.dev',token:'SECRET'},(async()=>new Response('SECRET',{status:401})) as unknown as typeof fetch);
    expect(JSON.stringify(error)).not.toContain('SECRET');expect(error.status).toBe('unavailable');
  });
  test('serialized API rolls back failed version saves',async()=>{
    const p=proposal(),store={entries:[],citizenProposals:[p]};
    const handlers=createCitizenProposalHandlers({getStore:()=>store,save:async()=>{throw Error('disk');}});
    const req=new Request('https://example.test/api/citizen-proposals/'+p.id+'/versions',{method:'POST',headers:{'x-voter-id':owner,'content-type':'application/json'},body:JSON.stringify(revision(p))});
    expect((await handlers.revise(req,p.id)).status).toBe(500);expect(versions(p)).toHaveLength(1);expect(p.versionWriteKeys).toBeUndefined();
  });
});

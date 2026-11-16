import {test,expect} from 'bun:test';
import schema from '../../docs/schemas/model-input-manifest-v1.json';
import {modelInputManifest} from './model-input-manifest';
import {parseLawBehaviorReceipt,type LawBehaviorReceipt} from './LawBehaviorExplorer';
import type {CivicLawContext} from './civic-law-context';

// Validator for the JSON Schema keywords used by this closed, dependency-free contract.
function validate(value:unknown, rule:any):void {
  if('const' in rule && value!==rule.const)throw Error('const');
  if(rule.enum && !rule.enum.includes(value))throw Error('enum');
  if(rule.type==='null' && value!==null)throw Error('null');
  if(rule.type==='string' && (typeof value!=='string'||value.length<(rule.minLength??0)))throw Error('string');
  if(rule.type==='integer' && (typeof value!=='number'||!Number.isInteger(value)||value<(rule.minimum??-Infinity)||value>(rule.maximum??Infinity)))throw Error('integer');
  if(rule.type==='array') {
    if(!Array.isArray(value)||value.length<(rule.minItems??0)||value.length>(rule.maxItems??Infinity))throw Error('array');
    value.forEach(v=>validate(v,rule.items));
  }
  if(rule.type==='object') {
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('object');
    const record=value as Record<string,unknown>;
    for(const key of rule.required)if(!Object.hasOwn(record,key))throw Error('required');
    for(const [key,v] of Object.entries(record)) {
      if(!Object.hasOwn(rule.properties,key))throw Error('additionalProperties');
      validate(v,rule.properties[key]);
    }
  }
}
const context:CivicLawContext={lawId:83,seed:42,population:24,implementationStrength:.5,revision:2,proposalId:'demo-law-83'};
const receipt:LawBehaviorReceipt={schemaVersion:'hbl-law-behavior-receipt.v1',status:'completed',law:{id:'law-83',number:83,title:'Transit'},engine:'population',unit:'minute',
  manifest:{modelVersion:'population-test',seed:42,population:24,implementationStrength:.5,pairedInitialState:true,start:0,end:720,recordedCheckpoints:1,scope:'synthetic'},
  frames:[{time:720,baseline:{metrics:{trips:1},actors:[]},edited:{metrics:{trips:2},actors:[]}}],limitations:['Not calibrated.']};
const make=()=>modelInputManifest(parseLawBehaviorReceipt(receipt),context,'https://model.example','2026-11-15T12:00:00.000Z');
test('download manifest validates against the committed JSON schema in bun test CI',()=>{
  const before=JSON.stringify(receipt), manifest=JSON.parse(JSON.stringify(make()));
  validate(manifest,schema);
  expect(manifest.scenario.seed).toBe(42);
  expect(manifest.engine.version).toBe('population-test');
  expect(manifest.catalogRevision).toBeNull();
  expect(manifest.sources[0].retrievedAt).toBe('2026-11-15T12:00:00.000Z');
  expect(manifest.weights.values).toBeNull();
  expect(JSON.stringify(receipt)).toBe(before);
  expect(manifest).not.toHaveProperty('frames');
  for(const key of schema.required){const broken=structuredClone(manifest);delete broken[key];expect(()=>validate(broken,schema)).toThrow();}
  for(const mutate of [(m:any)=>m.privateJournal='secret',(m:any)=>m.scenario.seed=-1,(m:any)=>m.synthetic=false,(m:any)=>m.engine.version=null,(m:any)=>m.sources[0].retrievedAt=null,(m:any)=>m.weights.values={}]){
    const broken=structuredClone(manifest);mutate(broken);expect(()=>validate(broken,schema)).toThrow();
  }
});
test('rejects stale scenario inputs, unavailable runs and false retrieval provenance',()=>{
  for(const patch of [{seed:43},{lawId:22},{revision:0},{implementationStrength:1},{modelVersion:'other'}])
    expect(()=>modelInputManifest(receipt,{...context,...patch},'https://model.example','2026-11-15T12:00:00.000Z')).toThrow();
  expect(()=>modelInputManifest({...receipt,status:'mechanism-unavailable'},context,'https://model.example','2026-11-15T12:00:00.000Z')).toThrow();
  expect(()=>modelInputManifest(receipt,context,'https://model.example','unknown')).toThrow();
  expect(()=>modelInputManifest(receipt,context,'https://user:pass@model.example','2026-11-15T12:00:00.000Z')).toThrow();
});

test('completed-run download is available and changed inputs remove it without writes',async()=>{
  const child=Bun.spawn([process.execPath,'scripts/verify-model-manifest-ui.tsx'],{stdout:'pipe',stderr:'pipe'});
  const [code,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
  expect({code,stderr}).toEqual({code:0,stderr:''});
  expect(stdout).toContain('PASS model manifest');
});

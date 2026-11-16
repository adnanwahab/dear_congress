import {test,expect} from 'bun:test';
import {parseCivicLawContext,civicLawQuery,structuredAmendment,simulationShareQuery,parseSimulationShare} from './civic-law-context';
test('public scenario round trips only reviewed fields, without private URL values',()=>{
 const v=parseCivicLawContext('?civicContext=1&lawId=83&seed=42&implementationStrength=0.5&population=24&proposalId=demo-law-83&revision=2&email=private@example.com&token=secret');
 expect(v).toMatchObject({seed:42,lawId:83,implementationStrength:.5,revision:2});
 const q=civicLawQuery(v!).toString();expect(q).not.toContain('email');expect(q).not.toContain('token');
 expect(parseCivicLawContext(q)).toEqual(v);
 expect(structuredAmendment(v!)).toMatchObject({parameterKey:'implementationStrength',originalValue:1,editedValue:.5,horizon:720,clock:'minute'});
});
test('malformed, duplicate, unsupported and discrete context fails closed',()=>{
 for(const suffix of ['lawId=31','seed=-1','seed=4294967296','seed=','population=60','revision=0','revision=1000001','implementationStrength=.5','implementationStrength=0.3','lawId=21&implementationStrength=0.5','proposalId=../private','proposalId=a&proposalId=b','modelVersion=bad%20version','civicContext=1']){
 expect(parseCivicLawContext('?civicContext=1&'+suffix)).toBeNull();
 }
 expect(parseCivicLawContext('?seed=42')).toBeNull();
 expect(structuredAmendment(parseCivicLawContext('?civicContext=1&lawId=21&implementationStrength=1&seed=42&revision=1')!)).toMatchObject({parameterKey:'fixed-rule',permittedValues:[1]});
});

test('shared scenarios require complete identity rather than substituting defaults',()=>{
 const valid='civicContext=1&lawId=83&implementationStrength=0.5&seed=42&revision=2';
 for(const key of ['lawId','implementationStrength','seed','revision']){const q=new URLSearchParams(valid);q.delete(key);expect(parseCivicLawContext(q.toString())).toBeNull();}
});

test('versioned replay pins all settings and omits private proposal context',()=>{
 const context={lawId:83,implementationStrength:.5,seed:4294967295,population:24 as const,revision:2,proposalId:'unpublished-private-draft',modelVersion:'population.v1'};
 const q=simulationShareQuery(context);
 expect(q.get('horizon')).toBe('720');expect(q.get('clock')).toBe('minute');
 expect(q.toString()).not.toContain('proposal');
 expect(parseSimulationShare(q.toString())).toEqual({...context,proposalId:undefined});
 for(const key of [...q.keys()]){
  const missing=new URLSearchParams(q);missing.delete(key);expect(parseSimulationShare(missing.toString())).toBeNull();
  const duplicate=new URLSearchParams(q);duplicate.append(key,q.get(key)!);expect(parseSimulationShare(duplicate.toString())).toBeNull();
 }
 for(const [key,value] of [['horizon','12'],['clock','month'],['parameter','arbitrary'],['simulationShare','2'],['population','60']]){
  const invalid=new URLSearchParams(q);invalid.set(key!,value!);expect(parseSimulationShare(invalid.toString())).toBeNull();
 }
 const contaminated=q.toString()+'&journal=secret&identity=private&proposalId=unpublished';
 const replay=parseSimulationShare(contaminated)!;
 expect(simulationShareQuery(replay).toString()).toBe(q.toString());
 for(const lawId of [21,22,23]){
  const city=simulationShareQuery({...context,lawId,implementationStrength:1});
  expect(city.get('horizon')).toBe('12');expect(parseSimulationShare(city.toString())?.lawId).toBe(lawId);
 }
 expect(()=>simulationShareQuery({...context,modelVersion:undefined})).toThrow();
});

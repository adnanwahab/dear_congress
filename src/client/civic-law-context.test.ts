import {test,expect} from 'bun:test';
import {parseCivicLawContext,civicLawQuery,structuredAmendment} from './civic-law-context';
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

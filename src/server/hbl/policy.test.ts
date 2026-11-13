import { expect,test } from 'bun:test';
import {DEFAULT_POLICY,evaluateEligibility,intendedCutoff,nextBatch} from './policy';
import type { Pull } from '../../shared/hbl-governance';
export const fixture:Pull={number:1,repositoryId:1,title:'PR',body:'',author:'a',url:'https://github.com/adnanwahab/happybearlandia/pull/1',updatedAt:'',headSha:'head',base:'main',draft:false,state:'open',version:'head:main',firstSeenAt:0,labels:[],evidence:{checks:[{name:'test',status:'completed',conclusion:'success',sha:'head'}],reviews:[{userId:1,state:'APPROVED',commitId:'head'}],requestedReviewers:0,mergeable:true,mergeableState:'clean',baseSha:'base',protectionsKnown:true,protectedBase:true,sensitive:false,maintainerApproved:false}};
test('policy is closed by default and enforces votes, exposure, checks and review gates',()=>{
  const tally={yes:10,no:0,participation:10,feedback:0},policy={...DEFAULT_POLICY,allowedBases:['main'],requiredChecks:['test']};
  expect(evaluateEligibility(fixture,tally,DEFAULT_POLICY,1e12).eligible).toBe(false);
  expect(evaluateEligibility(fixture,tally,policy,1e12).eligible).toBe(true);
  for(const p of [{...fixture,draft:true},{...fixture,firstSeenAt:1e12},{...fixture,evidence:undefined},{...fixture,evidence:{...fixture.evidence!,checks:[]}},{...fixture,evidence:{...fixture.evidence!,reviews:[]}},{...fixture,evidence:{...fixture.evidence!,sensitive:true}},{...fixture,evidence:{...fixture.evidence!,mergeable:null}}]) expect(evaluateEligibility(p,tally,policy,1e12).eligible).toBe(false);
  expect(evaluateEligibility(fixture,{...tally,yes:5,no:5},policy,1e12).eligible).toBe(false);
});
test('Chicago 9am follows DST and recovery never backfills prior day',()=>{
  expect(nextBatch(Date.parse('2026-03-07T16:00:00Z'))).toBe('2026-03-08T14:00:00.000Z');
  expect(nextBatch(Date.parse('2026-10-31T15:00:00Z'))).toBe('2026-11-01T15:00:00.000Z');
  expect(intendedCutoff(Date.parse('2026-11-12T14:59:59Z'))).toBeNull();
  expect(intendedCutoff(Date.parse('2026-11-12T21:00:01Z'))).toBeNull();
  expect(intendedCutoff(Date.parse('2026-11-12T15:10:00Z'))).toBe(Date.parse('2026-11-12T15:00:00Z'));
});

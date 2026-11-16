import { test, expect } from 'bun:test';
import { previewReadiness } from './preview-readiness';
import { DEFAULT_POLICY } from '../server/hbl/policy';
import type { PublicPull } from '../shared/hbl-governance';
export const readyPull:PublicPull={number:7,repositoryId:1,title:'Patch',body:'',author:'fixture',url:'',updatedAt:'',headSha:'head',base:'main',draft:false,state:'open',version:'1:7:head:main',firstSeenAt:0,labels:[],tally:{yes:0,no:0,participation:0,feedback:0},eligibility:{eligible:false,state:'open-for-voting',reason:'Quorum required'},evidence:{checks:[{name:'bun test',status:'completed',conclusion:'success',sha:'head'}],reviews:[{userId:1,state:'APPROVED',commitId:'head'}],requestedReviewers:0,mergeable:true,mergeableState:'clean',baseSha:'base',protectionsKnown:true,protectedBase:true,sensitive:false,maintainerApproved:false}};
export const readyPolicy={...DEFAULT_POLICY,allowedBases:['main'],requiredChecks:['bun test']};
test('blocked base identifies configured rule without changing policy or votes',()=>{
 const p=structuredClone(readyPull),before=JSON.stringify(p);
 const result=previewReadiness(p,DEFAULT_POLICY);expect(result.state).toBe('blocked');expect(result.diagnostics[0]?.guidance).toContain('empty; fail closed');expect(JSON.stringify(p)).toBe(before);expect(DEFAULT_POLICY.quorum).toBe(10);
});
test('checks pending name and current-head remediation are explicit',()=>{
 const p=structuredClone(readyPull);p.evidence!.checks[0]!.status='in_progress';p.evidence!.checks[0]!.conclusion=null;
 expect(previewReadiness(p,readyPolicy).state).toBe('checks-pending');expect(previewReadiness(p,readyPolicy).diagnostics.find(r=>r.rule==='Check: bun test')?.state).toBe('pending');
 p.evidence!.checks[0]!.conclusion='failure';p.evidence!.checks[0]!.status='completed';expect(previewReadiness(p,readyPolicy).state).toBe('blocked');
});
test('review-ready is independent from preview registry and voting quorum',()=>{
 expect(previewReadiness(readyPull,readyPolicy)).toMatchObject({state:'review-ready',preview:'pending'});
 const p=structuredClone(readyPull);p.preview={headSha:'old',screenshotUrl:'/old',capturedAt:'',route:'/',exploreUrl:'https://old.fly.dev'};expect(previewReadiness(p,readyPolicy).preview).toBe('pending');p.preview.headSha='head';expect(previewReadiness(p,readyPolicy).preview).toBe('ready');
});
test('missing, inaccessible and wrong-revision receipts never imply readiness',()=>{
 const p=structuredClone(readyPull);p.evidence!.checks[0]!.sha='old';expect(previewReadiness(p,readyPolicy).state).toBe('unknown');p.evidence=undefined;expect(previewReadiness(p,readyPolicy).state).toBe('unknown');
});

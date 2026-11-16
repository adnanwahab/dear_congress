import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SafetyGates, AdvisorySafetyGate, safetyGates } from './SafetyGates';
import { DEFAULT_POLICY } from '../server/hbl/policy';
import type { PublicPull } from '../shared/hbl-governance';
const policy = {...DEFAULT_POLICY, allowedBases:['main'], requiredChecks:['bun test']};
const pull: PublicPull = {number:7, repositoryId:123, title:'Example', body:'', author:'author', url:'https://github.com/adnanwahab/dear_congress/pull/7', updatedAt:'', headSha:'current-head', base:'main', draft:false, state:'open', version:'current-head:main', firstSeenAt:0, labels:[], tally:{yes:10,no:0,participation:10,feedback:0}, eligibility:{state:'approved',eligible:true,reason:'Voting and repository checks passed'}, evidence:{baseSha:'base-sha',checks:[{name:'bun test',status:'completed',conclusion:'success',sha:'current-head'}],reviews:[{userId:1,state:'APPROVED',commitId:'current-head'}],requestedReviewers:0,mergeable:true,mergeableState:'clean',protectionsKnown:true,protectedBase:true,sensitive:false,maintainerApproved:false}};
const status = (p:PublicPull,id:string) => safetyGates(p,policy).find(g=>g.id===id)!.status;
test('blocked PR retains protection block despite overwhelming sentiment',()=>{
 const p={...pull,tally:{...pull.tally,yes:10000},evidence:{...pull.evidence!,protectedBase:false}};
 expect(status(p,'protection')).toBe('blocked'); expect(status(p,'sentiment')).toBe('advisory'); expect(status(p,'decision')).toBe('blocked');
});
test('pending, missing and obsolete checks do not become authorization',()=>{
 for(const checks of [[],[{...pull.evidence!.checks[0]!,status:'in_progress',conclusion:null}],[{...pull.evidence!.checks[0]!,sha:'old-head'}]]) expect(status({...pull,evidence:{...pull.evidence!,checks}},'checks')).toBe('pending');
 expect(status({...pull,evidence:undefined},'checks')).toBe('unknown');
});
test('review-ready evidence still requires an explicit human decision',()=>{
 expect(status(pull,'checks')).toBe('evidence present'); expect(status(pull,'review')).toBe('evidence present');expect(status(pull,'decision')).toBe('blocked');
 expect(status({...pull,evidence:{...pull.evidence!,reviews:[{userId:1,state:'APPROVED',commitId:'old-head'}]}},'review')).toBe('blocked');
});
test('rendered gates preserve revision, source, permissions and unavailable states without mutation controls',()=>{
 for(const state of [{loading:true,error:'',stale:false},{loading:false,error:'offline',stale:false},{loading:false,error:'',stale:true},{loading:false,error:'',stale:false}]) {
 const html=renderToStaticMarkup(<SafetyGates pull={pull} policy={policy} repository="adnanwahab/dear_congress" lastSync={null} {...state}/>);
 for(const value of ['current-head:main','base-sha','repository ID 123','signed out','Exact rule:','Responsible reviewer action:','https://github.com/adnanwahab/dear_congress/pull/7']) expect(html).toContain(value);
 expect(html.match(/<summary>/g)).toHaveLength(6); expect(html).not.toMatch(/<button|<input|<form/);
 }
 const html=renderToStaticMarkup(<AdvisorySafetyGate/>);expect(html).toContain('no repository PR');expect(html).not.toMatch(/<button|<input|<form/);
});

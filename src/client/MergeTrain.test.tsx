import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PublicPull } from '../shared/hbl-governance';
import { DEFAULT_POLICY } from '../server/hbl/policy';
import { MergeTrain, trainStops, type TrainSource } from './MergeTrain';
const policy = {...DEFAULT_POLICY, allowedBases:['main'], requiredChecks:['bun test']};
const fixture = (): PublicPull => ({number:605,repositoryId:123,title:'Fixture PR',body:'',author:'fixture',url:'https://github.com/adnanwahab/dear_congress/pull/605',updatedAt:'',headSha:'head',base:'main',draft:false,state:'open',version:'123:605:head:main',firstSeenAt:0,labels:[],tally:{yes:10,no:0,participation:10,feedback:0},eligibility:{eligible:false,state:'open-for-voting',reason:'Minimum exposure has not elapsed'},evidence:{baseSha:'base',checks:[{name:'bun test',sha:'head',status:'completed',conclusion:'success'}],reviews:[],requestedReviewers:0,mergeable:true,mergeableState:'clean',protectionsKnown:true,protectedBase:true,sensitive:false,maintainerApproved:false}});
const source:TrainSource = {repository:'adnanwahab/dear_congress',sourceStatus:'github',lastSync:'2026-11-15',stale:false,loading:false,error:'',policy,viewer:{authenticated:false,approved:false}};
test('blocked PR stops at red safety gates and retains source and revision', () => {
 const p=fixture(); p.labels=['do-not-merge']; p.evidence!.checks[0]!.conclusion='failure';
 const html=renderToStaticMarkup(<MergeTrain pull={p} source={source}/>);
 expect(trainStops(p,policy)[1]!.state).toBe('blocked');
 expect(html).toContain('Stopped at a safety gate'); expect(html).toContain('do-not-merge');
 expect(html).toContain('123:605:head:main'); expect(html).toContain('adnanwahab/dear_congress');
 expect(html).toContain('data-state="blocked"');
});
test('checks pending and old-revision receipts never report success', () => {
 const p=fixture(); p.evidence!.checks[0]!.status='in_progress';p.evidence!.checks[0]!.conclusion=null;
 expect(trainStops(p,policy)[1]!.state).toBe('pending');
 p.evidence!.checks[0] = {name:'bun test',sha:'old-head',status:'completed',conclusion:'success'};
 expect(trainStops(p,policy)[1]!.state).toBe('pending');
 p.evidence!.reviews=[{userId:1,state:'APPROVED',commitId:'old-head'}];
 expect(trainStops(p,policy)[2]!.state).toBe('pending');
});
test('review-ready PR exposes successful checks, pending review and unknown queue', () => {
 const p=fixture(); const stops=trainStops(p,policy);
 expect(stops[1]!.state).toBe('reported');expect(stops[2]!.state).toBe('pending');expect(stops[3]!.state).toBe('unknown');
 p.evidence!.reviews=[{userId:1,state:'APPROVED',commitId:'head'}];
 expect(trainStops(p,policy)[2]!.state).toBe('reported');
 const html=renderToStaticMarkup(<MergeTrain pull={p} source={source}/>);
 expect(html).toContain('human merge decision required');expect(html).not.toContain('<button');expect(html).toContain('<details>');
 expect(html).toContain('Queue membership and position are unknown');
});
test('missing evidence, source errors and permissions are explicit; issues and foreign URLs excluded', () => {
 const p=fixture();delete p.evidence;
 const html=renderToStaticMarkup(<MergeTrain pull={p} source={{...source,loading:true,stale:true,error:'Access denied'}}/>);
 for(const text of ['Loading source','Stale cached evidence','Access denied','sign-in required','Not fetched'])expect(html).toContain(text);
 expect(trainStops(p,policy)[1]!.state).toBe('unknown');
 p.url='https://github.com/other/repo/pull/605';expect(renderToStaticMarkup(<MergeTrain pull={p} source={source}/>)).not.toContain('href=');
 p.kind='issue';expect(renderToStaticMarkup(<MergeTrain pull={p} source={source}/>)).toBe('');
});

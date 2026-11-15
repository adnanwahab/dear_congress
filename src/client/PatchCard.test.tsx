import { test,expect } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PatchCard,reviewStatus } from './PatchCard';
import type { PublicPull } from '../shared/hbl-governance';
const pull:PublicPull={number:7,repositoryId:12,title:'Source',url:'https://github.com/adnanwahab/dear_congress/pull/7',body:'',author:'fixture',updatedAt:'',headSha:'head',base:'main',version:'12:7:head:main',draft:false,state:'open',firstSeenAt:0,labels:[],tally:{yes:0,no:0,participation:0,feedback:0},eligibility:{eligible:false,state:'open-for-voting',reason:'Advisory'},evidence:{checks:[{name:'test',status:'completed',conclusion:'success',sha:'head'}],reviews:[],requestedReviewers:0,mergeable:true,mergeableState:'clean',baseSha:'base-sha',protectionsKnown:true,protectedBase:true,sensitive:false,maintainerApproved:false}};
test('blocked, checks pending and review-ready PRs retain distinct conservative states',()=>{
 expect(reviewStatus({...pull,eligibility:{eligible:false,state:'blocked',reason:'Base blocked'}})).toContain('Blocked');
 expect(reviewStatus({...pull,evidence:{...pull.evidence!,checks:[{name:'test',status:'in_progress',conclusion:null,sha:'head'}]}})).toContain('pending');
 expect(reviewStatus(pull)).toContain('human review required');
 expect(reviewStatus({...pull,evidence:{...pull.evidence!,checks:[{name:'test',status:'completed',conclusion:'success',sha:'old'}]}})).toContain('unverified');
 expect(reviewStatus({...pull,evidence:undefined})).toContain('unverified');
});
test('card exposes source identity, unavailable summary, native keyboard control and no vote actions',()=>{
 const html=renderToStaticMarkup(<PatchCard pull={pull} api="/api/hbl/repos/dear_congress/pulls" repository="adnanwahab/dear_congress" sourceNote="Stale cached source"><p>Overview</p></PatchCard>);
 for(const value of ['12:7:head:main','repository ID 12','Stale cached source','not fetched','aria-expanded="false"','aria-controls=','Flip to source diff','Viewing or flipping is not a vote','/pull/7/files'])expect(html).toContain(value);
 expect(html).not.toContain('onVote');
});
test('source patches are escaped plain text and missing binary patches explicit',()=>{
 const html=renderToStaticMarkup(<PatchCard pull={{...pull,files:[{filename:'src/a.ts',status:'modified',additions:2,deletions:1,patch:'+ <script>bad()</script>'},{filename:'binary.png',status:'added',additions:0,deletions:0}]}} api="/api/hbl/repos/dear_congress/pulls" repository="adnanwahab/dear_congress" sourceNote="GitHub"><p>Overview</p></PatchCard>);
 expect(html).toContain('2 changed files · +2 −1');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');expect(html).toContain('binary, omitted or truncated');expect(html).toContain('aria-label="Changed files"');expect(html).toContain('tabindex="0"');
});
test('flips fetch read-only source, handle permission and reject stale revisions',async()=>{
 const child=Bun.spawn([process.execPath,'scripts/verify-patch-card-ui.tsx'],{stdout:'pipe',stderr:'pipe'});
 const [code,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
 expect({code,stderr}).toEqual({code:0,stderr:''});expect(stdout).toContain('PASS read-only flips');
});

import { test, expect } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PatchStory, storySteps, storyStatus } from './PatchStory';
import type { PublicPull } from '../shared/hbl-governance';
const sha='a'.repeat(40), base='b'.repeat(40);
function fixture():PublicPull{return {number:7,repositoryId:42,url:'https://github.com/adnanwahab/dear_congress/pull/7',title:'Change',body:'',author:'fixture',updatedAt:'',headSha:sha,base:'main',draft:false,state:'open',version:`42:7:${sha}:main`,firstSeenAt:0,labels:[],tally:{yes:0,no:0,participation:0,feedback:0},eligibility:{eligible:false,state:'open-for-voting',reason:'Human review required'},evidence:{checks:[{name:'test',status:'completed',conclusion:'success',sha}],reviews:[],requestedReviewers:0,mergeable:true,mergeableState:'clean',baseSha:base,protectionsKnown:true,protectedBase:true,sensitive:false,maintainerApproved:false},files:[{filename:'src/a.ts',status:'modified',additions:2,deletions:2,patch:'@@ -1 +1 @@\n-old behavior\n+new behavior\n@@ -8 +9 @@\n-second old\n+second new'}]};}
test('blocked, checks-pending and review-ready PR stories preserve authority and receipts',()=>{
 const p=fixture();expect(storyStatus(p)).toBe('review-ready');
 p.eligibility.state='waiting-for-checks';expect(storyStatus(p)).toBe('checks-pending');
 p.eligibility.state='blocked';expect(storyStatus(p)).toBe('blocked');
 const html=renderToStaticMarkup(<PatchStory pull={p}/>);expect(html).toContain('Story: blocked');expect(html).toContain('requires human review');expect(html).toContain('does not cast a vote');expect(html).toContain(base);expect(html).toContain(sha);expect(html).not.toContain('<button');
});
test('hunks stay ordered and bind exact head and base source lines',()=>{
 const p=fixture(), snapshot=JSON.stringify(p);const steps=storySteps(p);expect(steps.map(s=>s.before)).toEqual(['old behavior','second old']);expect(steps[1]?.newLine).toBe(9);
 const html=renderToStaticMarkup(<PatchStory pull={p}/>);expect(html).toContain(`/blob/${base}/src/a.ts#L8`);expect(html).toContain(`/blob/${sha}/src/a.ts#L9`);expect(html).toContain('<details>');expect(JSON.stringify(p)).toBe(snapshot);
});
test('loading, errors, missing diffs, issues and source mismatch fail explicitly',()=>{
 const p=fixture();expect(storyStatus(p,true)).toBe('loading');expect(storyStatus(p,false,'Denied')).toBe('error');p.files=undefined;expect(renderToStaticMarkup(<PatchStory pull={p} error="Denied"/>)).toContain('Diff hunks unavailable');
 expect(renderToStaticMarkup(<PatchStory pull={{...p,kind:'issue'}}/>)).toBe('');p.url='https://evil.test/pull/7';expect(renderToStaticMarkup(<PatchStory pull={p}/>)).toContain('Unverified source');
});
test('stale previews and unrelated attachments cannot masquerade as before/after receipts',()=>{
 const p=fixture();p.preview={headSha:'c'.repeat(40),route:'/',screenshotUrl:'/stale.png',capturedAt:''};p.body=`![Other](https://github.com/adnanwahab/dear_congress/blob/${'d'.repeat(40)}/other.png)`;
 const html=renderToStaticMarkup(<PatchStory pull={p}/>);expect(html).not.toContain('/stale.png');expect(html).not.toContain('other.png');expect(html).toContain('Before screenshot pending');expect(html).toContain('After screenshot pending');p.evidence!.checks[0]!.sha=base;expect(storyStatus(p)).toBe('checks-pending');
});

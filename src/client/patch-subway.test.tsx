import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PatchSubway } from './PatchSubway';
import { patchRelationships } from '../shared/patch-relationships';
import type { PublicPull } from '../shared/hbl-governance';
const repo='adnanwahab/dear_congress';
const pull:PublicPull={number:7,repositoryId:123,title:'Civic feature',body:'',author:'a',url:`https://github.com/${repo}/pull/7`,updatedAt:'',headSha:'a'.repeat(40),base:'main',draft:false,state:'open',version:'123:7:head:main',firstSeenAt:0,labels:[],tally:{yes:3,no:1,participation:4,feedback:0},eligibility:{eligible:false,state:'blocked',reason:'Protected base evidence missing'}};
for(const [state,label] of [['blocked','blocked'],['waiting-for-checks','checks-pending'],['approved','review-ready']] as const)test(`${label} stays explicit without granting merge authority`,()=>{
 const p={...pull,eligibility:{...pull.eligibility,state}};
 const before=JSON.stringify(p);
 expect(patchRelationships(p,repo).status).toBe(label);
 const html=renderToStaticMarkup(<PatchSubway pulls={[p]} repository={repo} loading={false} error="" stale={false} sourceStatus="current" permission="Public read access"/>);
 expect(html).toContain(label);expect(html).toContain('human maintainer');expect(html).toContain('<table>');expect(html).toContain(p.version);
 expect(html).not.toContain('<button');expect(JSON.stringify(p)).toBe(before);
});
test('only explicit description links and parent metadata create edges; fork identity survives',()=>{
 const p={...pull,links:['https://linear.app/team/issue/SHE-607/feature','javascript:alert(1)','https://github.com.evil/x/y/pull/1','https://github.com/other/repo/issues/7'],branchSource:{headRepository:'contributor/fork',headRef:'feature',commits:[{sha:'a'.repeat(40),parents:['b'.repeat(40)]}]}};
 const graph=patchRelationships(p,repo);
 expect(graph.nodes.some(n=>n.label==='SHE-607')).toBe(true);
 expect(graph.nodes.some(n=>n.url?.includes('contributor/fork/tree/feature'))).toBe(true);
 expect(graph.edges.filter(e=>e.label==='GitHub parent → child')).toHaveLength(1);
 expect(graph.nodes.some(n=>n.url?.includes('evil'))).toBe(false);
 expect(graph.nodes.some(n=>n.label==='other/repo/issues/7')).toBe(true);
 expect(graph.edges.some(e=>e.label==='targets (not ancestry)')).toBe(true);
 expect(patchRelationships({...pull,kind:'issue'},repo).nodes).toHaveLength(1);
 expect(patchRelationships({...pull,repositoryId:456},repo).nodes[0]!.id).not.toBe(graph.nodes[0]!.id);
});
test('loading, denied refresh and stale states remain visible alongside cached relationships',()=>{
 const html=renderToStaticMarkup(<PatchSubway pulls={[pull]} repository={repo} loading error="Access denied" stale sourceStatus="credentials" permission="Roster approval required"/>);
 for(const text of ['Loading relationship metadata','Access denied','stale cached metadata','Roster approval required','Commit ancestry unavailable'])expect(html).toContain(text);
 expect(html).toContain('tabindex="0"');expect(html).toContain('scope="col"');
});
test('search synchronizes map and table, focus works and browsing issues no requests',async()=>{
 const child=Bun.spawn([process.execPath,'scripts/verify-patch-subway.tsx'],{stdout:'pipe',stderr:'pipe'});
 const [code,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
 expect({code,stderr}).toEqual({code:0,stderr:''});expect(stdout).toContain('PASS search synchronizes');
});

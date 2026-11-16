import {expect,test} from 'bun:test';
import {GitHubSource,GitHubError} from './github';
test('lists all 101 open pulls without filtering authors drafts or bases',async()=>{
  const paths:string[]=[];
  const source=new GitHubSource({token:'secret',fetch:(async(input)=>{
    const u=new URL(String(input)); paths.push(u.pathname+u.search);
    if(u.pathname.endsWith('/happybearlandia')) return Response.json({id:1364565814,full_name:'adnanwahab/happybearlandia'});
    const page=Number(u.searchParams.get('page')); return Response.json(Array.from({length:page===1?100:1},(_,i)=>({number:(page-1)*100+i+1,title:'p',head:{sha:'sha'},base:{ref:i%2?'other':'main',repo:{id:1364565814,full_name:'adnanwahab/happybearlandia'}},user:{login:'any-author'},draft:i%2===0,state:'open',labels:[]})));
  }) as typeof fetch});
  const pulls=await source.listPulls(); expect(pulls.length).toBe(101); expect(pulls.some(p=>p.draft)).toBe(true); expect(pulls.some(p=>p.base==='other')).toBe(true); expect(paths.length).toBe(3);
});
test('missing credentials and rate limit errors are sanitized',async()=>{
  await expect(new GitHubSource({}).merge(1,'sha')).rejects.toBeInstanceOf(GitHubError);
  const source=new GitHubSource({token:'super-secret',fetch:(async()=>new Response('super-secret',{status:429})) as unknown as typeof fetch});
  try { await source.listPulls(); } catch(e) { expect(String(e)).toBe('Error: GitHub source rate-limit'); }
});

test('diagnostics retain check receipts when protection read permission is denied',async()=>{
 let denied=true;
 const source=new GitHubSource({fetch:(async input=>{
  const path=new URL(String(input)).pathname;
  if(path.endsWith('/happybearlandia'))return Response.json({id:1364565814,full_name:'adnanwahab/happybearlandia'});
  if(path.endsWith('/pulls/7'))return Response.json({number:7,title:'patch',head:{sha:'head'},base:{ref:'main',sha:'base',repo:{id:1364565814,full_name:'adnanwahab/happybearlandia'}},state:'open'});
  if(path.endsWith('/protection'))return denied?new Response('',{status:403}):Response.json({required_status_checks:{strict:true,contexts:['bun test','route smoke test']},required_pull_request_reviews:{required_approving_review_count:1}});
  if(path.endsWith('/check-runs'))return Response.json({check_runs:[{name:'bun test',status:'in_progress',conclusion:null,head_sha:'head'}]});
  return Response.json([]);
 }) as typeof fetch});
 const pull=await source.detail(7);expect(pull.evidence!.checks[0]?.name).toBe('bun test');expect(pull.evidence!.protectionsKnown).toBe(false);expect(pull.evidence!.receipt).toMatchObject({status:'unavailable',permission:'denied'});
 denied=false;const complete=await source.detail(7);expect(complete.evidence!.receipt).toMatchObject({status:'complete',permission:'readable',strict:true,requiredApprovals:1,requiredChecks:['bun test','route smoke test']});expect(complete.evidence!.checks.find(c=>c.name==='route smoke test')?.status).toBe('unknown');
});
test('read-only PR metadata retains fork identity and GitHub commit parents without changing revision binding',async()=>{
 const sha='a'.repeat(40),parent='b'.repeat(40);
 const methods:string[]=[];
 const source=new GitHubSource({repoKey:'dear_congress',fetch:(async(input,init)=>{
  methods.push(init?.method??'GET');
  const path=new URL(String(input)).pathname;
  if(path.endsWith('/dear_congress'))return Response.json({id:123,full_name:'adnanwahab/dear_congress'});
  if(path.endsWith('/pulls/7'))return Response.json({number:7,title:'Feature',head:{sha,ref:'feature',repo:{full_name:'contributor/fork'}},base:{sha:parent,ref:'main',repo:{id:123,full_name:'adnanwahab/dear_congress'}},state:'open'});
  if(path.endsWith('/protection'))return Response.json({required_status_checks:{strict:true}});
  if(path.endsWith('/commits'))return Response.json([{sha,parents:[{sha:parent}]}]);
  if(path.endsWith('/check-runs'))return Response.json({check_runs:[]});
  return Response.json([]);
 }) as typeof fetch});
 const p=await source.detail(7);
 expect(p.branchSource).toEqual({headRepository:'contributor/fork',headRef:'feature',commits:[{sha,parents:[parent]}]});
 expect(p.version).toBe(`123:7:${sha}:main`);
 expect(methods.every(m=>m==='GET')).toBe(true);
});

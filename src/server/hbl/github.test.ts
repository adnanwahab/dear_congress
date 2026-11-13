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

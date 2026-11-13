import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { REPOSITORIES, type RepoKey, type ItemKind } from '../../shared/repository-voting';
import type { Pull } from '../../shared/hbl-governance';
import { GovernanceStore } from './store';
import { GitHubSource, PartialGitHubError } from './github';
import { createGovernanceAPI, handleHblGovernance } from './api';
import { createOutbox } from './outbox';
import { DEFAULT_POLICY, evaluateEligibility } from './policy';
const origin='https://vote.test';
const item=(repo:RepoKey,kind:ItemKind):Pull=>({kind,number:7,repositoryId:1,title:'<script>fixture</script>',body:'priority fixture',author:'author',url:`https://github.com/${REPOSITORIES[repo].repository}/${kind==='issue'?'issues':'pull'}/7`,updatedAt:new Date().toISOString(),headSha:kind==='pr'?'a'.repeat(40):'',base:kind==='pr'?'pilot':'',draft:kind==='pr',state:'open',version:kind==='pr'?'sha-v1':'issue-7',firstSeenAt:1,labels:[]});
const session=(store:GovernanceStore,id:number)=>{const token='session-'+id;store.db.query('INSERT OR REPLACE INTO sessions VALUES(?,?,?,?)').run(createHash('sha256').update(token).digest('hex'),id,'csrf',Date.now()+600000);return {origin,cookie:'hbl_session='+token,'x-csrf-token':'csrf','Content-Type':'application/json'};};
test('six scopes share one 100-person roster but isolate votes, feedback, jobs and restart state',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'repository-voting-')),path=join(dir,'voting.sqlite'),stores:GovernanceStore[]=[];
 try{
  const scopes=Object.keys(REPOSITORIES).flatMap(key=>(['pr','issue'] as const).map(kind=>({key:key as RepoKey,kind})));
  for(const scope of scopes)stores.push(new GovernanceStore(path,scope.key,scope.kind));
  for(let id=1;id<=100;id++)stores[0]!.setMembership(id,'Participant '+id,true,1);
  expect(()=>stores[5]!.setMembership(101,'One more',true,1)).toThrow('roster_full');
  for(const [index,store] of stores.entries()){
   const p=item(store.repoKey,store.kind),api=createGovernanceAPI({store,source:{listPulls:async()=>[p],detail:async()=>p,merge:async()=>{throw Error('never');}},policy:{...DEFAULT_POLICY,enabled:true,dryRun:false},origin});
   store.upsertPull(p,1);
   const votes=await Promise.all(Array.from({length:100},(_,i)=>api.handle(new Request(origin+'/api/hbl/pulls/7/ballot',{method:'PUT',headers:session(store,i+1),body:JSON.stringify({version:p.version,choice:index%2?'no':'yes'})}))));
   expect(votes.every(r=>r.status===200)).toBe(true);
   expect(store.tally(7,p.version)).toMatchObject({participation:100,yes:index%2?0:100,no:index%2?100:0});
   store.vote(1,7,p.version,index%2?'yes':'no',Date.now()+1);expect(store.tally(7,p.version).participation).toBe(100);
   store.createFeedback(1,7,p.version,'Scope '+index,true,'same-request-key',2);
   expect(store.feedback(7)).toHaveLength(1);expect(store.db.query('SELECT COUNT(*) n FROM outbox').get()).toEqual({n:1});
   expect((await api.handle(new Request(origin+'/api/hbl/pulls/7/ballot',{method:'PUT',headers:{...session(store,1),'x-csrf-token':'bad'},body:'{}'}))).status).toBe(403);
   const list=await(await api.handle(new Request(origin+'/api/hbl/pulls'))).json();expect(list.repository).toBe(REPOSITORIES[store.repoKey].repository);
   if(store.kind==='issue'||store.repoKey!=='happybearlandia')expect(list.policy.enabled).toBe(false);
  }
  for(const store of stores)store.db.close();stores.length=0;
  for(const scope of scopes){const store=new GovernanceStore(path,scope.key,scope.kind);stores.push(store);expect(store.feedback(7)).toHaveLength(1);expect(store.tally(7,item(scope.key,scope.kind).version).participation).toBe(100);}
 }finally{for(const store of stores)store.db.close();rmSync(dir,{recursive:true,force:true});}
});
function githubFixture(repo:RepoKey,kind:ItemKind,failPage2=false){
 const calls:string[]=[],repository=REPOSITORIES[repo].repository,id=repo==='happybearlandia'?1364565814:repo==='dear_congress'?21:22;
 const raw=(n:number)=>({number:n,title:'Item '+n,body:'https://linear.app/team/issue/SHE-1',html_url:`https://github.com/${repository}/${kind==='issue'?'issues':'pull'}/${n}`,updated_at:'2026-11-12T00:00:00Z',user:{login:'author'},state:'open',labels:[{name:'feature'}],draft:true,head:{sha:'a'.repeat(40)},base:{ref:'pilot',sha:'b'.repeat(40),repo:{id,full_name:repository}}});
 const request=async(input:any)=>{const url=new URL(String(input));calls.push(url.href);expect(url.pathname.startsWith('/repos/'+repository)).toBe(true);if(url.pathname==='/repos/'+repository)return Response.json({id,full_name:repository});if(url.searchParams.get('page')==='2')return failPage2?new Response('',{status:429}):Response.json([raw(101)]);if(url.searchParams.has('page'))return Response.json(Array.from({length:100},(_,i)=>kind==='issue'&&i===3?{...raw(i+1),pull_request:{url:'pr'}}:raw(i+1)));return Response.json(raw(7));};
 return {source:new GitHubSource({repoKey:repo,kind,fetch:request as typeof fetch}),calls};
}
test('all repositories page PRs and issues; drafts included, PRs excluded from issues',async()=>{
 for(const repo of Object.keys(REPOSITORIES) as RepoKey[])for(const kind of ['pr','issue'] as ItemKind[]){const {source,calls}=githubFixture(repo,kind);const rows=await source.listPulls();expect(rows).toHaveLength(kind==='issue'?100:101);expect(rows[0]!.draft).toBe(kind==='pr');expect(calls.some(c=>c.includes('page=2'))).toBe(true);if(kind==='issue'){expect(rows.some(p=>p.number===4)).toBe(false);expect((await source.detail(7)).kind).toBe('issue');await expect(source.merge(7,'sha')).rejects.toThrow();}}
});
test('partial page reports incomplete results and preserves cached items instead of closing them',async()=>{
 const {source}=githubFixture('dear_congress','issue',true),store=new GovernanceStore(':memory:','dear_congress','issue');
 try{await expect(source.listPulls()).rejects.toBeInstanceOf(PartialGitHubError);const cached={...item('dear_congress','issue'),number:999};store.upsertPull(cached,1);
 const api=createGovernanceAPI({store,source,origin,policy:DEFAULT_POLICY});const response=await api.handle(new Request(origin+'/api/hbl/pulls')),body=await response.json();expect(response.status).toBe(200);expect(body.sourceStatus).toBe('partial');expect(body.stale).toBe(true);expect(body.warning).toContain('incomplete');expect(store.getPull(999)!.state).toBe('open');expect(body.pulls).toHaveLength(100);
 }finally{store.db.close();}
});
test('invalid repository reads and writes rejected before initialization',async()=>{
 for(const method of ['GET','POST','PUT'])expect((await handleHblGovernance(new Request(origin+'/api/hbl/repos/__proto__/issues/7/ballot',{method}))).status).toBe(404);
});
test('issues never become merge candidates under otherwise enabled policy',()=>expect(evaluateEligibility(item('happybearlandia','issue'),{yes:100,no:0,participation:100,feedback:0},{...DEFAULT_POLICY,enabled:true,allowedBases:['']})).toMatchObject({eligible:false,reason:'Issues are never merge candidates'}));
test('scoped public feedback retries reconcile exact selected-repository comment without duplicate publication',async()=>{
 for(const repo of Object.keys(REPOSITORIES) as RepoKey[])for(const kind of ['pr','issue'] as ItemKind[]){
  const store=new GovernanceStore(':memory:',repo,kind),p=item(repo,kind);let now=100,posts=0,lost=true,comment:any=null;
  try{store.setMembership(1,'Public Alias',true,1);store.upsertPull(p,1);store.createFeedback(1,7,p.version,'Please prioritize this.',true,'same',2);
   const request=async(input:any,init?:RequestInit)=>{const url=new URL(String(input));expect(url.pathname.startsWith('/repos/'+REPOSITORIES[repo].repository+'/issues/7/comments')).toBe(true);if(init?.method==='POST'){posts++;const body=JSON.parse(String(init.body)).body;expect(body).not.toContain('session-');comment={id:9,html_url:p.url+'#issuecomment-9',body,user:{id:5,type:'Bot'}};if(lost){lost=false;throw Error('response lost');}return Response.json(comment);}return Response.json(comment?[comment]:[]);};
   const outbox=createOutbox(store,{repoKey:repo,kind,publish:true,token:'fixture',botId:5,now:()=>now,fetch:request as typeof fetch});
   await outbox.drain();expect(store.feedback(7)[0]!.commentStatus).toBe('failed');now+=60000;await outbox.drain();expect(posts).toBe(1);expect(store.feedback(7)[0]!.commentStatus).toBe('posted');expect(store.feedback(7)[0]!.commentUrl).toBe(p.url+'#issuecomment-9');
  }finally{store.db.close();}
 }
});
test('normal public router selects all six sources and preserves authenticated write bodies',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'repository-router-')),path=join(dir,'db.sqlite');
 const saved={fetch:globalThis.fetch,path:process.env.HBL_DB_PATH,node:process.env.NODE_ENV,publish:process.env.HBL_PUBLISH_FEEDBACK,summaries:process.env.HBL_PUBLISH_VOTE_SUMMARIES,origin:process.env.HBL_PUBLIC_ORIGIN};
 process.env.HBL_DB_PATH=path;process.env.NODE_ENV='test';process.env.HBL_PUBLISH_FEEDBACK='0';process.env.HBL_PUBLISH_VOTE_SUMMARIES='0';process.env.HBL_PUBLIC_ORIGIN=origin;
 globalThis.fetch=(async(input:any)=>{
  const url=new URL(String(input)),repo=url.pathname.split('/')[3]!,repository='adnanwahab/'+repo,id=repo==='happybearlandia'?1364565814:repo==='dear_congress'?21:22;
  const raw={number:7,title:repo,body:'fixture',html_url:`https://github.com/${repository}/pull/7`,updated_at:'2026-11-12T00:00:00Z',user:{login:'fixture'},state:'open',labels:[],head:{sha:'a'.repeat(40)},base:{ref:'pilot',sha:'b'.repeat(40),repo:{id,full_name:repository}},changed_files:0};
  if(url.pathname==='/repos/'+repository)return Response.json({id,full_name:repository});
  if(url.pathname.endsWith('/files')||url.pathname.includes('/commits/')||url.pathname.endsWith('/reviews')||url.pathname.endsWith('/commits'))return Response.json([]);
  if(url.searchParams.has('page'))return Response.json([raw]);
  return Response.json(raw);
 }) as typeof fetch;
 try{
  for(const repo of Object.keys(REPOSITORIES) as RepoKey[])for(const kind of ['pr','issue'] as ItemKind[]){
   const api='/api/hbl/repos/'+repo+'/'+(kind==='pr'?'pulls':'issues');
   const response=await handleHblGovernance(new Request(origin+api)),list=await response.json();expect(response.status).toBe(200);expect(list.repository).toBe(REPOSITORIES[repo].repository);expect(list.kind).toBe(kind);
   const store=new GovernanceStore(path,repo,kind);try{if(!store.member(1))store.setMembership(1,'Router fixture',true,1);const headers=session(store,1),version=list.pulls[0].version;
    const observed:import('../launch-stats').VoteActivity[]=[];
    const vote=await handleHblGovernance(new Request(origin+api+'/7/ballot',{method:'PUT',headers,body:JSON.stringify({version,choice:'yes'})}),activity=>observed.push(activity));expect(vote.status).toBe(200);expect(store.tally(7,version).yes).toBe(1);
    expect(observed).toEqual([{identity:'github:1',scope:repo+'/'+kind+'/verified',target:JSON.stringify([7,version])}]);
   }finally{store.db.close();}
  }
 }finally{
  globalThis.fetch=saved.fetch;
  for(const [key,value] of Object.entries({HBL_DB_PATH:saved.path,NODE_ENV:saved.node,HBL_PUBLISH_FEEDBACK:saved.publish,HBL_PUBLISH_VOTE_SUMMARIES:saved.summaries,HBL_PUBLIC_ORIGIN:saved.origin}))if(value===undefined)delete process.env[key];else process.env[key]=value;
  rmSync(dir,{recursive:true,force:true});
 }
});

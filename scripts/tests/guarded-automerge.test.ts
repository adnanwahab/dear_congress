import {test, expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const workflow=readFileSync(new URL('../../.github/workflows/guarded-automerge.yml',import.meta.url),'utf8');
const source=workflow.match(/node <<'NODE'\n([\s\S]*?)\n          NODE/)?.[1].replace(/^          /gm,'');
if(!source)throw Error('Guarded merge script missing');
const pure=source.match(/\/\/ BEGIN PURE APPROVAL POLICY[^\n]*\n([\s\S]*?)\/\/ END PURE APPROVAL POLICY/)?.[1];
if(!pure)throw Error('Guarded merge policy missing');
const policy=vm.runInNewContext(pure+';({approvalEligibility,confirmedMerge,outcomeSummary})');
const sha='a'.repeat(40),old='b'.repeat(40),repo='adnanwahab/dear_congress';
const review=(extra:Record<string,unknown>={})=>({id:1,user:{login:'maintainer',type:'User'},state:'APPROVED',commit_id:sha,submitted_at:'2026-11-17T12:00:00Z',...extra});
const evidence=(extra:Record<string,unknown>={})=>({sha,decisionHead:sha,author:'pr-author',reviewDecision:'APPROVED',reviews:[review()],permissions:{maintainer:{user:{login:'maintainer'},permission:'write'}},...extra});

test('requires positive current-head approval from a human maintainer with verified permissions',()=>{
 expect(policy.approvalEligibility(evidence()).eligible).toBe(true);
 for(const decision of [null,undefined,'','REVIEW_REQUIRED','CHANGES_REQUESTED'])expect(policy.approvalEligibility(evidence({reviewDecision:decision})).eligible).toBe(false);
 for(const permission of ['read','triage',null,undefined])expect(policy.approvalEligibility(evidence({permissions:{maintainer:{user:{login:'maintainer'},permission}}})).eligible).toBe(false);
 for(const permission of ['write','maintain','admin'])expect(policy.approvalEligibility(evidence({permissions:{maintainer:{user:{login:'maintainer'},permission}}})).eligible).toBe(true);
 expect(policy.approvalEligibility(evidence({permissions:{}})).eligible).toBe(false);
 expect(policy.approvalEligibility(evidence({permissions:{maintainer:{user:{login:'someone-else'},permission:'admin'}}})).eligible).toBe(false);
});
test('stale, self, bot, changed-head and incomplete review evidence fails closed',()=>{
 for(const extra of [
  {reviews:[]},{reviews:[review({commit_id:old})]},{author:'maintainer'},
  {reviews:[review({user:{login:'maintainer',type:'Bot'}})]},
  {reviews:[review({user:{login:'maintainer[bot]',type:'User'}})]},
  {decisionHead:old},{sha:old},{reviews:null},{permissions:null},
  {reviews:[review({submitted_at:null})]},{reviews:[review({commit_id:null})]},
  {reviews:[review({user:{login:'maintainer'}})]},{reviews:[review({state:'UNKNOWN'})]},
 ])expect(policy.approvalEligibility(evidence(extra)).eligible).toBe(false);
});
test('outstanding changes block, comments do not erase them, and dismissed approvals do not count',()=>{
 const changed=review({id:2,state:'CHANGES_REQUESTED',commit_id:old,submitted_at:'2026-11-17T12:01:00Z'});
 const comment=review({id:3,state:'COMMENTED',submitted_at:'2026-11-17T12:02:00Z'});
 expect(policy.approvalEligibility(evidence({reviews:[review(),changed,comment]})).eligible).toBe(false);
 const approved=review({id:4,submitted_at:'2026-11-17T12:03:00Z'});
 expect(policy.approvalEligibility(evidence({reviews:[changed,approved,comment]})).eligible).toBe(true);
 expect(policy.approvalEligibility(evidence({reviews:[review(),review({id:5,state:'DISMISSED',submitted_at:'2026-11-17T12:04:00Z'})]})).eligible).toBe(false);
 const other=review({id:6,user:{login:'other',type:'User'},state:'CHANGES_REQUESTED'});
 expect(policy.approvalEligibility(evidence({reviews:[approved,other]})).eligible).toBe(false);
});

type AuditOptions={decision?:string|null; reviews?:unknown; permission?:unknown; currentHead?:string; file?:string; merged?:unknown; finalReviews?:unknown; checks?:unknown; protected?:unknown; finalProtected?:unknown};
function audit(options:AuditOptions={}){
 const commands:string[][]=[],logs:string[]=[],summary:string[]=[];let pulls=0,reviewReads=0,protectionReads=0;
 const pull=()=>({number:7,state:'open',draft:false,base:{ref:'main'},head:{sha:++pulls===1?sha:options.currentHead??sha,repo:{full_name:repo}},user:{login:'pr-author'},labels:[],mergeable:true,mergeable_state:'clean',requested_reviewers:[],requested_teams:[]});
 const execFileSync=(_command:string,args:string[])=>{
  commands.push(args);
  if(args[0]==='pr')return JSON.stringify({reviewDecision:Object.hasOwn(options,'decision')?options.decision:'APPROVED',headRefOid:sha});
  if(args.includes('--slurp')){reviewReads++;return JSON.stringify(reviewReads>1&&Object.hasOwn(options,'finalReviews')?options.finalReviews:Object.hasOwn(options,'reviews')?options.reviews:[[review()]]);}
  if(args.includes('--jq'))return options.file??'src/client/example.tsx';
  if(args.includes('PUT'))return JSON.stringify(Object.hasOwn(options,'merged')?options.merged:{merged:true,sha});
  const path=args[1]??'';
  if(path.endsWith('/branches/main')){protectionReads++;const value=protectionReads>1&&Object.hasOwn(options,'finalProtected')?options.finalProtected:Object.hasOwn(options,'protected')?options.protected:true;if(value==='unread')throw Error('Unavailable branch metadata');return JSON.stringify({name:'main',protected:value});}
  if(path.endsWith('/permission'))return JSON.stringify(Object.hasOwn(options,'permission')?options.permission:{permission:'write',user:{login:'maintainer'}});
  if(path.includes('/pulls/'))return JSON.stringify(pull());
  if(path.includes('/check-runs'))return JSON.stringify(options.checks??{total_count:3,check_runs:['bun test','bun run typecheck','route smoke test'].map(name=>({name,head_sha:sha,app:{slug:'github-actions'},status:'completed',conclusion:'success'}))});
  if(path.endsWith('/status'))return JSON.stringify({sha,total_count:0,statuses:[],state:'pending'});
  throw Error('Unexpected command: '+args.join(' '));
 };
 const process={env:{GH_REPO:repo,EVENT_PR:'7',GITHUB_STEP_SUMMARY:'summary'},exitCode:0};
 vm.runInNewContext(source!,{require:(name:string)=>name==='node:child_process'?{execFileSync}:{appendFileSync:(_path:string,text:string)=>summary.push(text)},process,console:{log:(message:string)=>logs.push(message),error:(message:string)=>logs.push(message)}});
 return{commands,logs,summary:summary.join(''),exitCode:process.exitCode,write:commands.some(args=>args.includes('PUT')),result:JSON.parse(logs.findLast(line=>line.startsWith('{'))!)};
}
test('green checks without explicit human approval audit successfully but merge zero PRs',()=>{
 const result=audit({decision:null});expect(result.write).toBe(false);expect(result.result).toEqual({audit:'succeeded',audited:1,skipped:1,merged:0,errors:0,outcome:'no_merge'});expect(result.summary).toContain('No PR was merged');
});
test('workflow blocks stale/bot/nonmaintainer/malformed approvals and changed heads',()=>{
 for(const options of [
  {reviews:[[review({commit_id:old})]]},{reviews:[[review({user:{login:'maintainer',type:'Bot'}})]]},
  {permission:{permission:'read',user:{login:'maintainer'}}},{permission:null},{reviews:{}},
  {protected:false},{protected:null},{protected:'unread'},{finalProtected:false},{finalProtected:'unread'},
  {currentHead:old},{finalReviews:[[review({state:'CHANGES_REQUESTED'})]]},
 ])expect(audit(options).write).toBe(false);
});
test('sensitive paths and incomplete/wrong-head checks remain blocked',()=>{
 for(const file of ['.github/workflows/x.yml','fly.toml','Dockerfile','package.json','bun.lock','.env','src/server/auth/auth.ts','src/server/identity/identity.ts','src/server/public-security.ts','docs/reviews/a.md'])expect(audit({file}).write).toBe(false);
 expect(audit({checks:{total_count:4,check_runs:[]}}).write).toBe(false);
 expect(audit({checks:{total_count:3,check_runs:['bun test','bun run typecheck','route smoke test'].map(name=>({name,head_sha:old,app:{slug:'github-actions'},status:'completed',conclusion:'success'}))}}).write).toBe(false);
});
test('merge has exact SHA fence and only GitHub confirmation yields a merged outcome',()=>{
 const result=audit();expect(result.write).toBe(true);expect(result.commands.find(args=>args.includes('PUT'))).toContain('sha='+sha);expect(result.result.merged).toBe(1);expect(result.result.outcome).toBe('merged');expect(result.summary).toContain('GitHub confirmed a merge');
 for(const merged of [{merged:false},{merged:'true',sha},{merged:true}]){const blocked=audit({merged});expect(blocked.result.merged).toBe(0);expect(blocked.exitCode).toBe(1);}
 expect(workflow).not.toMatch(/uses:\s*actions\/checkout|pull_request\.head\.ref/);
 expect(workflow).toContain('workflows: [CI]');expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
});

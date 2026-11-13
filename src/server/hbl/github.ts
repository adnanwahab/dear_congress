import { HBL_REPOSITORY, type Pull, type Evidence } from '../../shared/hbl-governance';

export class GitHubError extends Error {
  constructor(public kind:'credentials'|'rate-limit'|'unavailable'|'rejected'|'unknown', public status=0) { super(`GitHub source ${kind}`); }
}
type Json = Record<string, any>;
export class GitHubSource {
  repositoryId:number|null = null;
  private requestFetch:typeof fetch;
  private openHeads=new Map<number,string>();
  constructor(private options:{token?:string;fetch?:typeof fetch}) { this.requestFetch=options.fetch ?? fetch; }
  private async request(path:string, init:RequestInit={}):Promise<any> {
    if (init.method && init.method!=='GET' && !this.options.token) throw new GitHubError('credentials');
    let response:Response;
    try { response=await this.requestFetch(`https://api.github.com/repos/${HBL_REPOSITORY}${path}`, { ...init, headers:{Accept:'application/vnd.github+json',...(this.options.token?{Authorization:`Bearer ${this.options.token}`} : {}),'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'}, signal:AbortSignal.timeout(20_000) }); }
    catch { throw new GitHubError('unknown'); }
    if (!response.ok) throw new GitHubError(response.status===429 || (response.status===403 && response.headers.get('x-ratelimit-remaining')==='0') ? 'rate-limit' : response.status===401 ? 'credentials' : response.status>=500 ? 'unavailable' : 'rejected', response.status);
    try { return await response.json(); } catch { throw new GitHubError('unknown', response.status); }
  }
  private async pin() {
    const repo=await this.request('');
    if(repo.full_name?.toLowerCase()!==HBL_REPOSITORY || repo.id!==1364565814 || (this.repositoryId!==null && this.repositoryId!==repo.id)) throw new GitHubError('rejected');
    this.repositoryId=repo.id;
  }
  private async pages(path:string,key?:string):Promise<Json[]> {
    const all:Json[]=[];
    for(let page=1;;page++) {
      const data=await this.request(`${path}${path.includes('?')?'&':'?'}per_page=100&page=${page}`);
      const rows=key?data[key]:data;
      if(!Array.isArray(rows)) throw new GitHubError('unknown');
      all.push(...rows);
      if(rows.length<100) return all;
    }
  }
  private pull(p:Json):Pull {
    if(p.base?.repo?.id!==this.repositoryId || p.base?.repo?.full_name?.toLowerCase()!==HBL_REPOSITORY) throw new GitHubError('rejected');
    return {number:p.number,repositoryId:this.repositoryId!,title:p.title,body:p.body??'',author:p.user?.login??'',url:p.html_url,updatedAt:p.updated_at,headSha:p.head.sha,base:p.base.ref,draft:!!p.draft,state:p.state,version:`${this.repositoryId}:${p.number}:${p.head.sha}:${p.base.ref}`,firstSeenAt:Date.now(),labels:(p.labels??[]).map((l:Json)=>l.name)};
  }
  async listPulls():Promise<Pull[]> { await this.pin(); const pulls=(await this.pages('/pulls?state=open&sort=created&direction=asc')).map(p=>this.pull(p)); this.openHeads=new Map(pulls.map(p=>[p.number,p.headSha])); return pulls; }
  async detail(number:number):Promise<Pull> {
    if(!Number.isSafeInteger(number)||number<1) throw new GitHubError('rejected');
    await this.pin();
    const raw=await this.request(`/pulls/${number}`), pull=this.pull(raw);
    const files=await this.pages(`/pulls/${number}/files`);
    if(files.length>=3000 || (typeof raw.changed_files==='number' && files.length!==raw.changed_files)) throw new GitHubError('unknown');
    pull.files=files.map(f=>({filename:f.filename,status:f.status,additions:f.additions,deletions:f.deletions,patch:f.patch}));
    const evidence:Evidence={checks:[],reviews:[],requestedReviewers:(raw.requested_reviewers??[]).length+(raw.requested_teams??[]).length,mergeable:raw.mergeable??null,mergeableState:raw.mergeable_state??'unknown',baseSha:raw.base.sha,protectionsKnown:false,protectedBase:false,sensitive:files.some(f=>/(^|\/)(\.github|auth|security|migrations|server|infra|governance)(\/|$)|(?:lock|package\.json|config\.[^/]+)$|(?:vot|policy|roster|migration|docker|terraform)/i.test(f.filename) || f.status==='removed'),maintainerApproved:false};
    pull.evidence=evidence;
    try {
      const [runs,statuses,reviews,protection,commits]=await Promise.all([this.pages(`/commits/${pull.headSha}/check-runs`,'check_runs'),this.pages(`/commits/${pull.headSha}/statuses`),this.pages(`/pulls/${number}/reviews`),this.request(`/branches/${encodeURIComponent(pull.base)}/protection`),this.pages(`/pulls/${number}/commits`)]);
      if(commits.length>=250) throw new GitHubError('unknown');
      if([...this.openHeads].some(([n,sha])=>n!==number && commits.some(c=>c.sha===sha))) evidence.mergeableState='blocked';
      evidence.checks=runs.map(c=>({name:c.name,status:c.status,conclusion:c.conclusion,sha:c.head_sha}));
      const seen=new Set<string>();
      for(const c of statuses) if(!seen.has(c.context)) { seen.add(c.context); evidence.checks.push({name:c.context,status:c.state==='pending'?'in_progress':'completed',conclusion:c.state==='success'?'success':c.state,sha:c.sha??pull.headSha}); }
      const latest=new Map<number,Json>();
      for(const r of reviews) if(r.state!=='COMMENTED' && r.state!=='PENDING') latest.set(r.user.id,r);
      evidence.reviews=[...latest.values()].filter(r=>r.state!=='APPROVED').map(r=>({userId:r.user.id,state:r.state,commitId:r.commit_id}));
      const contexts=[...(protection.required_status_checks?.contexts??[]),...(protection.required_status_checks?.checks??[]).map((c:Json)=>c.context)];
      for(const name of new Set<string>(contexts)) if(!evidence.checks.some(c=>c.name===name)) evidence.checks.push({name,status:'unknown',conclusion:null,sha:pull.headSha});
      // Repository protection requirements must never be weaker than local policy.
      const required=protection.required_pull_request_reviews?.required_approving_review_count??0;
      if(protection.required_status_checks?.strict!==true) evidence.mergeableState='blocked';
      for(const r of latest.values()) if(r.state==='APPROVED' && r.commit_id===pull.headSha) {
        const permission=await this.request(`/collaborators/${encodeURIComponent(r.user.login)}/permission`);
        if(['admin','maintain','write'].includes(permission.permission)) { evidence.maintainerApproved=true; evidence.reviews.push({userId:r.user.id,state:r.state,commitId:r.commit_id}); }
      }
      if(evidence.reviews.filter(r=>r.state==='APPROVED' && r.commitId===pull.headSha).length<required) evidence.mergeableState='blocked';
      evidence.protectionsKnown=true; evidence.protectedBase=true;
    } catch { /* Missing or inaccessible evidence remains UNKNOWN and cannot merge. */ }
    return pull;
  }
  async merge(number:number,expectedSha:string):Promise<{merged:boolean;sha?:string}> {
    if(!this.options.token) throw new GitHubError('credentials');
    if(!Number.isSafeInteger(number)||number<1||!expectedSha) throw new GitHubError('rejected');
    await this.pin();
    const result=await this.request(`/pulls/${number}/merge`,{method:'PUT',body:JSON.stringify({sha:expectedSha,merge_method:'merge'})});
    if(result.merged!==true || typeof result.sha!=='string' || !/^[a-f0-9]{40}$/i.test(result.sha)) throw new GitHubError('unknown');
    return {merged:true,sha:result.sha};
  }
  /** Read-only operator reconciliation. This never clears a durable UNKNOWN or retries a merge. */
  async reconcileMerge(number:number,expectedHead:string,expectedBase:string):Promise<{status:'merged'|'unmerged'|'unknown';mergeCommit:string|null;headSha:string;base:string;baseSha:string}> {
    if(!Number.isSafeInteger(number)||number<1) throw new GitHubError('rejected');
    await this.pin();
    const raw=await this.request(`/pulls/${number}`),pull=this.pull(raw);
    const same=pull.headSha===expectedHead && pull.base===expectedBase;
    const commit=typeof raw.merge_commit_sha==='string' && /^[a-f0-9]{40}$/i.test(raw.merge_commit_sha)?raw.merge_commit_sha:null;
    return {status:same && raw.merged===true && commit?'merged':same && raw.merged===false?'unmerged':'unknown',mergeCommit:raw.merged===true?commit:null,headSha:pull.headSha,base:pull.base,baseSha:raw.base.sha};
  }
}

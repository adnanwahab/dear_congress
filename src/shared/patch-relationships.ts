import type { PublicPull } from './hbl-governance';
export type RelationshipStatus = 'blocked' | 'checks-pending' | 'review-ready' | 'draft' | 'unverified';
export interface RelationshipNode { id:string; label:string; url?:string; kind:'pr'|'issue'|'commit'|'branch'; }
export interface RelationshipEdge { from:string; to:string; label:string; }
export function relationshipStatus(p:PublicPull):RelationshipStatus {
  if(p.eligibility.state==='blocked')return 'blocked';
  if(p.draft)return 'draft';
  if(p.eligibility.state==='waiting-for-checks')return 'checks-pending';
  if(p.eligibility.state==='approved')return 'review-ready';
  return 'unverified';
}
/** Each edge is a source assertion, never inferred from titles, numbers or ordering. */
export function patchRelationships(p:PublicPull, repository:string) {
  const nodes:RelationshipNode[]=[], edges:RelationshipEdge[]=[];
  const root=`${p.repositoryId}:${p.kind??'pr'}:${p.number}:${p.version}`;
  const origin=`https://github.com/${repository}`;
  const add=(node:RelationshipNode)=>{if(!nodes.some(n=>n.id===node.id))nodes.push(node);return node.id;};
  add({id:root,label:`${p.kind==='issue'?'Issue':'PR'} #${p.number}`,kind:p.kind??'pr',url:`${origin}/${p.kind==='issue'?'issues':'pull'}/${p.number}`});
  const connect=(node:RelationshipNode,label:string)=>edges.push({from:root,to:add(node),label});
  if(p.kind!=='issue') {
    if(p.base)connect({id:`${root}:base`,label:`Base branch: ${p.base}`,kind:'branch',url:`${origin}/tree/${encodeURIComponent(p.base)}`},'targets (not ancestry)');
    // A fork head is never attributed to the base repository.
    if(p.branchSource?.headRepository && /^[\w.-]+\/[\w.-]+$/.test(p.branchSource.headRepository) && p.branchSource.headRef)connect({id:`${root}:head`,label:`${p.branchSource.headRepository}:${p.branchSource.headRef}`,kind:'branch',url:`https://github.com/${p.branchSource.headRepository}/tree/${encodeURIComponent(p.branchSource.headRef)}`},'head branch');
    if(p.headSha)connect({id:`${root}:revision`,label:`Head commit: ${p.headSha}`,kind:'commit',url:`${origin}/commit/${p.headSha}`},'displayed revision');
    for(const commit of p.branchSource?.commits??[]) {
      const child=add({id:`${root}:commit:${commit.sha}`,label:commit.sha,kind:'commit',url:`${origin}/commit/${commit.sha}`});
      for(const parent of commit.parents)edges.push({from:add({id:`${root}:commit:${parent}`,label:parent,kind:'commit',url:`${origin}/commit/${parent}`}),to:child,label:'GitHub parent → child'});
    }
  }
  for(const raw of p.links??[])try {
    const u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password||u.port)continue;
    const gh=u.hostname==='github.com'&&/^\/[\w.-]+\/[\w.-]+\/(?:pull\/\d+|issues\/\d+|commit\/[a-f0-9]{40})\/?$/i.test(u.pathname);
    const linear=u.hostname==='linear.app'&&/^\/[^/]+\/issue\/[A-Z]+-\d+(?:\/[^/]*)?$/i.test(u.pathname);
    if(!gh&&!linear)continue;
    const kind=linear||u.pathname.includes('/issues/')?'issue':u.pathname.includes('/commit/')?'commit':'pr';
    connect({id:u.origin+u.pathname,label:linear?u.pathname.split('/')[3]!:u.pathname.slice(1),kind,url:u.href},'linked in source description (unverified relationship)');
  }catch { /* Invalid source links are omitted. */ }
  return {nodes,edges,status:relationshipStatus(p)};
}

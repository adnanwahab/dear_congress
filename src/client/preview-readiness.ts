import type { Policy, PublicPull } from '../shared/hbl-governance';
export interface Diagnostic { rule:string; state:'blocked'|'pending'|'passed'|'unknown'; guidance:string }
export interface Readiness { state:'blocked'|'checks-pending'|'review-ready'|'unknown'; diagnostics:Diagnostic[]; preview:'ready'|'pending' }
/** Read-only interpretation. Never an authority to merge or cast a ballot. */
export function previewReadiness(p:PublicPull, policy:Policy):Readiness {
 const e=p.evidence, rows:Diagnostic[]=[];
 const add=(rule:string,state:Diagnostic['state'],guidance:string)=>rows.push({rule,state,guidance});
 add('Configured allowedBases',policy.allowedBases.includes(p.base)?'passed':'blocked',policy.allowedBases.includes(p.base)?`Base ${p.base} is allowed.`:`Base ${p.base} is outside the configured allowlist (${policy.allowedBases.join(', ')||'empty; fail closed'}). Ask a maintainer to confirm the intended target and policy; protections remain in force.`);
 if(!e) add('GitHub receipts','unknown','Open diagnostics or refresh to fetch current-head checks and protection receipts.');
 else {
  add('GitHub branch protection',e.protectionsKnown&&e.protectedBase?'passed':'unknown',e.protectionsKnown?'Protected base receipt available.':'Protection receipt unavailable. A maintainer should verify read permissions and inspect GitHub rules.');
  if(e.receipt)add('GitHub required_status_checks.strict',e.receipt.status!=='complete'?'unknown':e.receipt.strict?'passed':'blocked','GitHub requires up-to-date branch checks for this pilot. Ask a maintainer to inspect the rule; do not bypass it.');
  if(!policy.requiredChecks.length)add('Configured requiredChecks','unknown','The configured check allowlist is empty and fails closed. Ask a maintainer to verify the intended requirements.');
  if(e.checks.some(c=>c.sha!==p.headSha))add('Check revision identity','unknown','Some check receipts belong to another head. Refresh and inspect current-head checks on GitHub.');
  const names=new Set([...policy.requiredChecks,...(e.receipt?.requiredChecks??[]),...e.checks.map(c=>c.name)]);
  if(!names.size)add('Current-head checks','unknown','No check names are available. Inspect GitHub checks before review.');
  for(const name of names){const checks=e.checks.filter(c=>c.name===name&&c.sha===p.headSha);const state=checks.length&&checks.every(c=>c.status==='completed'&&c.conclusion==='success')?'passed':checks.some(c=>c.status==='completed'&&c.conclusion&&c.conclusion!=='success')?'blocked':'pending';add(`Check: ${name}`,state,state==='passed'?'Succeeded on the displayed head.':state==='blocked'?'Review the failing check on GitHub, fix its cause and push a new revision.':'Wait for this check on the displayed head; if missing, ask a maintainer to inspect workflow triggers and permissions.');}
  const approvals=e.reviews.filter(r=>r.state==='APPROVED'&&r.commitId===p.headSha).length;
  add('Current-head code review',approvals>=Math.max(1,policy.requiredApprovals,e.receipt?.requiredApprovals??0)&&!e.requestedReviewers&&!e.reviews.some(r=>r.state==='CHANGES_REQUESTED')?'passed':'blocked','Resolve requested changes and obtain required human review on this revision.');
  add('GitHub mergeability',e.mergeable===true&&e.mergeableState==='clean'?'passed':e.mergeable===null?'unknown':'blocked',`GitHub state: ${e.mergeableState}. Resolve conflicts or outstanding GitHub rules with a maintainer.`);
  if(e.sensitive)add('Sensitive-change maintainer approval',e.maintainerApproved?'passed':'blocked','Sensitive changes require current-head maintainer approval.');
 }
 if(p.draft||p.state!=='open')add('PR review state','blocked','Open the PR and mark it ready for human review when appropriate.');
 if(p.eligibility.state==='blocked')add('Configured eligibility','blocked',p.eligibility.reason);
 const state=rows.some(r=>r.state==='blocked')?'blocked':rows.some(r=>r.state==='unknown')?'unknown':rows.some(r=>r.state==='pending')?'checks-pending':'review-ready';
 return {state,diagnostics:rows,preview:p.preview?.headSha===p.headSha&&p.preview.exploreUrl?'ready':'pending'};
}

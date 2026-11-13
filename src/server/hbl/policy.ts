import type { Eligibility, Policy, Pull, Tally } from '../../shared/hbl-governance';
export const DEFAULT_POLICY:Policy={version:'1',timezone:'America/Chicago',quorum:10,minExposureHours:24,allowedBases:[],requiredChecks:[],requiredApprovals:1,enabled:false,dryRun:true,maxRecoveryHours:6};
export function evaluateEligibility(p:Pull,t:Tally,policy:Policy,cutoff=Date.now()):Eligibility {
  const result=(state:Eligibility['state'],reason:string):Eligibility=>({state,reason,eligible:state==='approved'});
  if(p.kind==='issue')return result('blocked','Issues are never merge candidates');
  if(p.draft) return result('draft','Draft pull request');
  if(p.state!=='open') return result('blocked','Pull request is not open');
  if(p.labels.some(label=>/(?:^|[\s:_-])(?:hold|do[\s_-]*not[\s_-]*merge|blocked)(?:$|[\s:_-])/i.test(label))) return result('blocked','Pull request has an explicit hold label');
  if(!policy.allowedBases.length || !policy.allowedBases.includes(p.base)) return result('blocked','Base branch is not allowed');
  if(cutoff-p.firstSeenAt<policy.minExposureHours*3_600_000) return result('open-for-voting','Minimum exposure has not elapsed');
  if(t.participation<policy.quorum || t.yes<=t.no) return result('open-for-voting','Quorum and a strict yes majority are required');
  const e=p.evidence;
  if(!e || !e.protectionsKnown || !e.protectedBase || e.mergeable!==true || e.mergeableState!=='clean') return result('blocked','Mergeability or branch protection evidence is unknown or blocked');
  if(!policy.requiredChecks.length || !e.checks.length || policy.requiredChecks.some(name=>!e.checks.some(c=>c.name===name))) return result('waiting-for-checks','Required checks are not configured or missing');
  if(e.checks.some(c=>c.sha!==p.headSha || c.status!=='completed' || c.conclusion!=='success')) return result('waiting-for-checks','Checks must succeed on the current head');
  if(e.reviews.some(r=>r.state==='CHANGES_REQUESTED') || e.requestedReviewers>0 || e.reviews.filter(r=>r.state==='APPROVED' && r.commitId===p.headSha).length<Math.max(1,policy.requiredApprovals)) return result('blocked','Current-head reviews are required');
  if(e.sensitive && !e.maintainerApproved) return result('blocked','Sensitive changes require maintainer approval');
  return result('approved','Voting and repository checks passed');
}
function localParts(ms:number) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(ms).map(p=>[p.type,p.value]));
}
function cutoffForDate(year:number,month:number,day:number):number {
  let ms=Date.UTC(year,month-1,day,15);
  for(let i=0;i<3;i++) { const p=localParts(ms); const local=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second)); ms+=Date.UTC(year,month-1,day,9)-local; }
  return ms;
}
export function nextBatch(now=Date.now()):string {
  const p=localParts(now); let cutoff=cutoffForDate(Number(p.year),Number(p.month),Number(p.day));
  if(cutoff<=now) { const tomorrow=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)+1)); cutoff=cutoffForDate(tomorrow.getUTCFullYear(),tomorrow.getUTCMonth()+1,tomorrow.getUTCDate()); }
  return new Date(cutoff).toISOString();
}
export function intendedCutoff(now=Date.now(),maxRecoveryHours=6):number|null {
  const p=localParts(now),cutoff=cutoffForDate(Number(p.year),Number(p.month),Number(p.day));
  return now>=cutoff && now-cutoff<=Math.min(6,Math.max(0,maxRecoveryHours))*3_600_000 ? cutoff:null;
}

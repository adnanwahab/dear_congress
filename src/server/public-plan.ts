import {createHash} from 'node:crypto';
import {buildContext,DEFAULT_WEIGHTS,synthesize} from '../engine/engine';
import type {DB,Proposal,SynthesisOutcomes} from '../engine/types';

/** Public policy wording only. No journal/sourceText, voter records or idea reports. */
function publicProposal(proposal:Proposal){
 return {id:proposal.id,title:proposal.title,needId:proposal.needId,mechanism:proposal.mechanism,authority:proposal.authority,jurisdiction:proposal.jurisdiction,costB:proposal.costB,changeLevel:proposal.changeLevel,evidence:proposal.evidence,effectiveness:proposal.effectiveness,legalChange:proposal.legalChange,metrics:[...proposal.metrics],...(proposal.rightsIssue?{rightsIssue:proposal.rightsIssue}:{})};
}
export function createPublicPlan(db:DB,{now=new Date(),outcomes,sourceUrl}:{now?:Date;outcomes?:SynthesisOutcomes;sourceUrl?:string}={}){
 if(!Number.isFinite(now.getTime()))throw new Error('Invalid public plan time');
 // Detached state protects the live DB even if a synthesis helper later caches data.
 const input=structuredClone(db);
 const context=buildContext(input,undefined,{includeSynthetic:false,now:now.toISOString(),outcomes});
 const computed=synthesize(context,DEFAULT_WEIGHTS,.25,40,input.lastPlan,input.challengerStreak);
 const packages=computed.map(pkg=>({id:pkg.id,name:pkg.name,description:pkg.description,budget:pkg.budget,totalCost:pkg.totalCost,items:pkg.items.map(item=>({proposal:publicProposal(item.proposal)}))}));
 const planHash=createHash('sha256').update(JSON.stringify(packages)).digest('hex');
 return{schemaVersion:'dear-congress-public-plan.v1',packages,balanced:packages.find(p=>p.id==='A')??null,alternatives:packages.filter(p=>p.id!=='A'),provenance:{sourceUrl:sourceUrl||null,retrievedAt:now.toISOString(),planHash,method:'existing real-only synthesis; detached read-only preview',journalInputs:'real only; no journal text exported',scoring:'Existing illustrative scoring and synthetic prior fallbacks remain; not an empirical forecast.',legalStatus:'Policy proposals, not enacted constitutional text',costUnits:'Illustrative national USD billions; not local city spending',storedSnapshot:false}};
}

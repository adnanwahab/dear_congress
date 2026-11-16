import type {LawBehaviorReceipt} from './LawBehaviorExplorer';
import {structuredAmendment, type CivicLawContext} from './civic-law-context';

/** Public model inputs only. Receipt retrieval time is captured on successful response, not export. */
export function modelInputManifest(receipt:LawBehaviorReceipt, context:CivicLawContext, providerOrigin:string, retrievedAt:string) {
  const input=receipt.manifest, amendment=structuredAmendment(context);
  const origin=new URL(providerOrigin);
  if(!['https:','http:'].includes(origin.protocol) || origin.username || origin.password || origin.origin!==providerOrigin ||
    !Number.isFinite(Date.parse(retrievedAt)) || new Date(retrievedAt).toISOString()!==retrievedAt ||
    receipt.status!=='completed' || !input || receipt.law.number!==context.lawId ||
    input.seed!==context.seed || input.population!==context.population ||
    input.implementationStrength!==context.implementationStrength || !input.pairedInitialState ||
    input.start!==0 || input.end!==amendment.horizon || receipt.unit!==amendment.clock ||
    !input.modelVersion || context.modelVersion && context.modelVersion!==input.modelVersion)
    throw Error('Manifest requires a matching completed scenario and retrieval provenance.');
  return {
    schemaVersion:'civic-model-input-manifest.v1', repository:'adnanwahab/dear_congress',
    itemKind:'synthetic-law-scenario', advisoryOnly:true, synthetic:true, reviewStatus:'unreviewed model assumptions',
    catalogRevision:null,
    sources:[{url:new URL('/api/law-behavior',origin).href, retrievedAt, kind:'synthetic model receipt'}],
    engine:{name:receipt.engine, version:input.modelVersion, codeRevision:null},
    law:{id:receipt.law.id,number:receipt.law.number,title:receipt.law.title},
    scenario:{proposalId:amendment.proposalId,revision:context.revision,seed:input.seed,population:input.population,
      implementationStrength:input.implementationStrength,start:input.start,end:input.end,clock:receipt.unit,
      recordedCheckpoints:input.recordedCheckpoints},
    weights:{values:null,status:'Provider calibration weights unavailable; civic package scoring weights do not apply to this separate model.'},
    assumptions:['Paired initial synthetic state.', 'Only the allowlisted implementation-strength parameter is edited.',
      'Synthetic actors and futures are not measurements, representative residents, legal text or official claims.'],
    unknowns:['Provider catalog revision unavailable.', 'Provider code revision unavailable.',
      'Provider calibration weights and source evidence/retrieval dates unavailable.',
      'No measured policy effects, causal validation or real-world representativeness established.'],
    limitations:[...(receipt.limitations??[])],
  };
}

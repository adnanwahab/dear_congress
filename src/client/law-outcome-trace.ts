import type {LawBehaviorReceipt} from './LawBehaviorExplorer';
import {structuredAmendment,type CivicLawContext} from './civic-law-context';

/** A checkpoint comparison is evidence of model output, never an invented event chain. */
export function lawOutcomeTrace(receipt:LawBehaviorReceipt,context:CivicLawContext,metric:string,index:number,providerOrigin:string){
  const frame=receipt.frames[index],manifest=receipt.manifest;
  if(receipt.status!=='completed'||!frame||!manifest||receipt.law.number!==context.lawId||
    manifest.seed!==context.seed||manifest.implementationStrength!==context.implementationStrength||
    manifest.population!==context.population||context.modelVersion&&context.modelVersion!==manifest.modelVersion)
    throw Error('Trace context does not match the recorded scenario.');
  const baseline=frame.baseline.metrics[metric]??null,edited=frame.edited.metrics[metric]??null;
  return {
    schemaVersion:'civic-law-outcome-trace.v1',classification:'synthetic sandbox',
    source:{providerOrigin,endpoint:'/api/law-behavior',receiptSchema:receipt.schemaVersion,law:receipt.law},
    scenario:{...context,modelVersion:manifest.modelVersion},amendment:structuredAmendment(context),
    provenance:{seed:manifest.seed,modelVersion:manifest.modelVersion,codeVersion:null},
    observation:{classification:'observed simulation correlation',metric,clock:receipt.unit,
      time:frame.time,baseline,edited,difference:baseline===null||edited===null?null:edited-baseline},
    modelRule:{status:'mapping only; execution evidence unavailable',
      mechanism:context.lawId===83?'Transit frequency':context.lawId===22?'Housing construction cost':context.lawId===23?'Permit processing capacity':'Upzoning (fixed model rule)'},
    causalInterpretation:{status:'unavailable',reason:'Paired sampled outputs do not supply a validated event-level causal explanation.'},
    missingEvidence:['event IDs','event timestamps (checkpoint times only)','executed mechanism receipts','code version'],
    events:null,
    // Include exactly the validated receipt used on screen, preserving source identities and limitations.
    receipt
  };
}

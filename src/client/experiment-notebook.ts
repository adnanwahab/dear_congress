import {parseLawBehaviorReceipt,type LawBehaviorReceipt} from './LawBehaviorExplorer';
import {civicLawQuery,type CivicLawContext} from './civic-law-context';

export const NOTEBOOK_KEY='dear-congress:experiment-notebook:v1';
export const NOTEBOOK_LIMIT=12;
export type ExperimentRun={id:string;name:string;createdAt:string;parentId?:string;sourceOrigin:string;context:CivicLawContext;receipt:LawBehaviorReceipt};
export function validateRun(value:unknown):ExperimentRun{
  const run=value as ExperimentRun;
  if(!run||typeof run.id!=='string'||!run.id||run.id.length>100||typeof run.name!=='string'||!run.name.trim()||run.name.length>80||
    typeof run.createdAt!=='string'||!Number.isFinite(Date.parse(run.createdAt))||
    run.parentId!==undefined&&(typeof run.parentId!=='string'||run.parentId.length>100)||
    run.sourceOrigin!=='https://happybearlandia.fly.dev')throw Error('Invalid notebook record.');
  const context=run.context;
  civicLawQuery(context);
  const receipt=parseLawBehaviorReceipt(run.receipt),m=receipt.manifest;
  if(receipt.status!=='completed'||!m||receipt.law.number!==context.lawId||m.seed!==context.seed||m.population!==context.population||
    m.implementationStrength!==context.implementationStrength||m.modelVersion!==context.modelVersion||
    (context.lawId===83?receipt.engine!=='population'||receipt.unit!=='minute':receipt.engine!=='city'||receipt.unit!=='month'))throw Error('Notebook receipt does not match its inputs.');
  return structuredClone(run);
}
export function readNotebook(raw:string|null):ExperimentRun[]{
  if(raw===null)return[];
  if(raw.length>8_000_000)throw Error('Notebook exceeds the local size limit.');
  const data=JSON.parse(raw);
  if(data?.schemaVersion!=='civic-experiment-notebook.v1'||!Array.isArray(data.runs)||data.runs.length>NOTEBOOK_LIMIT)throw Error('Unsupported notebook. Existing storage was left untouched.');
  const runs=data.runs.map(validateRun) as ExperimentRun[];
  if(new Set(runs.map(r=>r.id)).size!==runs.length)throw Error('Duplicate notebook identities.');
  return runs;
}
export function writeNotebook(runs:ExperimentRun[]){
  const raw=JSON.stringify({schemaVersion:'civic-experiment-notebook.v1',runs});
  readNotebook(raw);
  return raw;
}
export function createRun(name:string,context:CivicLawContext,receipt:LawBehaviorReceipt,sourceOrigin:string,parentId?:string):ExperimentRun{
  return validateRun({id:crypto.randomUUID(),name:name.trim(),createdAt:new Date().toISOString(),context,receipt,sourceOrigin,...(parentId?{parentId}:{})});
}
export function comparableRuns(a:ExperimentRun,b:ExperimentRun){
  const x=a.receipt,y=b.receipt;
  return x.engine===y.engine&&x.unit===y.unit&&x.manifest?.modelVersion===y.manifest?.modelVersion&&
    x.manifest?.seed===y.manifest?.seed&&x.manifest?.population===y.manifest?.population&&
    x.manifest?.start===y.manifest?.start&&x.manifest?.end===y.manifest?.end&&
    x.frames.at(-1)?.time===y.frames.at(-1)?.time;
}

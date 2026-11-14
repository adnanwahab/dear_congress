/** Public read-only model context. Never copy arbitrary query parameters. */
export type CivicLawContext={lawId:number;implementationStrength:number;seed:number;population:24;proposalId?:string;revision:number;modelVersion?:string};
const ID=/^[A-Za-z0-9_-]{1,80}$/,VERSION=/^[A-Za-z0-9._-]{1,80}$/;
export function parseCivicLawContext(search:string):CivicLawContext|null{
 const q=new URLSearchParams(search);if(q.get('civicContext')!=='1')return null;
 for(const key of ['civicContext','lawId','implementationStrength','seed','population','proposalId','revision','modelVersion'])if(q.getAll(key).length>1)return null;
 for(const key of ['lawId','implementationStrength','seed','revision'])if(!q.has(key))return null;
 const raw=(key:string,fallback:string)=>q.has(key)?q.get(key)!:fallback;
 const law=raw('lawId','83'),strength=raw('implementationStrength','1'),seed=raw('seed','42'),population=raw('population','24'),revision=raw('revision','1');
 if(!/^(21|22|23|83)$/.test(law)||!['0','0.25','0.5','0.75','1'].includes(strength)||!/^\d{1,10}$/.test(seed)||Number(seed)>4294967295||population!=='24'||!/^\d{1,7}$/.test(revision)||Number(revision)<1||Number(revision)>1000000)return null;
 if(law==='21'&&strength!=='1')return null;
 const proposalId=q.get('proposalId'),modelVersion=q.get('modelVersion');
 if(proposalId!==null&&!ID.test(proposalId)||modelVersion!==null&&!VERSION.test(modelVersion))return null;
 return{lawId:Number(law),implementationStrength:Number(strength),seed:Number(seed),population:24,revision:Number(revision),...(proposalId?{proposalId}:{}),...(modelVersion?{modelVersion}:{})};
}
export function civicLawQuery(context:CivicLawContext){
 const q=new URLSearchParams({civicContext:'1',lawId:String(context.lawId),implementationStrength:String(context.implementationStrength),seed:String(context.seed),population:'24',revision:String(context.revision)});
 if(context.proposalId)q.set('proposalId',context.proposalId);if(context.modelVersion)q.set('modelVersion',context.modelVersion);
 if(!parseCivicLawContext(q.toString()))throw Error('Unsupported public scenario context.');return q;
}
export function structuredAmendment(context:CivicLawContext){
 const q=civicLawQuery(context);void q;
 return{schemaVersion:'civic-reviewed-amendment.v1',proposalId:context.proposalId||`demo-law-${context.lawId}`,revision:context.revision,lawId:context.lawId,parameterKey:context.lawId===21?'fixed-rule':'implementationStrength',originalValue:1,editedValue:context.implementationStrength,units:context.lawId===21?'discrete rule':'fraction of reviewed implementation',permittedValues:context.lawId===21?[1]:[0,.25,.5,.75,1],seed:context.seed,population:24,modelVersion:context.modelVersion||null,horizon:context.lawId===83?720:12,clock:context.lawId===83?'minute':'month',status:'local synthetic discussion draft; not a saved proposal, legal amendment, ballot or prediction'};
}

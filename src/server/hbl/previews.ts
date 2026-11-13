import { readFileSync } from 'node:fs';
import type { PublicPull } from '../../shared/hbl-governance';

type PreviewRecord = {number:number;headSha:string;route:string;screenshot:string;capturedAt:string;note?:string;deployedUrl?:string;deploymentVerifiedAt?:string};
// Read the small operator-owned registry at request time so long-running local
// servers see newly prepared previews without keeping an empty startup snapshot.
function previews():PreviewRecord[]{
 try{const records=JSON.parse(readFileSync(new URL('./previews.json',import.meta.url),'utf8'));return Array.isArray(records)?records:[];}catch{return [];}
}
/** Only operator-recorded exact-revision previews are displayed; PR text cannot supply a URL. */
export function previewFor(number:number,headSha:string):PublicPull['preview'] {
 const record=previews().find(p=>p.number===number&&p.headSha===headSha);
 if(!record||!/^pr-\d+-[a-f0-9]{8,40}\.png$/.test(record.screenshot)||!/^\/[a-zA-Z0-9/_?=&.%-]*$/.test(record.route))return undefined;
 let exploreUrl:string|undefined;
 if(record.deployedUrl&&record.deploymentVerifiedAt){try{const url=new URL(record.deployedUrl);if(url.protocol==='https:'&&url.hostname===`hbl-pr-${number}-${headSha.slice(0,8)}.fly.dev`&&!url.port&&!url.username&&!url.password&&url.pathname+url.search===record.route)exploreUrl=url.href;}catch{}}
 return {headSha,route:record.route,screenshotUrl:`/api/hbl/previews/${number}/${headSha}/image`,capturedAt:record.capturedAt,note:record.note,exploreUrl,deploymentVerifiedAt:exploreUrl?record.deploymentVerifiedAt:undefined};
}
export function previewImage(number:number,headSha:string) {
 const record=previews().find(p=>p.number===number&&p.headSha===headSha);
 if(!record||!previewFor(number,headSha))return null;
 return new URL(`../../client/assets/pr-previews/${record.screenshot}`,import.meta.url);
}

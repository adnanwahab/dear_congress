import { randomUUID } from 'node:crypto';
import { HBL_REPOSITORY } from '../../shared/hbl-governance';
import type { GovernanceStore } from './store';
export const VOTE_BATCH_MS=5*60*1000;
export const nextVoteBatch=(now=Date.now())=>new Date((Math.floor(now/VOTE_BATCH_MS)+1)*VOTE_BATCH_MS).toISOString();

export function createVoteSummary(store:GovernanceStore, config:{enabled:boolean;token?:string;botId?:number;now?:()=>number;fetch?:typeof fetch}) {
 const now=config.now??Date.now, request=config.fetch??fetch;
 store.db.exec(`CREATE TABLE IF NOT EXISTS hbl_vote_summaries(cutoff INTEGER NOT NULL,number INTEGER NOT NULL,version TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',owner TEXT,lease_until INTEGER NOT NULL DEFAULT 0,retry_at INTEGER NOT NULL DEFAULT 0,url TEXT,error TEXT,PRIMARY KEY(cutoff,number));`);
 const configured=()=>config.enabled&&!!config.token&&!!config.botId;
 function status(){return {enabled:configured(),nextBatch:nextVoteBatch(now()),timezone:'America/Chicago',latest:store.db.query('SELECT cutoff,number,status,url,error FROM hbl_vote_summaries ORDER BY cutoff DESC,number LIMIT 100').all()};}
 async function github(path:string,init:RequestInit={}) {
   const response=await request(`https://api.github.com/repos/${HBL_REPOSITORY}${path}`,{...init,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${config.token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'}});
   if(!response.ok)throw Error('GitHub summary delivery is pending.');return response.json() as Promise<any>;
 }
 async function run(){
   const cutoff=Math.floor(now()/VOTE_BATCH_MS)*VOTE_BATCH_MS;if(!configured())return {processed:0};
   // Freeze each PR's latest known revision and latest browser choices strictly before this five-minute cutoff.
   store.db.transaction(()=>{
     const pulls=store.db.query('SELECT data FROM pull_revisions p WHERE created_at<? AND seq=(SELECT MAX(seq) FROM pull_revisions WHERE number=p.number AND created_at<?)').all(cutoff,cutoff) as {data:string}[];
     for(const row of pulls){const p=JSON.parse(row.data);if(p.state!=='open')continue;
       const tally=store.db.query(`SELECT COALESCE(SUM(choice='yes'),0) yes,COALESCE(SUM(choice='no'),0) no,COUNT(*) total FROM hbl_community_vote_revisions r WHERE number=? AND version=? AND created_at<? AND seq=(SELECT MAX(seq) FROM hbl_community_vote_revisions WHERE voter=r.voter AND number=r.number AND version=r.version AND created_at<?)`).get(p.number,p.version,cutoff,cutoff) as any;
       if(!tally.total)continue;
       const marker=`<!-- civic-vote-summary:${cutoff}:${p.number} -->`;
       const body=`${marker}\n## Civic Synthesis community votes\n${tally.yes} votes yes, ${tally.no} votes no\n\nSnapshot: ${new Date(cutoff).toISOString()} (five-minute batch).\nRevision: ${p.headSha}; target: ${p.base}.\nBrowser-scoped, advisory votes; these are not verified people or code-review approvals.\nVotes after this cutoff are included in a future five-minute snapshot.`;
       store.db.query('INSERT OR IGNORE INTO hbl_vote_summaries(cutoff,number,version,body) VALUES(?,?,?,?)').run(cutoff,p.number,p.version,body);
     }
   })();
   let processed=0;
   const rows=store.db.query("SELECT * FROM hbl_vote_summaries WHERE cutoff<=? AND status!='posted' AND retry_at<=? AND lease_until<=? ORDER BY number LIMIT 100").all(cutoff,now(),now()) as any[];
   for(const row of rows){const owner=randomUUID();if(!store.db.query("UPDATE hbl_vote_summaries SET owner=?,lease_until=?,status='sending' WHERE cutoff=? AND number=? AND status!='posted' AND lease_until<=?").run(owner,now()+120000,row.cutoff,row.number,now()).changes)continue;
     try{
       let comment:any=null;
       for(let page=1;page<=100;page++){if(!store.db.query("UPDATE hbl_vote_summaries SET lease_until=? WHERE cutoff=? AND number=? AND owner=? AND lease_until>?").run(now()+120000,row.cutoff,row.number,owner,now()).changes)throw Error();const comments=await github(`/issues/${row.number}/comments?per_page=100&page=${page}`);if(!Array.isArray(comments))throw Error();comment=comments.find(c=>c.user?.id===config.botId&&c.user?.type==='Bot'&&c.body===row.body);if(comment||comments.length<100)break;if(page===100)throw Error();}
       if(!comment){if(!store.db.query("UPDATE hbl_vote_summaries SET lease_until=? WHERE cutoff=? AND number=? AND owner=? AND lease_until>?").run(now()+120000,row.cutoff,row.number,owner,now()).changes)throw Error();comment=await github(`/issues/${row.number}/comments`,{method:'POST',body:JSON.stringify({body:row.body})});}
       if(comment.user?.id!==config.botId||comment.user?.type!=='Bot'||comment.body!==row.body||!new RegExp(`^https://github\\.com/adnanwahab/happybearlandia/(?:pull|issues)/${row.number}#issuecomment-\\d+$`).test(comment.html_url))throw Error();
       store.db.query("UPDATE hbl_vote_summaries SET status='posted',url=?,lease_until=0,error=NULL WHERE cutoff=? AND number=? AND owner=?").run(comment.html_url,row.cutoff,row.number,owner);processed++;
     }catch{store.db.query("UPDATE hbl_vote_summaries SET status='pending',lease_until=0,retry_at=?,error='Delivery pending; totals are saved locally.' WHERE cutoff=? AND number=? AND owner=?").run(now()+30000,row.cutoff,row.number,owner);}
   }
   return {processed};
 }
 return {run,status};
}

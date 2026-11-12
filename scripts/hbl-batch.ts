import { createHmac } from 'node:crypto';

// The CLI only wakes the existing single writer. It must never create a second SQLite DB.
const url=process.env.HBL_WORKER_URL,secret=process.env.HBL_WORKER_SECRET;
let valid=false;
try { if(url && secret) { const parsed=new URL(url); valid=parsed.protocol==='https:' && !parsed.search && !parsed.hash && !parsed.username && !parsed.password; } } catch { /* Never print the configured URL. */ }
if(!valid || !url || !secret) {
  console.error('Configure an HTTPS HBL_WORKER_URL and HBL_WORKER_SECRET'); process.exit(1);
}
const body=JSON.stringify({dryRun:!process.argv.includes('--live')}),timestamp=String(Math.floor(Date.now()/1000));
const signature=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex');
try {
  const response=await fetch(url,{method:'POST',redirect:'error',headers:{'content-type':'application/json','x-hbl-timestamp':timestamp,'x-hbl-signature':signature},body,signal:AbortSignal.timeout(300_000)});
  if(!response.ok) { console.error(`Worker rejected request (${response.status})`); process.exit(1); }
  console.log(JSON.stringify(await response.json()));
} catch { console.error('Worker request failed; inspect durable receipts before retrying'); process.exit(1); }

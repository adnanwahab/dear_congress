'use strict';
const fs=require('node:fs');
const reserved={'adnanwahab/happybearlandia':['docs/implementation-plan.md'],'adnanwahab/dear_congress':['readme.md','src/client/public-guide.ts']};
function inspect(repo,head,files){
 if(!reserved[repo]||typeof head!=='string'||!Array.isArray(files))throw Error('Invalid PR inventory');
 const violations=[];
 for(const f of files){
  if(!f||typeof f.filename!=='string'||typeof f.status!=='string')throw Error('Incomplete file list');
  const paths=[f.filename,...(f.status==='renamed'&&f.previous_filename?[f.previous_filename]:[])];
  if(/^(mini|symphony)\//.test(head)&&paths.some(p=>reserved[repo].includes(p)))violations.push('Coordinator owns '+f.filename);
  const generated=paths.some(p=>p.startsWith('.mini-symphony-evidence/')||/(^|\/)(test-results|playwright-report)\//.test(p)||(repo==='adnanwahab/dear_congress'&&p.startsWith('artifacts/')));
  if(generated&&f.status!=='removed')violations.push('Generated evidence must be CI artifact: '+f.filename);
 }
 return violations;
}
function mode(created){
 const time=Date.parse(created);
 if(!Number.isFinite(time))throw Error('Invalid created_at');
 return time<Date.parse('2026-11-17T11:00:00Z')?'warn':'enforce';
}
async function listFiles(repo,n,token){
 const files=[];
 for(let page=1;page<=30;page++){
  const res=await fetch('https://api.github.com/repos/'+repo+'/pulls/'+n+'/files?per_page=100&page='+page,{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'mini-symphony-hygiene'}});
  if(!res.ok)throw Error('GitHub file list HTTP '+res.status);
  const rows=await res.json();if(!Array.isArray(rows))throw Error('Incomplete PR inventory');
  files.push(...rows);if(rows.length<100)return files;
 }
 throw Error('PR file inventory at least 3000 files; manual audit required');
}
async function main(){
 const repo=process.env.GITHUB_REPOSITORY,token=process.env.GH_TOKEN,path=process.env.GITHUB_EVENT_PATH;
 if(!repo||!token||!path)throw Error('Trusted event/token missing');
 const pr=JSON.parse(fs.readFileSync(path,'utf8')).pull_request;
 if(!pr||!Number.isInteger(pr.number))throw Error('Expected pull_request_target');
 const files=await listFiles(repo,pr.number,token),findings=inspect(repo,pr.head&&pr.head.ref,files),m=mode(pr.created_at);
 console.log('PR #'+pr.number+': '+files.length+' changed files, '+findings.length+' hygiene findings; '+m);
 for(const finding of findings)console.log('::'+(m==='enforce'?'error':'warning')+'::'+finding.replace(/[\r\n]/g,' '));
 if(m==='enforce'&&findings.length)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error('PR hygiene failed closed: '+e.message);process.exitCode=1});
module.exports={inspect,mode};

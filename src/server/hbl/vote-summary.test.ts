import {test,expect} from 'bun:test';
import {GovernanceStore} from './store';
import {createCommunityVotes} from './community';
import {createVoteSummary,nextVoteBatch} from './vote-summary';
import type {Pull} from '../../shared/hbl-governance';
const cutoff=Date.parse('2026-11-12T15:00:00Z');
const pull:Pull={number:12,repositoryId:1364565814,title:'Patch',body:'',author:'author',url:'https://github.com/adnanwahab/happybearlandia/pull/12',updatedAt:new Date(cutoff-10000).toISOString(),headSha:'a'.repeat(40),base:'test',draft:true,state:'open',version:'v1',firstSeenAt:cutoff-10000,labels:[]};
test('votes are local; five-minute snapshot freezes cutoff, posts once, and reconciles uncertain publication',async()=>{
 const store=new GovernanceStore(':memory:');const votes=createCommunityVotes(store,false);store.upsertPull(pull,cutoff-10000);
 votes.vote('alice',12,'v1','yes',cutoff-3000);votes.vote('alice',12,'v1','no',cutoff-2000);votes.vote('bob',12,'v1','yes',cutoff-1000);
 const comments:any[]=[],calls:{method:string;url:string}[]=[];let clock=cutoff-1,uncertain=true;
 const mock=(async(url:any,init:any)=>{const method=init?.method??'GET';calls.push({method,url:String(url)});if(method==='GET')return Response.json(comments);const body=JSON.parse(init.body).body;const comment={id:99,body,user:{id:7,type:'Bot'},html_url:'https://github.com/adnanwahab/happybearlandia/pull/12#issuecomment-99'};comments.push(comment);if(uncertain){uncertain=false;throw Error('lost response');}return Response.json(comment);}) as typeof fetch;
 const batch=createVoteSummary(store,{enabled:true,token:'test-token',botId:7,now:()=>clock,fetch:mock});
 expect((await batch.run()).processed).toBe(0);expect(calls).toHaveLength(0);
 clock=cutoff+100;expect((await batch.run()).processed).toBe(0);expect(comments).toHaveLength(1);expect(comments[0].body).toContain('1 votes yes, 1 votes no');
 votes.vote('alice',12,'v1','yes',cutoff+1000);votes.vote('charlie',12,'v1','yes',cutoff+1000);
 clock=cutoff+30101;expect((await batch.run()).processed).toBe(1);expect(comments).toHaveLength(1);
 expect((await batch.run()).processed).toBe(0);expect(calls.filter(c=>c.method==='POST')).toHaveLength(1);
 expect(batch.status().latest[0]).toMatchObject({status:'posted'});
 expect(batch.status().nextBatch).toBe(new Date(cutoff+300000).toISOString());
 clock=cutoff+300001;expect((await batch.run()).processed).toBe(1);expect(comments).toHaveLength(2);expect(comments[1].body).toContain('3 votes yes, 0 votes no');
 expect(votes.list().votes).toHaveLength(3);expect(votes.list().votes[0]!.participant).toMatch(/^Guest [a-f0-9]{10}$/);
 expect(store.tally(12,'v1').participation).toBe(0);store.db.close();
});
test('unconfigured summaries and empty batches never contact GitHub',async()=>{
 const store=new GovernanceStore(':memory:');createCommunityVotes(store,false);let calls=0;const mock=(async()=>{calls++;throw Error();}) as unknown as typeof fetch;
 const off=createVoteSummary(store,{enabled:true,now:()=>cutoff+1,fetch:mock});expect(off.status().enabled).toBe(false);expect((await off.run()).processed).toBe(0);
 const late=createVoteSummary(store,{enabled:true,token:'token',botId:7,now:()=>cutoff+7*3600000,fetch:mock});expect((await late.run()).processed).toBe(0);expect(calls).toBe(0);store.db.close();
});

test('five-minute countdown rolls over exactly at each boundary',()=>{expect(nextVoteBatch(cutoff-1)).toBe(new Date(cutoff).toISOString());expect(nextVoteBatch(cutoff)).toBe(new Date(cutoff+300000).toISOString());expect(nextVoteBatch(cutoff+299999)).toBe(new Date(cutoff+300000).toISOString());});

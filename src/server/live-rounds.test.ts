import { test, expect } from 'bun:test';
import { LiveRounds } from './live-rounds';
import { liveQR } from './live-qr';

test('isolates rounds, replaces one browser vote, freezes and expires',()=>{
 let now=100; const rounds=new LiveRounds(()=>now);
 const a=rounds.start('demo-housing','presenter-identity-123'), b=rounds.start('demo-housing','presenter-identity-123');
 expect(a.total).toBe(0);expect(a.item.support).toBe(0);
 rounds.vote(a.code,'phone',1);rounds.vote(a.code,'phone',1);rounds.vote(a.code,'phone',-1);
 expect(rounds.snapshot(a.code,'phone')).toMatchObject({total:1,choice:-1,item:{support:0,oppose:1}});
 expect(rounds.snapshot(b.code,'phone').total).toBe(0);
 expect(()=>rounds.end(a.code,'phone')).toThrow('Only the starting browser');
 rounds.end(a.code,'presenter-identity-123');expect(()=>rounds.vote(a.code,'phone',0)).toThrow('ended');
 now+=7200000;expect(rounds.snapshot(b.code,'presenter-identity-123').endedAt).toBe(b.expiresAt);
 expect(()=>rounds.vote(b.code,'phone',1)).toThrow('ended');
 expect(()=>rounds.start('unknown','presenter-identity-123')).toThrow();
});

test('30 concurrent phones stream a coalesced snapshot within one second and reconnect',async()=>{
 const rounds=new LiveRounds(), a=rounds.start('demo-housing','presenter-identity-123');
 const abort=new AbortController();const reader=rounds.events(a.code,'presenter-identity-123',abort.signal).body!.getReader();
 await reader.read();const started=performance.now();
 await Promise.all(Array.from({length:30},async(_,i)=>rounds.vote(a.code,'phone'+i,i%3===0?1:i%3===1?-1:0)));
 const message=new TextDecoder().decode((await reader.read()).value);
 expect(performance.now()-started).toBeLessThan(1000);
 const snapshot=JSON.parse(message.slice(6));expect(snapshot.total).toBe(30);expect(snapshot.item.support).toBe(10);expect(snapshot.pulses).toEqual([10,10,10]);
 expect(message).not.toContain('phone');expect(message).not.toContain('presenter-identity-123');
 abort.abort();
 const reconnected=rounds.events(a.code,'presenter-identity-123',new AbortController().signal).body!.getReader();
 expect(new TextDecoder().decode((await reconnected.read()).value)).toContain('"total":30');await reconnected.cancel();
});

test('QR is local SVG with a quiet zone and fixed capacity',()=>{
 expect(liveQR('https://dear-congress.fly.dev/live/1234abcd')).toContain('viewBox="0 0 45 45"');
 expect(()=>liveQR('x'.repeat(107))).toThrow('capacity');
});

test('live writes share signed identity, origin checks, bounded JSON and rate limits',async()=>{
 const { createPublicSecurity, publicHandler }=await import('./public-security');
 const security=createPublicSecurity({PUBLIC_IP_LIMIT:'3'});
 let calls=0;
 const request=(body:string,origin?:string)=>new Request('https://example.test/api/live/1234abcd/vote',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{}),'x-voter-id':'forged'},body});
 const handle=(req:Request)=>publicHandler(security,'/api/live/:code/vote','POST',req,'127.0.0.1',()=>{calls++;expect(req.headers.get('x-voter-id')).not.toBe('forged');return Response.json({ok:true});});
 expect((await handle(request('{}','https://evil.test'))).status).toBe(403);
 expect((await handle(request('null'))).status).toBe(400);
 expect((await handle(request('{}'))).headers.get('set-cookie')).toContain('HttpOnly');
 expect((await handle(request('{}'))).status).toBe(429);expect(calls).toBe(1);
});

import {test,expect} from 'bun:test';
import {createAuth} from './auth';
import {GovernanceStore} from './store';
const origin='https://civic.example';
async function login(store:GovernanceStore,id=123) {
 const seen:string[]=[];
 const auth=createAuth({store,origin,clientId:'client',clientSecret:'secret',secure:true,now:()=>100,fetch:(async (input:unknown)=>{seen.push(String(input));return Response.json(seen.length===1?{access_token:'provider-secret'}:{id,login:'github-name'});}) as typeof fetch});
 const start=await auth.handle(new Request(origin+'/api/hbl/auth/login'));
 const state=new URL(start!.headers.get('location')!).searchParams.get('state')!;
 const callback=await auth.handle(new Request(origin+`/api/hbl/auth/callback?state=${state}&code=code`,{headers:{cookie:`hbl_oauth_state=${state}`}}));
 const set=callback!.headers.getSetCookie().find(v=>v.startsWith('hbl_session='))!;
 const cookie=set.split(';')[0]!;
 return {auth,cookie,set,state};
}
test('OAuth uses numeric membership; opaque session and CSRF guard reject spoofing',async()=>{
 const store=new GovernanceStore(':memory:');store.setMembership(123,'roster-alias',true,1);
 const {auth,cookie,set,state}=await login(store);
 expect(set).toContain('HttpOnly');expect(set).toContain('SameSite=Lax');expect(set).toContain('Secure');
 const req=new Request(origin+'/api/hbl/auth/session',{headers:{cookie}}),identity=auth.viewer(req)!;
 expect(identity.id).toBe(123);expect(identity.alias).toBe('roster-alias');expect(cookie).not.toContain('123');
 expect(auth.viewer(new Request(origin,{headers:{'x-github-id':'123','x-voter-id':'123'}}))).toBeNull();
 expect(()=>auth.requireVoter(new Request(origin,{method:'POST',headers:{cookie,origin,'x-csrf-token':'wrong'}}))).toThrow('invalid_csrf');
 expect(()=>auth.requireVoter(new Request(origin,{method:'POST',headers:{cookie,origin:'https://evil.example','x-csrf-token':identity.csrf}}))).toThrow('invalid_origin');
 expect(auth.requireVoter(new Request(origin,{method:'POST',headers:{cookie,origin,'x-csrf-token':identity.csrf}})).id).toBe(123);
 const row=store.db.query('SELECT token_hash FROM sessions').get() as any;expect(row.token_hash).not.toBe(cookie.slice('hbl_session='.length));
 await expect(auth.handle(new Request(origin+`/api/hbl/auth/callback?state=${state}&code=code`,{headers:{cookie:`hbl_oauth_state=${state}`}}))).rejects.toThrow('invalid_oauth_state');
 store.setMembership(123,'roster-alias',false,101);expect(auth.viewer(req)).toBeNull();store.db.close();
});
test('unknown GitHub ID remains unapproved even when login matches approved alias',async()=>{
 const s=new GovernanceStore(':memory:');s.setMembership(1,'github-name',true,1);const {auth,cookie}=await login(s,2);
 const req=new Request(origin,{headers:{cookie}});expect(auth.viewer(req)?.id).toBe(2);expect(()=>auth.requireVoter(req)).toThrow('not_approved');s.db.close();
});
test('expired sessions and bad state fail closed',async()=>{
 const s=new GovernanceStore(':memory:');let time=100;
 const auth=createAuth({store:s,origin,clientId:'x',clientSecret:'x',now:()=>time});
 await expect(auth.handle(new Request(origin+'/api/hbl/auth/callback?state=bad&code=bad'))).rejects.toThrow('invalid_oauth_state');
 const logged=await login(s);expect(logged.auth.viewer(new Request(origin,{headers:{cookie:logged.cookie}}))).not.toBeNull();
 time=8*86400_000;expect(auth.viewer(new Request(origin,{headers:{cookie:logged.cookie}}))).toBeNull();s.db.close();
});
test('OAuth state expires, logout requires valid CSRF, and logout invalidates durable session',async()=>{
 const s=new GovernanceStore(':memory:');let time=100;
 const auth=createAuth({store:s,origin,clientId:'client',clientSecret:'secret',now:()=>time});
 const start=await auth.handle(new Request(origin+'/api/hbl/auth/login'));
 const target=new URL(start!.headers.get('location')!);expect(target.searchParams.get('code_challenge_method')).toBe('S256');
 const state=target.searchParams.get('state')!;time+=600001;
 await expect(auth.handle(new Request(origin+`/api/hbl/auth/callback?state=${state}&code=code`,{headers:{cookie:`hbl_oauth_state=${state}`}}))).rejects.toThrow('invalid_oauth_state');
 s.setMembership(123,'alias',true,1);const logged=await login(s);const req=new Request(origin,{headers:{cookie:logged.cookie}});const csrf=logged.auth.viewer(req)!.csrf;
 await expect(logged.auth.handle(new Request(origin+'/api/hbl/auth/logout',{method:'POST',headers:{cookie:logged.cookie,origin}}))).rejects.toThrow('invalid_csrf');
 const result=await logged.auth.handle(new Request(origin+'/api/hbl/auth/logout',{method:'POST',headers:{cookie:logged.cookie,origin,'x-csrf-token':csrf}}));expect(result?.status).toBe(204);expect(logged.auth.viewer(req)).toBeNull();
 s.db.close();
});

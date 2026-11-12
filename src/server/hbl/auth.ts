import { createHash, randomBytes } from 'node:crypto';
import { GovernanceError, type GovernanceStore } from './store';

export interface Identity { id:number; alias:string; csrf:string }
export interface AuthOptions { store:GovernanceStore; origin:string; clientId:string; clientSecret:string; fetch?:typeof fetch; secure?:boolean; now?:()=>number }
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const opaque=()=>randomBytes(32).toString('base64url');
function cookies(req:Request):Record<string,string> { return Object.fromEntries((req.headers.get('cookie')??'').split(';').flatMap(part=>{const i=part.indexOf('=');return i<0?[]:[[part.slice(0,i).trim(),part.slice(i+1).trim()]];})); }
export function createAuth(options:AuthOptions) {
  const {store,clientId,clientSecret}=options;
  const origin=new URL(options.origin).origin, request=options.fetch??fetch, now=options.now??Date.now;
  const secure=options.secure??process.env.NODE_ENV==='production';
  const cookie=(name:string,value:string,seconds:number)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure?'; Secure':''}`;
  function viewer(req:Request):Identity|null {
    const token=cookies(req).hbl_session; if(!token||token.length>128) return null;
    const row=store.db.query('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').get(hash(token),now()) as any;
    if(!row) return null;
    const member=store.member(row.provider_id); if(!member) return null;
    return {id:member.id,alias:member.alias,csrf:row.csrf};
  }
  function guard(req:Request):void {
    if(req.headers.get('origin')!==origin) throw new GovernanceError(403,'invalid_origin');
    const identity=viewer(req);
    if(!identity) throw new GovernanceError(401,'authentication_required');
    if(req.headers.get('x-csrf-token')!==identity.csrf) throw new GovernanceError(403,'invalid_csrf');
  }
  function requireVoter(req:Request):Identity {
    const identity=viewer(req); if(!identity) throw new GovernanceError(401,'authentication_required');
    if(!store.member(identity.id)?.approved) throw new GovernanceError(403,'not_approved');
    if(!['GET','HEAD','OPTIONS'].includes(req.method)) guard(req);
    return identity;
  }
  const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  async function handle(req:Request):Promise<Response|null> {
    const url=new URL(req.url),route=url.pathname;
    if(!route.startsWith('/api/hbl/auth/')) return null;
    if(route==='/api/hbl/auth/session'&&req.method==='GET') {
      const identity=viewer(req);return json(identity?{authenticated:true,approved:!!store.member(identity.id)?.approved,alias:identity.alias,csrf:identity.csrf}:{authenticated:false,approved:false});
    }
    if(route==='/api/hbl/auth/login'&&req.method==='GET') {
      store.db.query('DELETE FROM sessions WHERE expires_at<=?').run(now());
      if(!clientId||!clientSecret) throw new GovernanceError(503,'oauth_not_configured');
      const state=opaque(),verifier=opaque();
      store.db.query('DELETE FROM oauth_states WHERE expires_at<=?').run(now());
      store.db.query('INSERT INTO oauth_states VALUES(?,?,?)').run(hash(state),verifier,now()+600_000);
      const target=new URL('https://github.com/login/oauth/authorize');
      target.search=new URLSearchParams({client_id:clientId,redirect_uri:`${origin}/api/hbl/auth/callback`,state,scope:'read:user',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
      return new Response(null,{status:302,headers:{Location:target.href,'Set-Cookie':cookie('hbl_oauth_state',state,600),'Cache-Control':'no-store'}});
    }
    if(route==='/api/hbl/auth/callback'&&req.method==='GET') {
      const state=url.searchParams.get('state'),code=url.searchParams.get('code');
      if(!state||state.length>128||!code||code.length>2048||cookies(req).hbl_oauth_state!==state) throw new GovernanceError(400,'invalid_oauth_state');
      const row=store.db.query('DELETE FROM oauth_states WHERE state_hash=? AND expires_at>? RETURNING verifier').get(hash(state),now()) as any;
      if(!row) throw new GovernanceError(400,'invalid_oauth_state');
      const exchange=await request('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,redirect_uri:`${origin}/api/hbl/auth/callback`,code_verifier:row.verifier})});
      if(!exchange.ok) throw new GovernanceError(502,'oauth_exchange_failed');
      const token=await exchange.json() as any;
      if(typeof token.access_token!=='string'||!token.access_token) throw new GovernanceError(502,'oauth_exchange_failed');
      const response=await request('https://api.github.com/user',{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token.access_token}`,'X-GitHub-Api-Version':'2022-11-28'}});
      if(!response.ok) throw new GovernanceError(502,'oauth_identity_failed');
      const user=await response.json() as any;
      if(!Number.isSafeInteger(user.id)||user.id<=0||typeof user.login!=='string'||!(/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/).test(user.login)) throw new GovernanceError(502,'oauth_identity_failed');
      const member=store.member(user.id);
      // Provider login is informational; only the stable numeric ID confers roster membership.
      if(!member) store.setMembership(user.id,user.login,false,now());
      const session=opaque(),csrf=opaque();
      store.db.query('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(session),user.id,csrf,now()+7*86400_000);
      const headers=new Headers({Location:'/vote/happybearlandia', 'Cache-Control':'no-store'});
      headers.append('Set-Cookie',cookie('hbl_session',session,7*86400));headers.append('Set-Cookie',cookie('hbl_oauth_state','',0));
      return new Response(null,{status:302,headers});
    }
    if(route==='/api/hbl/auth/logout'&&req.method==='POST') {
      guard(req); const token=cookies(req).hbl_session;
      if(token) store.db.query('DELETE FROM sessions WHERE token_hash=?').run(hash(token));
      return new Response(null,{status:204,headers:{'Set-Cookie':cookie('hbl_session','',0),'Cache-Control':'no-store'}});
    }
    throw new GovernanceError(405,'method_not_allowed');
  }
  return {handle,viewer,requireVoter,guard};
}

import { REPOSITORIES, isRepoKey, type RepoKey, type ItemKind } from '../../shared/repository-voting';
import { Database } from 'bun:sqlite';
import { randomUUID } from 'node:crypto';
import type { Choice, Feedback, Pull, Tally } from '../../shared/hbl-governance';

export class GovernanceError extends Error {
  constructor(public status:number, public code:string, message=code) { super(message); }
}
export type Member = { id:number; alias:string; approved:boolean; updatedAt:number };
export class GovernanceStore {
  public db:Database;
  constructor(path:string, public repoKey:RepoKey='happybearlandia', public kind:ItemKind='pr') {
    if(!isRepoKey(repoKey)||!['pr','issue'].includes(kind)) throw new GovernanceError(404,'repository_not_allowed');
    const raw = new Database(path, { create:true });
    // One shared identity/100-member roster, isolated per-repository/item data and jobs.
    // Legacy HBL PR tables stay in place, so no destructive migration is necessary.
    const prefix=repoKey==='happybearlandia'&&kind==='pr'?'':`repo_${repoKey}_${kind}_`;
    const scoped=new Set(['pulls','pull_versions','pull_revisions','vote_revisions','votes_lookup','freezes','frozen_pulls','frozen_votes','feedback','outbox','receipts','merge_runs','hbl_sync','hbl_service_nonces','hbl_limits','hbl_batch_runs','hbl_community_votes','hbl_community_vote_revisions','community_revision_lookup','hbl_vote_summaries']);
    const sql=(text:string)=>prefix?text.replace(/'(?:''|[^'])*'|\b[A-Za-z_][A-Za-z_0-9]*\b/g,word=>scoped.has(word)?prefix+word:word):text;
    this.db=new Proxy(raw,{get(target,key){
      if(['query','exec','prepare','run'].includes(String(key))) return (text:string,...args:any[])=>(target as any)[key](sql(text),...args);
      const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
    }});

    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS pulls(number INTEGER PRIMARY KEY,version TEXT NOT NULL,first_seen_at INTEGER NOT NULL,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pull_versions(number INTEGER NOT NULL,version TEXT NOT NULL,data TEXT NOT NULL,first_seen_at INTEGER NOT NULL,PRIMARY KEY(number,version));
      CREATE TABLE IF NOT EXISTS pull_revisions(seq INTEGER PRIMARY KEY AUTOINCREMENT,number INTEGER NOT NULL,data TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS members(id INTEGER PRIMARY KEY,alias TEXT NOT NULL,approved INTEGER NOT NULL,updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS membership_revisions(seq INTEGER PRIMARY KEY AUTOINCREMENT,provider_id INTEGER NOT NULL,alias TEXT NOT NULL,approved INTEGER NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,provider_id INTEGER NOT NULL,csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS oauth_states(state_hash TEXT PRIMARY KEY,verifier TEXT NOT NULL,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS vote_revisions(id INTEGER PRIMARY KEY AUTOINCREMENT,provider_id INTEGER NOT NULL,number INTEGER NOT NULL,version TEXT NOT NULL,choice TEXT NOT NULL CHECK(choice IN ('yes','no')),created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS votes_lookup ON vote_revisions(number,version,provider_id,created_at,id);
      CREATE TABLE IF NOT EXISTS freezes(cutoff INTEGER PRIMARY KEY,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS frozen_pulls(cutoff INTEGER NOT NULL,number INTEGER NOT NULL,version TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(cutoff,number));
      CREATE TABLE IF NOT EXISTS frozen_votes(cutoff INTEGER NOT NULL,provider_id INTEGER NOT NULL,number INTEGER NOT NULL,version TEXT NOT NULL,choice TEXT NOT NULL,PRIMARY KEY(cutoff,provider_id,number,version));
      CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,provider_id INTEGER NOT NULL,number INTEGER NOT NULL,version TEXT NOT NULL,alias TEXT NOT NULL,text TEXT NOT NULL,choice TEXT,consent INTEGER NOT NULL,idempotency_key TEXT NOT NULL,created_at INTEGER NOT NULL,comment_status TEXT NOT NULL DEFAULT 'pending',comment_id INTEGER,comment_url TEXT,intake_status TEXT NOT NULL DEFAULT 'pending',task_url TEXT,error TEXT,UNIQUE(provider_id,idempotency_key));
      CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,feedback_id TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at INTEGER NOT NULL,lease_owner TEXT,lease_until INTEGER,fence INTEGER NOT NULL DEFAULT 0,payload TEXT,error TEXT,UNIQUE(feedback_id,kind));
      CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,kind TEXT NOT NULL,external_id TEXT,data TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS merge_runs(id TEXT PRIMARY KEY,cutoff INTEGER NOT NULL,number INTEGER NOT NULL,version TEXT NOT NULL,status TEXT NOT NULL,lease_owner TEXT,lease_until INTEGER,fence INTEGER NOT NULL DEFAULT 0,outcome TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(cutoff,number));`);
  }
  private atomic<T>(fn:()=>T):T { this.db.exec('BEGIN IMMEDIATE'); try { const value=fn(); this.db.exec('COMMIT'); return value; } catch(e) { this.db.exec('ROLLBACK'); throw e; } }
  upsertPull(pull:Pull,now:number):void {
    this.atomic(()=>{
      const old=this.getPull(pull.number);
      const prior=this.db.query('SELECT first_seen_at FROM pull_versions WHERE number=? AND version=?').get(pull.number,pull.version) as any;
      const firstSeenAt=prior?.first_seen_at ?? (old?.version===pull.version?old.firstSeenAt:now);
      const data=JSON.stringify({...pull,firstSeenAt});
      this.db.query('INSERT INTO pull_revisions(number,data,created_at) VALUES(?,?,?)').run(pull.number,data,now);
      this.db.query('INSERT INTO pull_versions VALUES(?,?,?,?) ON CONFLICT(number,version) DO UPDATE SET data=excluded.data').run(pull.number,pull.version,data,firstSeenAt);
      this.db.query('INSERT INTO pulls VALUES(?,?,?,?) ON CONFLICT(number) DO UPDATE SET version=excluded.version,first_seen_at=excluded.first_seen_at,data=excluded.data').run(pull.number,pull.version,firstSeenAt,data);
    });
  }
  getPull(number:number):Pull|null { const row=this.db.query('SELECT data FROM pulls WHERE number=?').get(number) as any; return row?JSON.parse(row.data):null; }
  listPulls():Pull[] { return (this.db.query('SELECT data FROM pulls ORDER BY number').all() as any[]).map(r=>JSON.parse(r.data)); }
  member(id:number):Member|null { const r=this.db.query('SELECT * FROM members WHERE id=?').get(id) as any; return r?{id:r.id,alias:r.alias,approved:!!r.approved,updatedAt:r.updated_at}:null; }
  rosterCount():number { return (this.db.query('SELECT count(*) AS n FROM members WHERE approved=1').get() as any).n; }
  setMembership(id:number,alias:string,approved:boolean,now:number):Member {
    if(!Number.isSafeInteger(id)||id<=0||!alias.trim()||alias.length>60||!(/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/).test(alias)||(/^[0-9]+$/).test(alias)) throw new GovernanceError(400,'invalid_member');
    return this.atomic(()=>{
      if(approved&&!this.member(id)?.approved&&this.rosterCount()>=100) throw new GovernanceError(409,'roster_full');
      this.db.query('INSERT INTO members VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET alias=excluded.alias,approved=excluded.approved,updated_at=excluded.updated_at').run(id,alias,Number(approved),now);
      this.db.query('INSERT INTO membership_revisions(provider_id,alias,approved,created_at) VALUES(?,?,?,?)').run(id,alias,Number(approved),now);
      if(!approved) this.db.query('DELETE FROM sessions WHERE provider_id=?').run(id);
      return this.member(id)!;
    });
  }
  private approved(id:number):Member { const m=this.member(id); if(!m?.approved) throw new GovernanceError(403,'not_approved'); return m; }
  private current(number:number,version:string):Pull { const p=this.getPull(number); if(!p) throw new GovernanceError(404,'pull_not_found'); if(p.version!==version) throw new GovernanceError(409,'stale_version'); if(p.state!=='open') throw new GovernanceError(409,'pull_closed'); return p; }
  vote(id:number,number:number,version:string,choice:Choice,now:number):void { this.atomic(()=>{ this.approved(id); this.current(number,version); if(choice!=='yes'&&choice!=='no') throw new GovernanceError(400,'invalid_choice'); this.db.query('INSERT INTO vote_revisions(provider_id,number,version,choice,created_at) VALUES(?,?,?,?,?)').run(id,number,version,choice,now); }); }
  choice(id:number,number:number,version:string):Choice|null { return (this.db.query('SELECT choice FROM vote_revisions WHERE provider_id=? AND number=? AND version=? ORDER BY created_at DESC,id DESC LIMIT 1').get(id,number,version) as any)?.choice??null; }
  private ballots(number:number,version:string,cutoff:number):any[] {
    // A voter must be approved at cutoff AND remain approved now. Revocations invalidate historical tallies too.
    return this.db.query(`SELECT v.provider_id,v.choice FROM vote_revisions v JOIN members m ON m.id=v.provider_id AND m.approved=1
      WHERE v.number=? AND v.version=? AND v.created_at<?
      AND v.id=(SELECT x.id FROM vote_revisions x WHERE x.provider_id=v.provider_id AND x.number=v.number AND x.version=v.version AND x.created_at<? ORDER BY x.created_at DESC,x.id DESC LIMIT 1)
      AND (SELECT approved FROM membership_revisions r WHERE r.provider_id=v.provider_id AND r.created_at<? ORDER BY r.created_at DESC,r.seq DESC LIMIT 1)=1`).all(number,version,cutoff,cutoff,cutoff) as any[];
  }
  tally(number:number,version:string,cutoff?:number,_now?:number):Tally {
    const frozen=cutoff!==undefined&&this.db.query('SELECT 1 FROM freezes WHERE cutoff=?').get(cutoff);
    const rows=frozen?this.db.query('SELECT v.choice FROM frozen_votes v JOIN members m ON m.id=v.provider_id AND m.approved=1 WHERE cutoff=? AND number=? AND version=?').all(cutoff!,number,version) as any[]:this.ballots(number,version,cutoff??Number.MAX_SAFE_INTEGER);
    const feedback=(this.db.query('SELECT count(*) n FROM feedback f JOIN members m ON m.id=f.provider_id AND m.approved=1 WHERE number=? AND version=? AND created_at<?').get(number,version,cutoff??Number.MAX_SAFE_INTEGER) as any).n;
    return {yes:rows.filter(r=>r.choice==='yes').length,no:rows.filter(r=>r.choice==='no').length,participation:rows.length,feedback};
  }
  freeze(cutoff:number,now:number):Pull[] {
    this.atomic(()=>{
      if(this.db.query('SELECT 1 FROM freezes WHERE cutoff=?').get(cutoff)) return;
      this.db.query('INSERT INTO freezes VALUES(?,?)').run(cutoff,now);
      const historical=(this.db.query(`SELECT r.data FROM pull_revisions r WHERE r.created_at<? AND r.seq=(SELECT x.seq FROM pull_revisions x WHERE x.number=r.number AND x.created_at<? ORDER BY x.created_at DESC,x.seq DESC LIMIT 1)`).all(cutoff,cutoff) as any[]).map(r=>JSON.parse(r.data) as Pull);
      for(const p of historical) {
        if(p.firstSeenAt>=cutoff) continue;
        this.db.query('INSERT INTO frozen_pulls VALUES(?,?,?,?)').run(cutoff,p.number,p.version,JSON.stringify(p));
        for(const v of this.ballots(p.number,p.version,cutoff)) this.db.query('INSERT INTO frozen_votes VALUES(?,?,?,?,?)').run(cutoff,v.provider_id,p.number,p.version,v.choice);
      }
    });
    return (this.db.query('SELECT data FROM frozen_pulls WHERE cutoff=? ORDER BY number').all(cutoff) as any[]).map(r=>JSON.parse(r.data));
  }
  createFeedback(id:number,number:number,version:string,text:string,consent:boolean,key:string,now:number):Feedback {
    return this.atomic(()=>{
      const member=this.approved(id); if(!key||key.length>200) throw new GovernanceError(400,'invalid_idempotency_key');
      const existing=this.db.query('SELECT * FROM feedback WHERE provider_id=? AND idempotency_key=?').get(id,key) as any;
      if(existing) { if(existing.number!==number||existing.version!==version||existing.text!==text.trim()||!!existing.consent!==consent) throw new GovernanceError(409,'idempotency_conflict'); return this.mapFeedback(existing); }
      this.current(number,version); if(!text.trim()||text.trim().length>10000||!consent) throw new GovernanceError(400,'invalid_feedback');
      const feedbackId=randomUUID();
      this.db.query('INSERT INTO feedback(id,provider_id,number,version,alias,text,choice,consent,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(feedbackId,id,number,version,member.alias,text.trim(),this.choice(id,number,version),1,key,now);
      this.db.query('INSERT INTO outbox(id,feedback_id,kind,next_attempt_at) VALUES(?,?,?,?)').run(randomUUID(),feedbackId,'comment',now);
      return this.mapFeedback(this.db.query('SELECT * FROM feedback WHERE id=?').get(feedbackId));
    });
  }
  private mapFeedback(r:any):Feedback { return {id:r.id,number:r.number,version:r.version,alias:r.alias,text:r.text,choice:r.choice,createdAt:r.created_at,commentStatus:r.comment_status,commentUrl:r.comment_url,intakeStatus:r.intake_status==='pending'&&(this.repoKey!=='happybearlandia'||this.kind==='issue')?'not-configured':r.intake_status,taskUrl:r.task_url,...(r.error?{error:r.error}:{})}; }
  feedback(number:number,providerId?:number):Feedback[] { return (providerId===undefined?this.db.query('SELECT * FROM feedback WHERE number=? ORDER BY created_at,id').all(number):this.db.query('SELECT * FROM feedback WHERE number=? AND provider_id=? ORDER BY created_at,id').all(number,providerId)).map(r=>this.mapFeedback(r)); }
}
export { GovernanceStore as Store };

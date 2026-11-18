import { Database } from 'bun:sqlite';
import { timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { originalReviewBills, type CatalogBill } from '../shared/bill-catalog';

export type ReviewRole = 'legal'|'evidence'|'fiscal'|'editorial'|'publisher';
export type ReviewDecision = 'approved'|'changes_requested'|'declined';
export type Reviewer = { id:string; name:string; token:string; roles:ReviewRole[] };
const categories:ReviewRole[]=['legal','evidence','fiscal','editorial','publisher'];
const requiredReviews:ReviewRole[]=['legal','evidence','fiscal','editorial'];
export function configuredReviewers(raw=process.env.CATALOG_REVIEWERS ?? ''): Reviewer[] {
  if (!raw) return [];
  try {
    const rows=JSON.parse(raw); if(!Array.isArray(rows)) return [];
    return rows.filter((x:any)=>x&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.token==='string'&&x.token.length>=32&&Array.isArray(x.roles)&&x.roles.every((r:string)=>categories.includes(r as ReviewRole)));
  } catch { return []; }
}
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export class CatalogReviewStore {
  readonly db:Database;
  constructor(path=process.env.CATALOG_REVIEW_DB ?? (process.env.DB_PATH ? `${process.env.DB_PATH}.catalog-review.sqlite` : process.env.NODE_ENV==='production'?'/data/catalog-review.sqlite':'data/catalog-review.sqlite'), readonly reviewers=configuredReviewers()) {
    mkdirSync(dirname(path),{recursive:true}); this.db=new Database(path,{create:true}); this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;');
    try {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reviewer_identities(id TEXT PRIMARY KEY,name TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS reviewer_roles(reviewer_id TEXT NOT NULL REFERENCES reviewer_identities(id),role TEXT NOT NULL,PRIMARY KEY(reviewer_id,role));
      CREATE TABLE IF NOT EXISTS bill_revisions(id TEXT PRIMARY KEY,bill_id TEXT NOT NULL,revision TEXT NOT NULL,jurisdiction TEXT NOT NULL,title TEXT NOT NULL,problem TEXT NOT NULL,proposed_change TEXT NOT NULL,safeguards TEXT NOT NULL,metrics TEXT NOT NULL,source_kind TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(bill_id,revision));
      CREATE TABLE IF NOT EXISTS review_submissions(id TEXT PRIMARY KEY,bill_id TEXT NOT NULL,revision TEXT NOT NULL,jurisdiction TEXT NOT NULL,category TEXT NOT NULL,findings TEXT NOT NULL,sources TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS review_decisions(id TEXT PRIMARY KEY,bill_id TEXT NOT NULL,revision TEXT NOT NULL,jurisdiction TEXT NOT NULL,category TEXT NOT NULL,decision TEXT NOT NULL,reason TEXT NOT NULL,sources TEXT NOT NULL,reviewer_id TEXT NOT NULL REFERENCES reviewer_identities(id),created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS publication_decisions(id TEXT PRIMARY KEY,bill_id TEXT NOT NULL,revision TEXT NOT NULL,jurisdiction TEXT NOT NULL,status TEXT NOT NULL,reason TEXT NOT NULL,reviewer_id TEXT NOT NULL REFERENCES reviewer_identities(id),created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit_events(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,action TEXT NOT NULL,bill_id TEXT NOT NULL,revision TEXT NOT NULL,jurisdiction TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL);`);
    this.db.exec(`CREATE TRIGGER IF NOT EXISTS immutable_bill_revisions_update BEFORE UPDATE ON bill_revisions BEGIN SELECT RAISE(ABORT,'bill revisions are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_bill_revisions_delete BEFORE DELETE ON bill_revisions BEGIN SELECT RAISE(ABORT,'bill revisions are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_review_decisions_update BEFORE UPDATE ON review_decisions BEGIN SELECT RAISE(ABORT,'review decisions are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_review_decisions_delete BEFORE DELETE ON review_decisions BEGIN SELECT RAISE(ABORT,'review decisions are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_audit_events_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'audit events are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_audit_events_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'audit events are append-only'); END;`);
    this.db.exec(`CREATE TRIGGER IF NOT EXISTS immutable_publication_decisions_update BEFORE UPDATE ON publication_decisions BEGIN SELECT RAISE(ABORT,'publication decisions are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_publication_decisions_delete BEFORE DELETE ON publication_decisions BEGIN SELECT RAISE(ABORT,'publication decisions are append-only'); END;`);
    this.db.query('INSERT OR IGNORE INTO schema_migrations VALUES(1,?)').run(new Date().toISOString());
    const tx=this.db.transaction(()=>{ for(const b of originalReviewBills) this.db.query(`INSERT OR IGNORE INTO bill_revisions VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(`${b.id}:${b.revision}`,b.id,b.revision,b.jurisdiction,b.title,b.problem,b.proposedChange,b.safeguards,b.metrics,'eudaimonia-100',new Date().toISOString()); for(const r of reviewers){this.db.query('INSERT INTO reviewer_identities VALUES(?,?,?,1) ON CONFLICT(id) DO UPDATE SET name=excluded.name,token_hash=excluded.token_hash,active=1').run(r.id,r.name,digest(r.token)); for(const role of r.roles)this.db.query('INSERT OR IGNORE INTO reviewer_roles VALUES(?,?)').run(r.id,role);} }); tx();
    this.db.exec('COMMIT;');
    } catch (error) { try { this.db.exec('ROLLBACK;'); } catch {} throw error; }
  }
  private authorized(id: string, role?: ReviewRole) {
    const configured = this.reviewers.find(row => row.id === id && (!role || row.roles.includes(role)));
    if (!configured) return false;
    const identity = this.db.query('SELECT token_hash,active FROM reviewer_identities WHERE id=?').get(id) as { token_hash: string; active: number } | null;
    return identity?.active === 1 && identity.token_hash === digest(configured.token);
  }
  private latestReviews(bill: CatalogBill) {
    return requiredReviews.map(category => this.db.query(
      'SELECT id,decision,reviewer_id,created_at FROM review_decisions WHERE bill_id=? AND revision=? AND jurisdiction=? AND category=? ORDER BY rowid DESC LIMIT 1'
    ).get(bill.id, bill.revision, bill.jurisdiction, category) as { id: string; decision: string; reviewer_id: string; created_at: string } | null);
  }
  reviewer(req:Request, role?:ReviewRole){const h=req.headers.get('authorization')??'';if(!h.startsWith('Bearer '))return null;const token=h.slice(7);for(const r of this.reviewers){const a=Buffer.from(digest(token)),b=Buffer.from(digest(r.token));if(a.length===b.length&&timingSafeEqual(a,b)&&this.authorized(r.id,role))return r;}return null;}
  queue(){return originalReviewBills.map(b=>({id:b.id,title:b.title,revision:b.revision,jurisdiction:b.jurisdiction,snapshot:this.db.query('SELECT problem,proposed_change,safeguards,metrics FROM bill_revisions WHERE bill_id=? AND revision=?').get(b.id,b.revision),decisions:this.db.query('SELECT category,decision,reason,sources,reviewer_id,created_at FROM review_decisions WHERE bill_id=? AND revision=? ORDER BY created_at DESC').all(b.id,b.revision),submissions:this.db.query("SELECT id,category,findings,sources,status,created_at FROM review_submissions WHERE bill_id=? AND revision=? ORDER BY created_at DESC").all(b.id,b.revision),publication:this.db.query('SELECT status,reason,reviewer_id,created_at FROM publication_decisions WHERE bill_id=? AND revision=? ORDER BY created_at DESC LIMIT 1').get(b.id,b.revision)}));}
  submit(body:any){const b=originalReviewBills.find(x=>x.id===body.billId);if(!b||body.revision!==b.revision||body.jurisdiction!==b.jurisdiction)throw Error('Stale or unknown bill revision');if(!categories.slice(0,4).includes(body.category))throw Error('Choose legal, evidence, fiscal, or editorial');if(typeof body.findings!=='string'||body.findings.trim().length<20||body.findings.length>10000)throw Error('Findings must be 20–10000 characters');const sources=body.sources??[];if(!Array.isArray(sources)||sources.length>20||sources.some((x:any)=>typeof x!=='string'||x.length>2048||!/^https:\/\//.test(x)))throw Error('Sources must be HTTPS links, up to 20');const id=randomUUID(),now=new Date().toISOString();const tx=this.db.transaction(()=>{this.db.query('INSERT INTO review_submissions VALUES(?,?,?,?,?,?,?,\'pending\',?)').run(id,b.id,b.revision,b.jurisdiction,body.category,body.findings.trim(),JSON.stringify(sources),now);this.db.query('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),'public:anonymous','review:suggestion_submitted',b.id,b.revision,b.jurisdiction,JSON.stringify({submissionId:id,category:body.category}),now);});tx();return {id,status:'pending'};}
  decide(req:Request,billId:string,body:any){const reviewer=this.reviewer(req,body.category);if(!reviewer)throw Object.assign(Error('Reviewer authentication or role required'),{status:401});const b=originalReviewBills.find(x=>x.id===billId);if(!b||body.revision!==b.revision||body.jurisdiction!==b.jurisdiction)throw Object.assign(Error('Stale or unknown bill revision'),{status:409});if(!requiredReviews.includes(body.category)||!['approved','changes_requested','declined'].includes(body.decision)||typeof body.reason!=='string'||body.reason.trim().length<10)throw Error('Valid review category, decision, and rationale required');const sources=body.sources??[];if(!Array.isArray(sources)||sources.length>20||sources.some((x:any)=>typeof x!=='string'||x.length>2048||!/^https:\/\//.test(x)))throw Error('Review sources must be HTTPS links, up to 20');const id=randomUUID(),now=new Date().toISOString();const tx=this.db.transaction(()=>{this.db.query('INSERT INTO review_decisions VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,b.id,b.revision,b.jurisdiction,body.category,body.decision,body.reason.trim(),JSON.stringify(sources),reviewer.id,now);this.db.query('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),reviewer.id,`review:${body.category}:${body.decision}`,b.id,b.revision,b.jurisdiction,JSON.stringify({decisionId:id,reason:body.reason.trim()}),now);});tx();return {id,reviewer:reviewer.name,createdAt:now};}

  /**
   * The ballot service trusts only a publisher's durable review_ready receipt
   * that names the exact four latest approval IDs. Suggestions never enter this
   * gate. A later assessment invalidates the receipt until a human re-attests.
   */
  ballotReview(bill: CatalogBill) {
    const original = originalReviewBills.find(row => row.id === bill.id);
    const blocked = { reviewReady: false as const };
    if (bill.id === 'HFL-051') return blocked; // Separate supplement has no authenticated revision binding yet.
    if (!original || original.revision !== bill.revision || original.jurisdiction !== bill.jurisdiction) return blocked;
    const publication = this.db.query(
      "SELECT id,status,reviewer_id FROM publication_decisions WHERE bill_id=? AND revision=? AND jurisdiction=? ORDER BY rowid DESC LIMIT 1"
    ).get(bill.id, bill.revision, bill.jurisdiction) as { id: string; status: string; reviewer_id: string } | null;
    if (!publication || publication.status !== 'review_ready' || !this.authorized(publication.reviewer_id, 'publisher')) return blocked;
    const audit = this.db.query(
      "SELECT actor_id,details FROM audit_events WHERE action='publication:review_ready' AND bill_id=? AND revision=? AND jurisdiction=? ORDER BY rowid DESC LIMIT 1"
    ).get(bill.id, bill.revision, bill.jurisdiction) as { actor_id: string; details: string } | null;
    let receipt: { publicationId?: string; approvedDecisionIds?: string[] };
    try { receipt = JSON.parse(audit?.details ?? 'null') ?? {}; } catch { return blocked; }
    if (audit?.actor_id !== publication.reviewer_id || receipt.publicationId !== publication.id || !Array.isArray(receipt.approvedDecisionIds) || receipt.approvedDecisionIds.length !== 4) return blocked;
    const decisions = this.latestReviews(bill);
    if (decisions.some((row, index) => !row || row.decision !== 'approved' ||
      !this.authorized(row.reviewer_id, requiredReviews[index]) || row.reviewer_id === publication.reviewer_id ||
      row.id !== receipt.approvedDecisionIds![index])) return blocked;
    return { reviewReady: true as const, review: {
      id: bill.id, revision: bill.revision, jurisdiction: bill.jurisdiction,
      provenance: 'catalog_review_sqlite_v1' as const,
      publicationDecisionId: publication.id,
      approvals: decisions.map((row, index) => ({ id: row!.id, category: requiredReviews[index]!, reviewerId: row!.reviewer_id, recordedAt: row!.created_at })),
    } };
  }
  publish(req: Request, billId: string, body: any) {
    const reviewer = this.reviewer(req, 'publisher');
    if (!reviewer) throw Object.assign(Error('Authorized publisher required'), { status: 401 });
    const bill = originalReviewBills.find(row => row.id === billId);
    if (!bill || body.revision !== bill.revision || body.jurisdiction !== bill.jurisdiction)
      throw Object.assign(Error('Stale or unknown bill revision'), { status: 409 });
    if (bill.id === 'HFL-051') throw Object.assign(Error('Separate supplement review required'), { status: 409 });
    if (typeof body.reason !== 'string' || body.reason.trim().length < 10) throw Error('Publication rationale is required');
    return this.db.transaction(() => {
      const verified = this.latestReviews(bill);
      verified.forEach((row, index) => {
        if (!row || row.decision !== 'approved' || !this.authorized(row.reviewer_id, requiredReviews[index]))
          throw Object.assign(Error(`Publication blocked: ${requiredReviews[index]} review is not approved`), { status: 409 });
        if (row.reviewer_id === reviewer.id) throw Object.assign(Error('Separate human publisher required'), { status: 409 });
      });
      const ready = this.ballotReview(bill);
      if (ready.reviewReady) return { id: ready.review.publicationDecisionId, status: 'review_ready', ballotsOpened: false };
      const id = randomUUID(), now = new Date().toISOString();
      this.db.query('INSERT INTO publication_decisions VALUES(?,?,?,?,?,?,?,?)').run(id,bill.id,bill.revision,bill.jurisdiction,'review_ready',body.reason.trim(),reviewer.id,now);
      this.db.query('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),reviewer.id,'publication:review_ready',bill.id,bill.revision,bill.jurisdiction,JSON.stringify({publicationId:id,ballotsOpened:false,approvedDecisionIds:verified.map(row=>row!.id)}),now);
      return { id, status: 'review_ready', ballotsOpened: false, createdAt: now };
    })();
  }
  close(){this.db.close();}
}

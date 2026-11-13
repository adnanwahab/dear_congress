import { createHash, randomBytes } from 'node:crypto';
import type { GovernanceStore } from './store';

/** Browser-scoped community preferences never enter the verified merge electorate. */
export function createCommunityVotes(store: GovernanceStore, secure: boolean) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS hbl_community_votes (
    voter TEXT NOT NULL, number INTEGER NOT NULL, version TEXT NOT NULL,
    choice TEXT NOT NULL CHECK(choice IN ('yes','no')), updated_at INTEGER NOT NULL,
    PRIMARY KEY(voter,number,version)
  )`);
  store.db.exec(`CREATE TABLE IF NOT EXISTS hbl_community_vote_revisions(seq INTEGER PRIMARY KEY AUTOINCREMENT,voter TEXT NOT NULL,number INTEGER NOT NULL,version TEXT NOT NULL,choice TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS community_revision_lookup ON hbl_community_vote_revisions(voter,number,version,created_at,seq);
    INSERT INTO hbl_community_vote_revisions(voter,number,version,choice,created_at) SELECT voter,number,version,choice,updated_at FROM hbl_community_votes v WHERE NOT EXISTS(SELECT 1 FROM hbl_community_vote_revisions r WHERE r.voter=v.voter AND r.number=v.number AND r.version=v.version);`);
  function identity(req: Request) {
    const existing = req.headers.get('cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith('hbl_community='))?.slice('hbl_community='.length);
    const token = existing && /^[a-f0-9]{64}$/.test(existing) ? existing : randomBytes(32).toString('hex');
    return { id: createHash('sha256').update(token).digest('hex'), cookie: existing === token ? null : `hbl_community=${token}; Path=/api/hbl; HttpOnly; SameSite=Lax; Max-Age=31536000${secure ? '; Secure' : ''}` };
  }
  function read(number: number, version: string, voter: string) {
    const totals = store.db.query(`SELECT COALESCE(SUM(choice='yes'),0) AS yes, COALESCE(SUM(choice='no'),0) AS no, COUNT(*) AS participation FROM hbl_community_votes WHERE number=? AND version=?`).get(number, version) as {yes:number;no:number;participation:number};
    const saved = store.db.query('SELECT choice FROM hbl_community_votes WHERE voter=? AND number=? AND version=?').get(voter, number, version) as {choice:'yes'|'no'} | null;
    return { ...totals, choice: saved?.choice ?? null };
  }
  function vote(voter: string, number: number, version: string, choice: 'yes'|'no', now: number) {
    store.db.transaction(()=>{store.db.query('INSERT INTO hbl_community_votes VALUES(?,?,?,?,?) ON CONFLICT(voter,number,version) DO UPDATE SET choice=excluded.choice,updated_at=excluded.updated_at').run(voter,number,version,choice,now);
    store.db.query('INSERT INTO hbl_community_vote_revisions(voter,number,version,choice,created_at) VALUES(?,?,?,?,?)').run(voter,number,version,choice,now);})();
    return read(number,version,voter);
  }
  function list(offset=0) {
    const rows=store.db.query('SELECT voter,number,version,choice,updated_at FROM hbl_community_votes ORDER BY updated_at DESC,voter,number,version LIMIT 100 OFFSET ?').all(offset) as any[];
    const total=(store.db.query('SELECT COUNT(*) total FROM hbl_community_votes').get() as any).total;
    return {votes:rows.map(r=>({participant:'Guest '+createHash('sha256').update('public:'+r.voter).digest('hex').slice(0,10),number:r.number,version:r.version,choice:r.choice,updatedAt:r.updated_at})),total,nextOffset:offset+rows.length<total?offset+rows.length:null};
  }
  return { identity, read, vote, list };
}

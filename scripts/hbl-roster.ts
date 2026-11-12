/** Local operator CLI. Numeric provider IDs stay in the private SQLite roster. */
import { GovernanceStore } from '../src/server/hbl/store';
const [action,idText,alias]=process.argv.slice(2);
const id=Number(idText);
if(!['approve','revoke','count'].includes(action??'')||(action!=='count'&&(!Number.isSafeInteger(id)||id<=0||!alias))) {
 console.error('Usage: HBL_DB_PATH=/private/path/hbl.sqlite bun scripts/hbl-roster.ts approve|revoke NUMERIC_GITHUB_ID "Public alias"\n       HBL_DB_PATH=/private/path/hbl.sqlite bun scripts/hbl-roster.ts count');process.exit(1);
}
const path=process.env.HBL_DB_PATH;
if(!path) {console.error('HBL_DB_PATH must name the private governance SQLite database');process.exit(1);}
const store=new GovernanceStore(path);
try {if(action!=='count') store.setMembership(id,alias!,action==='approve',Date.now());console.log(`Approved roster: ${store.rosterCount()}/100`);}
finally {store.db.close();}

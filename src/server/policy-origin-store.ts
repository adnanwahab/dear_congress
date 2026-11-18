/** Isolated integration-owner adapter. No route mounting, HBL calls or acceptance grants. */
import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {policyDemo, POLICY_DEMO_SOURCE, type PolicyDemo} from '../shared/policy-demo-catalog';
import type {CitizenProposalRecord} from '../shared/citizen-proposals';
import type {PolicyImpactPayload} from '../shared/policy-preview';
import {publishCitizenProposal, CitizenProposalError, type CitizenProposalStore} from './citizen-proposals';
import {canonical, digest, makeVersion, ownsProposal, saveVersion, versions, legalDiff} from './policy-preview';

export const POLICY_BASELINE = Object.freeze({clauseId:'template-baseline',
  text:'Illustrative prior proposal: no added policy authorization. This is proposed text, not enacted law.'});
function fail(message:string):never {throw new CitizenProposalError(message,409);}
const hash = (value:unknown) => digest(canonical(value));
interface Binding {
  proposalId:string; ownerHash:string; templateId:string; source:string;
  baseline:string; proposal:string; bindingHash:string;
}
/** The store and persist callback must come from the existing server-owned JSON
 * repository, never request JSON. persist must acknowledge an actual durable save.
 * A JSON save followed by SQLite failure may leave an unbound proposal; that state
 * is fail-closed and an exact idempotent create can repair it. No distributed
 * transaction or production durability is claimed. */
export class PolicyOriginStore {
  readonly db:Database;
  constructor(path:string, private readonly proposals:CitizenProposalStore,
    private readonly persist:()=>Promise<void>, private readonly siteOrigin:string) {
    const url=new URL(siteOrigin);
    if((url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname))) ||
      url.username||url.password||url.pathname!=='/'||url.search||url.hash) fail('A configured Civic origin is required');
    this.siteOrigin=url.origin;
    if(!path || path===':memory:') throw Error('An explicit separate persistent origin database is required');
    mkdirSync(dirname(path),{recursive:true});
    this.db=new Database(path,{create:true});
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS policy_catalog_origins(
        proposalId TEXT PRIMARY KEY, ownerHash TEXT NOT NULL, templateId TEXT NOT NULL,
        source TEXT NOT NULL, baseline TEXT NOT NULL, proposal TEXT NOT NULL, bindingHash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS policy_transfer_consents(
        id TEXT PRIMARY KEY, proposalId TEXT NOT NULL REFERENCES policy_catalog_origins(proposalId),
        payloadHash TEXT NOT NULL, ownerHash TEXT NOT NULL, recordedAt TEXT NOT NULL,
        UNIQUE(proposalId,payloadHash,ownerHash));
      CREATE TRIGGER IF NOT EXISTS policy_origin_no_update BEFORE UPDATE ON policy_catalog_origins
        BEGIN SELECT RAISE(ABORT,'catalog origins are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS policy_origin_no_delete BEFORE DELETE ON policy_catalog_origins
        BEGIN SELECT RAISE(ABORT,'catalog origins are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS policy_consent_no_update BEFORE UPDATE ON policy_transfer_consents
        BEGIN SELECT RAISE(ABORT,'transfer consent is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS policy_consent_no_delete BEFORE DELETE ON policy_transfer_consents
        BEGIN SELECT RAISE(ABORT,'transfer consent is append-only'); END;`);
  }
  private row(id:string){return this.db.query('SELECT * FROM policy_catalog_origins WHERE proposalId=?').get(id) as Binding|null;}
  private expected(demo:PolicyDemo){
    if(demo.input.legal.clauses.some(c=>c.operation!=='add'||c.beforeText!==''||String(c.clauseId)===POLICY_BASELINE.clauseId))
      fail('This baseline adapter supports exact added-clause templates only');
    return {
    baseline:[{...POLICY_BASELINE}],
    proposal:[{...POLICY_BASELINE},...demo.input.legal.clauses.map(c=>({clauseId:c.clauseId,text:c.afterText}))],
  };}
  private validate(record:CitizenProposalRecord, demo:PolicyDemo) {
    if(record.provenance!=='synthetic' || record.sourceEntryId || record.supportingInfo ||
      ('visibility' in record && record.visibility!=='public') ||
      ('status' in record && record.status!=='published') || ('private' in record && record.private===true))
      fail('Only the public server-created catalog proposal is eligible');
    const history=versions(record), base=history.find(v=>v.version===1), next=history.find(v=>v.version===2);
    if(!base||!next) fail('Saved catalog baseline and proposal versions are required');
    const expected=this.expected(demo);
    for(const [v,number,clauses] of [[base,1,expected.baseline],[next,2,expected.proposal]] as const) {
      if(v.versionId!==`${record.id}:v${number}` || v.type!==demo.input.source.type ||
        v.title!==demo.input.source.title || canonical(v.clauses)!==canonical(clauses) ||
        v.contentHash!==makeVersion(record,number,v.title,v.type,v.clauses).contentHash)
        fail('Edited saved catalog version is not eligible');
    }
    return {base:base!,next:next!};
  }
  /** Called only for an explicit authorized choice of a frozen catalog template.
   * Browser-provided title/mapping/provenance fields are not accepted at all. */
  async create(templateId:string,voter:string,idempotencyKey:string,confirmedPublic:boolean){
    if(confirmedPublic!==true) fail('Explicit public publication consent is required');
    const demo=policyDemo(templateId);if(!demo) return fail('Unknown catalog template');
    const {record,created}=publishCitizenProposal(this.proposals,voter,{
      title:demo.input.source.title,problem:'Illustrative synthetic policy draft; not enacted law or observed evidence.',
      proposedChange:POLICY_BASELINE.text,jurisdiction:'city',confirmedPublic:true,idempotencyKey,
    });
    if(created){
      record.provenance='synthetic';
      record.legalVersions=[makeVersion(record,1,demo.input.source.title,demo.input.source.type,this.expected(demo).baseline)];
      saveVersion(record,voter,{title:demo.input.source.title,type:demo.input.source.type,
        clauses:this.expected(demo).proposal,expectedVersion:1,confirmedPublic:true,idempotencyKey});
    }
    if(!ownsProposal(record,voter)) fail('Publishing browser ownership required');
    const {base,next}=this.validate(record,demo);
    const source=canonical({catalog:POLICY_DEMO_SOURCE,civicOrigin:this.siteOrigin,templateInput:demo.input,templateInputHash:demo.inputHash,
      templateLegalHash:demo.legalHash,modelVersion:demo.modelVersion,mappingVersion:demo.mappingVersion});
    const receipt={proposalId:record.id,ownerHash:record.ownerHash,templateId,source,baseline:canonical(base),proposal:canonical(next)};
    const bindingHash=hash(receipt),old=this.row(record.id);
    if(old && old.bindingHash!==bindingHash) fail('Existing catalog origin does not match this saved revision');
    await this.persist(); // Never authorize a merely in-memory save.
    this.db.transaction(()=>{
      const current=this.row(record.id);
      if(current && current.bindingHash!==bindingHash) fail('Concurrent catalog origin identity conflict');
      this.db.query('INSERT OR IGNORE INTO policy_catalog_origins VALUES(?,?,?,?,?,?,?)')
        .run(receipt.proposalId,receipt.ownerHash,templateId,source,receipt.baseline,receipt.proposal,bindingHash);
    })();
    return {proposalId:record.id,baselineVersionId:base.versionId,proposalVersionId:next.versionId,
      savedContentHash:next.contentHash,bindingHash,templateLegalHash:demo.legalHash};
  }
  /** Resolves trusted saved records on every request, including after restart.
   * Produces only existing-client input; never a pretend remote preview/link. */
  prepare(proposalId:string,voter:string,baseVersion:number,version:number,confirmedPublicTransfer:boolean){
    if(confirmedPublicTransfer!==true) fail('Explicit public transfer consent is required');
    const origin=this.row(proposalId), record=this.proposals.citizenProposals?.find(p=>p.id===proposalId);
    if(!origin||!record) return fail('Trusted persisted catalog origin and saved proposal required');
    if(!ownsProposal(record,voter)||origin.ownerHash!==record.ownerHash) fail('Publishing browser ownership required');
    const demo=policyDemo(origin.templateId);if(!demo) return fail('Unknown stored catalog template');
    const {base,next}=this.validate(record,demo);
    const {bindingHash,...bound}=origin;
    if(hash(bound)!==bindingHash || origin.baseline!==canonical(base)||origin.proposal!==canonical(next))
      fail('Saved version no longer matches immutable origin');
    const source=JSON.parse(origin.source);
    if(source.civicOrigin!==this.siteOrigin || canonical(source.catalog)!==canonical(POLICY_DEMO_SOURCE) ||
      source.modelVersion!==demo.modelVersion || source.mappingVersion!==demo.mappingVersion ||
      source.templateLegalHash!==demo.legalHash || source.templateInputHash!==demo.inputHash ||
      hash(source.templateInput)!==demo.inputHash || hash(source.templateInput.legal)!==demo.legalHash)
      fail('Template provenance mismatch');
    const selectedBase=versions(record).find(v=>v.version===baseVersion), selectedNext=versions(record).find(v=>v.version===version);
    if(!selectedBase||!selectedNext||baseVersion===version) fail('Choose two actual saved versions');
    if(baseVersion!==1||version!==2) return {status:'unsupported' as const,message:'Not Modeled: this revision has no exact catalog mapping.',
      legal:{baseVersionId:selectedBase.versionId,clauses:legalDiff(record,selectedBase,selectedNext)}};
    const legal={baseVersionId:base.versionId,clauses:demo.input.legal.clauses.map(c=>({
      clauseId:c.clauseId,sourcePolicyId:demo.id==='unsupported'?null:c.sourcePolicyId,
      operation:c.operation,beforeText:c.beforeText,afterText:c.afterText,
    }))};
    if(demo.id==='unsupported') return {status:'unsupported' as const,message:'Not Modeled',legal};
    const payload:PolicyImpactPayload={schemaVersion:'policy-impact-preview.v1',
      source:{system:'civic-synthesis',proposalId:record.id,versionId:next.versionId,contentHash:hash(legal),
        type:next.type,title:next.title,url:`${this.siteOrigin}/proposals/${encodeURIComponent(record.id)}/versions/2`,visibility:'public'},
      legal,baseline:{kind:'prior-proposal-version',versionId:base.versionId,label:'Proposed version 1 without added authorization (not enacted law)'},
      simulation:{...demo.input.simulation}};
    const payloadHash=hash(payload);
    this.db.query('INSERT OR IGNORE INTO policy_transfer_consents VALUES(?,?,?,?,?)')
      .run(randomUUID(),proposalId,payloadHash,record.ownerHash,new Date().toISOString());
    return {status:'prepared' as const,payload,bindingHash,templateLegalHash:demo.legalHash,
      savedContentHash:next.contentHash,payloadHash,modelVersion:demo.modelVersion,mappingVersion:demo.mappingVersion};
  }
  close(){this.db.close();}
}

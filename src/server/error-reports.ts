import supplement from '../../content/bill-details/HFL-051.md' with { type: 'text' };
import type { DB } from '../engine/types';
import { DEMO_ITEMS } from '../engine/demo';
import { billCollection } from '../shared/bill-catalog';
import { citizenReportSnapshot, reportRevision, type ErrorTarget } from '../shared/error-reports';
import { readBills } from './legislation/import';
import { boundedJson, PublicInputError } from './public-security';
import { escapeHTML as e } from './pages';

export async function resolveErrorTarget(db: DB, kind: string, id: string) {
  let snapshot: string | undefined, revision: string | undefined;
  if (kind === 'sample' || kind === 'sample-source') {
    const item = DEMO_ITEMS.find(p => p.id === id);
    if (item) snapshot = kind === 'sample' ? JSON.stringify(item) : JSON.stringify([item.sourceUrl, item.background]);
  } else if (kind === 'citizen') {
    const item = db.citizenProposals?.find(p => p.id === id);
    if (item) snapshot = citizenReportSnapshot(item);
  } else if (kind === 'catalog') {
    const item = billCollection.bills.find(p => p.id === id);
    if (item) snapshot = JSON.stringify([item, item.id === 'HFL-051' ? supplement : null]);
  } else if (kind === 'official-metadata') {
    const item = (await readBills(process.env.LEGISLATION_PATH ?? 'data/legislation')).find(p => p.id === id);
    if (item) { snapshot = JSON.stringify(item); revision = item.sourceHash; }
  }
  if (!snapshot) throw new PublicInputError('Public proposal or source not found.', 404);
  return { snapshot, target: { kind, id, revision: revision ?? await reportRevision(snapshot) } };
}
const page = (body: string) => new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Factual error reports</title><style>body{font:18px/1.5 system-ui;max-width:55rem;margin:2rem auto;padding:1rem}textarea,input,select,button{font:inherit;max-width:100%;box-sizing:border-box}textarea{display:block;width:100%}article{border:1px solid;padding:1rem;margin:1rem 0}code,pre{overflow-wrap:anywhere;white-space:pre-wrap}label{display:block;margin:1rem 0}</style><main>${body}<p id="result" role="status"></p></main><script src="/error-reports.js" defer></script></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
export async function errorReportPage(req: Request, db: DB) {
  const q = new URL(req.url).searchParams;
  const { target } = await resolveErrorTarget(db, q.get('kind') ?? '', q.get('id') ?? '');
  if (target.revision !== q.get('revision')) throw new PublicInputError('This revision is no longer current. Reopen the proposal/source and use its Report an error link. No report was submitted.', 409);
  return page(`<h1>Report an error</h1><p>Private human triage for factual errors in this repository’s public content. No automatic correction, vote, endorsement or official determination results. Fictional samples and unreviewed concepts remain labelled as such.</p><p>Target: <code>${e(target.kind)} / ${e(target.id)} @ ${e(target.revision)}</code></p><p>No reporter name, email or browser identity is stored with this report. Do not include personal or identifying information. Report text is visible only to authenticated maintainers; infrastructure may retain ordinary request logs. Keep your receipt ID to cite in a follow-up report. No response time is guaranteed.</p><form data-endpoint="/api/error-reports">${Object.entries(target).map(([k,v]) => `<input type="hidden" name="${k}" value="${e(v)}">`).join('')}<input type="hidden" name="idempotencyKey" value="${crypto.randomUUID()}"><label>What is incorrect? Include the location, supporting evidence or source URL, and suggested correction. Unknown evidence is allowed.<textarea name="reason" required maxlength="4000" rows="8"></textarea></label><button>Submit factual error report</button></form><p><a href="/published">Back to sources</a></p>`);
}
export function errorTriagePage(db: DB) {
  return page(`<h1>Factual error triage</h1><p>Private queue. Notes remain private. Verify evidence and redact identifying details before any separately reviewed public correction. Marking corrected records a human decision; it does not edit content. Preserve the original revision and follow source, safety and editorial review requirements.</p>${(db.errorReports ?? []).map(r => `<article><h2>${e(r.id)}</h2><p><code>${e(r.target.kind)} / ${e(r.target.id)} @ ${e(r.target.revision)}</code> · ${e(r.createdAt)} · ${e(r.status)}</p><p>${e(r.reason)}</p><details><summary>Retained source snapshot</summary><pre>${e(r.snapshot)}</pre></details><pre>${e(JSON.stringify(r.history, null, 2))}</pre><form data-endpoint="/api/admin/error-reports"><input type="hidden" name="id" value="${e(r.id)}"><input type="hidden" name="expectedVersion" value="${r.version}"><label>Status<select name="status">${['pending','reviewing','corrected','declined'].map(s => `<option${s === r.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label><label>Correction / decision note<textarea name="correctionNote" required maxlength="2000">${e(r.correctionNote)}</textarea></label><button>Record decision</button></form></article>`).join('') || '<p>No reports.</p>'}`);
}
export const errorReportScript = `document.querySelectorAll('form[data-endpoint]').forEach(form=>form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;const result=document.getElementById('result');try{const response=await fetch(form.dataset.endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});const data=await response.json();if(!response.ok)throw Error(data.error||'Submission failed');result.textContent=data.id?'Report saved. Receipt: '+data.id+'. Status: '+data.status+'. No automatic correction has been made.':'Decision saved. Reload the queue before another decision.';if(data.id)form.hidden=true;}catch(error){result.textContent=error.message+' Your text remains here. Retry after checking the connection.';button.disabled=false;}}));`;

/** Serialize decisions and rollback failed writes without losing another accepted report. */
export function createErrorReportHandlers(getDB: () => DB, save: () => Promise<void>) {
  let queue: Promise<unknown> = Promise.resolve();
  const transaction = (fn: () => Promise<Response>) => { const next = queue.then(fn); queue = next.catch(() => {}); return next; };
  return {
    submit: async (req: Request) => {
      const b = await boundedJson(req);
      if (!['kind','id','revision','reason','idempotencyKey'].every(k => typeof b[k] === 'string')) throw new PublicInputError('Report target, revision, reason and retry key are required.');
      if (!/^[a-f0-9-]{36}$/i.test(b.idempotencyKey as string) || !(b.reason as string).trim() || (b.reason as string).length > 4000) throw new PublicInputError('Supply a retry key and a report of 1–4000 characters.');
      const target: ErrorTarget = { kind: b.kind as string, id: b.id as string, revision: b.revision as string };
      const reason = (b.reason as string).trim();
      return transaction(async () => {
        const db = getDB();
        const existing = db.errorReports?.find(r => r.id === b.idempotencyKey);
        if (existing) {
          if (JSON.stringify(existing.target) !== JSON.stringify(target) || existing.reason !== reason) throw new PublicInputError('Retry key already used for a different report.', 409);
          return Response.json({ id: existing.id, status: existing.status });
        }
        const resolved = await resolveErrorTarget(db, target.kind, target.id);
        if (resolved.target.revision !== target.revision) throw new PublicInputError('Source revision changed. Reopen the source before reporting.', 409);
        const reports = db.errorReports ??= [];
        const record = { id: b.idempotencyKey as string, target, snapshot: resolved.snapshot, reason, createdAt: new Date().toISOString(), status: 'pending' as const, correctionNote: '', version: 1, history: [] };
        reports.push(record);
        try { await save(); } catch (error) { reports.splice(reports.indexOf(record), 1); throw error; }
        return Response.json({ id: record.id, status: record.status }, { status: 201 });
      });
    },
    decide: async (req: Request) => {
      const b = await boundedJson(req);
      if (!['pending','reviewing','corrected','declined'].includes(b.status as string) || typeof b.correctionNote !== 'string' || !b.correctionNote.trim() || b.correctionNote.length > 2000) throw new PublicInputError('Supply a valid status and a decision note of 1–2000 characters.');
      return transaction(async () => {
        const report = getDB().errorReports?.find(r => r.id === b.id);
        if (!report) throw new PublicInputError('Report not found.', 404);
        if (String(report.version) !== String(b.expectedVersion)) throw new PublicInputError('Queue changed. Reload before deciding.', 409);
        const before = structuredClone(report);
        report.status = b.status as typeof report.status; report.correctionNote = (b.correctionNote as string).trim(); report.version++;
        report.history.push({ status: report.status, note: report.correctionNote, at: new Date().toISOString() });
        try { await save(); } catch (error) { Object.assign(report, before); throw error; }
        return Response.json({ ok: true });
      });
    },
  };
}

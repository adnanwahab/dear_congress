import { CIVIC_STAGES } from "../shared/civic-stages";
import { useId, useState } from 'react';
import { WORKSHOP_AGENDA, workshopExport, workshopNotes, type WorkshopSource } from '../shared/proposal-workshop';
import './proposal-workshop.css';

export function ProposalWorkshop({ source }: { source: WorkshopSource }) {
  const id = useId();
  const [notes, setNotes] = useState(() => workshopNotes(source));
  const [author, setAuthor] = useState('');
  const [consent, setConsent] = useState(false);
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  function exportDraft() {
    let url: string | undefined;
    try {
      const text = workshopExport(source, notes, author);
      url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'workshop-proposal-draft.txt'; link.click();
      setSummary(text); setStatus('Draft download requested. Review the read-only summary before sharing.'); setError('');
    } catch { setError('Download could not start. Your notes remain here; generate a summary and copy its text.'); }
    finally { if (url) { const saved = url; window.setTimeout(() => URL.revokeObjectURL(saved), 1000); } }
  }
  return <section className="cp-panel proposal-workshop" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Design workshop</h2>
    <p>Private facilitator preparation · citizen proposal · no simulated participants. Prepare options alongside the six-stage journey. Stage links below open separate screens; workshop notes are not transferred. No adoption or outcome is implied.</p>
    <nav aria-label="Workshop context">{CIVIC_STAGES.map(stage => <a key={stage.route} href={stage.route}>{stage.n} · {stage.title} </a>)}</nav>
    <p>Notes stay in page memory and are lost on reload. No invitations, public session or shared editing is enabled. Avoid personal information. Sources are unverified; no evidence is fetched.</p>
    <details><summary>Session safety and participation</summary><p>Before a public workshop opens, participants must receive session-specific consent, attribution choices, opt-out and a working abuse-reporting and moderation path. Those services are unavailable here, so public collaboration stays disabled. Do not record another person's words or identity without their permission.</p></details>
    <button type="button" disabled>Public collaboration unavailable</button>
    <label className="cp-field" htmlFor={`${id}-author`}>Facilitator / note author (optional, unverified)<input id={`${id}-author`} maxLength={80} value={author} onChange={e => { setAuthor(e.target.value); setSummary(''); }} /></label>
    <ol>{WORKSHOP_AGENDA.map(([key, label, prompt]) => <li key={key}><label className="cp-field" htmlFor={`${id}-${key}`}><span>{label}</span><small>{prompt}</small><textarea id={`${id}-${key}`} rows={3} maxLength={6000} value={notes[key]} onChange={e => { setNotes({ ...notes, [key]: e.target.value }); setSummary(''); setStatus(''); }} /></label></li>)}</ol>
    <label className="cp-checkbox"><input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setSummary(''); }} /><span>I consent to preparing a summary and export of my notes and chosen attribution. This does not consent for anyone else or publish anything.</span></label>
    <div className="cp-actions"><button type="button" disabled={!consent} onClick={() => { setSummary(workshopExport(source, notes, author)); setStatus('Read-only snapshot ready. Select and copy to share manually; no public link was created.'); }}>Prepare read-only summary</button><button type="button" disabled={!consent} onClick={exportDraft}>Export attributed draft</button><button type="button" onClick={() => { setConsent(false); setNotes(workshopNotes(source)); setAuthor(''); setSummary(''); setError(''); setStatus('Opted out. Workshop notes cleared; the original public source remains. Previously shared files cannot be recalled here.'); }}>Opt out and clear notes</button></div>
    {error && <p role="alert">{error}</p>}<p role="status">{status}</p>
    {summary && <label className="cp-field" htmlFor={`${id}-summary`}>Read-only summary for manual sharing<textarea id={`${id}-summary`} readOnly rows={14} value={summary} /></label>}
  </section>;
}

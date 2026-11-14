import { useEffect, useRef, useState } from 'react';
import { PROPOSAL_JURISDICTIONS } from '../shared/citizen-proposals';
import { blankWorkspace, PROCESS_TEMPLATES, readWorkspace, WORKSPACE_FIELDS, WORKSPACE_KEY, workspaceGaps, workspaceOutline, workspaceSummary, type WorkspaceField, type WorkspaceValues } from './proposal-workspace';

const steps: { title: string; fields: WorkspaceField[] }[] = [
  { title: 'Place and experience', fields: ['title', 'problem', 'affected', 'benefit'] },
  { title: 'Change and trade-offs', fields: ['mechanism', 'authority', 'costs', 'objections'] },
  { title: 'Sources and proposed text', fields: ['sources', 'text'] },
  { title: 'Private review', fields: [] },
];
export default function ProposalWorkspace() {
  const [initial] = useState(() => {
    try { return { draft: readWorkspace(localStorage.getItem(WORKSPACE_KEY)), error: '' }; }
    catch { return { draft: null, error: 'Saved workspace could not be read. It has not been overwritten. Copy your text and recover or clear browser storage before saving.' }; }
  });
  const [values, setValues] = useState<WorkspaceValues>(initial.draft?.values ?? blankWorkspace());
  const [id] = useState(() => initial.draft?.id ?? crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState(initial.draft ? 'Resumed private draft from this browser.' : '');
  const [error, setError] = useState(initial.error);
  const [dirty, setDirty] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const gaps = workspaceGaps(values);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function update(key: keyof WorkspaceValues, value: string) {
    setValues(previous => ({ ...previous, [key]: value })); setDirty(true); setStatus('Unsaved changes.');
  }
  function navigate(next: number) { setStep(next); setTimeout(() => heading.current?.focus(), 0); }
  function save() {
    if (initial.error) return;
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ version: 1, id, savedAt: new Date().toISOString(), values }));
      setDirty(false); setError(''); setStatus('Private draft saved in this browser. Nothing was sent or published.');
    } catch { setError('Could not save: browser storage may be full or disabled. Keep this page open and copy your text before leaving.'); }
  }
  return <section className="cp-panel cp-editor">
    <h1>Propose a change</h1>
    <p>Private drafting pilot · citizen-authored · advisory only. One workspace is saved on this device. Anyone using this browser profile can read it; it is not encrypted or backed up across devices.</p>
    <p>Publication is unavailable here until proposal moderation, consent and live privacy safeguards are verified. No source or legal authority is automatically verified.</p>
    <p>Step {step + 1} of {steps.length}</p>
    <h2 tabIndex={-1} ref={heading}>{steps[step]!.title}</h2>
    {step === 0 && <label className="cp-field" htmlFor="workspace-jurisdiction">Jurisdiction<select id="workspace-jurisdiction" value={values.jurisdiction} onChange={e => update('jurisdiction', e.target.value)}>{PROPOSAL_JURISDICTIONS.map(j => <option key={j} value={j}>{j === 'unsure' ? 'Not sure yet' : j}</option>)}</select></label>}
    <p>{PROCESS_TEMPLATES[values.jurisdiction]} This outline does not establish legal power.</p>
    {steps[step]!.fields.map(field => <label className="cp-field" key={field} htmlFor={`workspace-${field}`}>{WORKSPACE_FIELDS[field]}<textarea id={`workspace-${field}`} rows={4} maxLength={10000} value={values[field]} onChange={e => update(field, e.target.value)} /></label>)}
    {step === 3 && <>
      <h3>Gaps for human review</h3>
      {gaps.length ? <ul>{gaps.map(gap => <li key={gap.field}><button type="button" className="cp-inline-button" onClick={() => { const next = gap.field === 'jurisdiction' ? 0 : steps.findIndex(s => s.fields.includes(gap.field as WorkspaceField)); setStep(next); setTimeout(() => document.getElementById(`workspace-${gap.field}`)?.focus(), 0); }}>{gap.message}</button></li>)}</ul> : <p>No empty fields detected. Costs, sources and authority still require human review.</p>}
      <h3>Plain-English summary · assembled from your words</h3><p style={{ whiteSpace: 'pre-wrap' }}>{workspaceSummary(values)}</p>
      <label className="cp-field" htmlFor="workspace-output">Structured review copy<textarea id="workspace-output" rows={18} readOnly value={workspaceOutline(values)} /></label>
      <p>Edit each section using Back. This is proposed new text, not a legal redline: a verified current-law baseline is still missing. Unknown costs remain unknown.</p>
    </>}
    {error && <p role="alert">{error}</p>}
    <div className="cp-actions"><button type="button" className="cp-button cp-button-secondary" disabled={step === 0} onClick={() => navigate(step - 1)}>Back</button><button type="button" className="cp-button" onClick={save} disabled={!!initial.error}>Save privately</button>{step < 3 && <button type="button" className="cp-button" onClick={() => navigate(step + 1)}>Next</button>}</div>
    <p role="status" aria-live="polite">{status}</p>
    <p><a href="/needs">Needs</a> · <a href="/draft">Sample draft workflow</a> · <a href="/proposals/new">Existing proposal editor and saved drafts</a></p>
  </section>;
}

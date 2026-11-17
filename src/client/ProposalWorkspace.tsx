import { useEffect, useRef, useState } from 'react';
import { PROPOSAL_JURISDICTIONS } from '../shared/citizen-proposals';
import { blankWorkspace, PROCESS_TEMPLATES, WORKSPACE_FIELDS, WORKSPACE_KEY, workspaceGaps, workspaceOutline, workspaceSummary, type WorkspaceField, type WorkspaceValues } from './proposal-workspace';

import { persistWorkspace, readRecovery, revision, type Exclusive } from './workspace-recovery';
import { redline } from './amendment-drafts';

const steps: { title: string; fields: WorkspaceField[] }[] = [
  { title: 'Place and experience', fields: ['title', 'problem', 'affected', 'benefit'] },
  { title: 'Change and trade-offs', fields: ['mechanism', 'authority', 'costs', 'objections'] },
  { title: 'Sources and proposed text', fields: ['sources', 'text'] },
  { title: 'Private review', fields: [] },
];
export default function ProposalWorkspace() {
  const [initial] = useState(() => {
    try { const raw = localStorage.getItem(WORKSPACE_KEY); return { raw, draft: readRecovery(raw), error: '' }; }
    catch { return { raw: null, draft: null, error: 'Saved workspace could not be read. It has not been overwritten. Copy your text and recover or clear browser storage before saving.' }; }
  });
  const [values, setValues] = useState<WorkspaceValues>(blankWorkspace());
  const [id, setId] = useState(() => initial.draft?.id ?? crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('');
  const expected = useRef<string | null>(initial.raw);
  const [pending, setPending] = useState<{ raw: string | null; restore: boolean } | null>(initial.draft ? { raw: initial.raw, restore: true } : null);
  const saving = useRef(false);
  const editVersion = useRef(0);
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
    editVersion.current++; setValues(previous => ({ ...previous, [key]: value })); setDirty(true); setStatus('Unsaved changes.');
  }
  function navigate(next: number) { setStep(next); setTimeout(() => heading.current?.focus(), 0); }
  async function save() {
    if (initial.error || pending || saving.current) return;
    saving.current = true;
    const version = editVersion.current;
    try {
      const exclusive: Exclusive | undefined = navigator.locks?.request.bind(navigator.locks);
      const result = await persistWorkspace(localStorage, exclusive, expected.current, id, values);
      if (result.conflict) { setPending({ raw: result.raw, restore: false }); setStatus('Saved work changed. Compare before choosing.'); }
      else {
        expected.current = result.raw;
        if (version === editVersion.current) setDirty(false);
        setError(''); setStatus('Private draft saved in this browser. Nothing was sent or published.');
      }
    } catch (e) { setError(e instanceof Error ? e.message + ' Copy the recovery text before leaving.' : 'Could not save. Copy the recovery text before leaving.'); }
    finally { saving.current = false; }
  }
  useEffect(() => {
    if (!dirty || pending || initial.error || error) return;
    const timer = setTimeout(() => { void save(); }, 500);
    return () => clearTimeout(timer);
  }, [values, dirty, pending, error]);
  useEffect(() => {
    const check = () => {
      try {
        const raw = localStorage.getItem(WORKSPACE_KEY);
        readRecovery(raw);
        if (raw !== expected.current) setPending({ raw, restore: false });
      } catch { setError('Saved workspace could not be read. It has not been overwritten. Copy the recovery text.'); }
    };
    window.addEventListener('storage', check);
    window.addEventListener('focus', check);
    return () => { window.removeEventListener('storage', check); window.removeEventListener('focus', check); };
  }, []);
  const savedValues = pending ? readRecovery(pending.raw)?.values ?? blankWorkspace() : null;
  function choose(restore: boolean) {
    if (!pending) return;
    expected.current = pending.raw;
    if (restore && savedValues) { const saved = readRecovery(pending.raw); if (saved) setId(saved.id); editVersion.current++; setValues(savedValues); setDirty(false); setStatus('Resumed private draft from this browser.'); }
    else { setDirty(true); setStatus('Current text selected. Save privately or wait for autosave. Earlier saved work is retained in local history.'); }
    setPending(null); setError('');
  }
  return <section className="cp-panel cp-editor">
    <h1>Propose a change</h1>
    <p>Private drafting pilot · citizen-authored · advisory only. One workspace is saved on this device. Anyone using this browser profile can read it; it is not encrypted or backed up across devices.</p>
    <p>Publication is unavailable here until proposal moderation, consent and live privacy safeguards are verified. No source or legal authority is automatically verified.</p>
    {pending && savedValues && <section aria-label="Draft recovery and conflict comparison">
      <h2>{pending.restore ? 'Restore saved private draft?' : 'Saved draft conflict'}</h2>
      <p>Autosave is paused. Compare exact text below, then choose. Nothing is published. Saved revision: {revision(pending.raw) ?? 'empty'}.</p>
      {([...Object.keys(WORKSPACE_FIELDS), 'jurisdiction'] as (keyof WorkspaceValues)[]).filter(key => values[key] !== savedValues[key]).map(key => {
        const diff = redline(savedValues[key], values[key]);
        return <section key={key}><h3>{key === 'jurisdiction' ? 'Jurisdiction' : WORKSPACE_FIELDS[key]}</h3>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>Saved text: {diff.prefix}<del>{diff.removed}</del>{diff.suffix}</p>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>Current text: {diff.prefix}<ins>{diff.added}</ins>{diff.suffix}</p></section>;
      })}
      <div className="cp-actions"><button type="button" className="cp-button" onClick={() => choose(true)}>Use saved text</button><button type="button" className="cp-button" onClick={() => choose(false)}>Keep current text</button></div>
    </section>}
    <p>Autosave runs after a short pause while editing. Saving is local, unencrypted and separate from public submission.</p>
    <label className="cp-field" htmlFor="workspace-recovery-copy">Recovery copy — select and copy all text before leaving if saving fails<textarea id="workspace-recovery-copy" rows={4} readOnly value={JSON.stringify(values, null, 2)} /></label>
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
    <div className="cp-actions"><button type="button" className="cp-button cp-button-secondary" disabled={step === 0} onClick={() => navigate(step - 1)}>Back</button><button type="button" className="cp-button" onClick={save} disabled={!!initial.error || !!pending}>Save privately</button>{step < 3 && <button type="button" className="cp-button" onClick={() => navigate(step + 1)}>Next</button>}</div>
    <p role="status" aria-live="polite">{status}</p>
    <p><a href="/needs">Needs</a> · <a href="/draft">Sample draft workflow</a> · <a href="/proposals/new">Existing proposal editor and saved drafts</a></p>
  </section>;
}

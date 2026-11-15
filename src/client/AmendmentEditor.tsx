import { useId, useRef, useState } from 'react';
import { readAmendments, redline, sameBase, saveAmendment, type AmendmentDraft, type AmendmentFields, type AmendmentSource } from './amendment-drafts';
import './amendment-editor.css';
import { impactCategories, impactExcerpt } from './amendment-impact';
const storage = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
const message = (error: unknown) => error instanceof Error ? error.message : 'Could not save in this browser. Your editing text is still here.';

export function AmendmentComparison({ before, after, beforeId = 'Saved base snapshot', afterId = 'Unsaved working text' }: { before: string; after: string; beforeId?: string; afterId?: string }) {
  const anchorId = useId();
  const diff = redline(before, after);
  return <><div className="amendment-comparison">
    <section><h4>Base proposal text</h4><p>{diff.prefix}{diff.removed && <><span className="amendment-marker">Removed: </span><del>{diff.removed}</del></>}{diff.suffix}</p></section>
    <section><h4>Suggested text</h4><p>{diff.prefix}{diff.added && <><span className="amendment-marker">Added: </span><ins>{diff.added}</ins></>}{diff.suffix}</p></section>
  </div>
    <section aria-label="Plain-language impact comparison">
      <h4>What did this revision change?</h4>
      <p>Before: {beforeId} · After: {afterId}</p>
      <p>{before === after ? 'The text is identical.' : 'The wording changed; the redline above preserves the exact text.'} Legal and practical effects need human review. Private preparation is not verified civic participation.</p>
      <p>Only explicit Scope:, Eligibility:, Cost:, Implementation: and Uncertainties: lines are quoted below. These are author statements, not assessed effects. Citation notes do not verify them.</p>
      {impactCategories.map(category => <section key={category}><h5>{category} · Needs review</h5>
        <div className="amendment-comparison">{([['Before', before, beforeId], ['After', after, afterId]] as const).map(([side, text, revision]) => {
          const anchors = impactExcerpt(text, category);
          return <div key={side}><h6>{side}</h6>{anchors.length ? anchors.map(anchor => {
            const target = `${anchorId}-${side}-${anchor.line}`;
            return <div key={anchor.line}><a href={`#${target}`}>{revision} · line {anchor.line}</a><blockquote id={target} tabIndex={-1} className="amendment-text">{anchor.quote}</blockquote></div>;
          }) : <p>Needs review — no explicit {category.toLowerCase()} statement anchored in this revision. No effect inferred.</p>}</div>;
        })}</div></section>)}
    </section></>;
}

/** Caller keys by kind + ID, so a selection change never carries text across sources. */
export default function AmendmentEditor({ source }: { source: AmendmentSource }) {
  const id = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState(() => ({ ...source }));
  const [fields, setFields] = useState<AmendmentFields>(() => ({ replacement: source.text, rationale: '', impact: '', citation: '' }));
  const [versions, setVersions] = useState<AmendmentDraft[]>([]);
  const [selected, setSelected] = useState<AmendmentDraft | null>(null);
  const [compareBefore, setCompareBefore] = useState('');
  const [compareAfter, setCompareAfter] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const conflict = !sameBase(base, source);
  function show() {
    setOpen(true);
    try { setVersions(readAmendments(storage, source)); setError(''); }
    catch (e) { setError(message(e)); }
  }
  function fail(e: unknown) { setError(message(e)); setStatus(''); window.setTimeout(() => errorRef.current?.focus(), 0); }
  return <section className="amendment-editor" aria-label="Private amendment preparation">
    <button type="button" aria-expanded={open} aria-controls={`${id}-editor`} onClick={show}>Suggest amendment</button>
    {open && <div id={`${id}-editor`}>
      <h2>Prepare a private amendment</h2>
      <p>Saved only in this browser on this device. Nothing is submitted for moderation or published. Moderation must be built before amendments can become separate advisory voting options. Existing votes stay on the original proposal.</p>
      <p>{source.kind === 'sample' ? 'Fictional sample · not legal text' : 'Citizen-authored proposal · official status not verified'} · {source.title} · {source.jurisdiction}</p>
      <p>Origin: {source.origin} · {source.kind}:{source.id}. The whole proposed text is one editable section; clause boundaries are not inferred.</p>
      {conflict && <div role="alert"><p>The source has changed since this draft began. Review the current text below. Earlier versions stay unchanged; nothing is automatically rebased. Starting fresh replaces the unsaved editing fields below.</p><h3>Current source text</h3><p className="amendment-text">{source.text}</p><button type="button" onClick={() => { setBase({ ...source }); setFields({ replacement: source.text, rationale: '', impact: '', citation: '' }); setSelected(null); setError(''); setStatus('Started a fresh amendment against the current source.'); }}>Start fresh against current source</button></div>}
      <form onSubmit={e => {
        e.preventDefault();
        try { const next = saveAmendment(storage, source, base, fields); setVersions(next); setSelected(next[next.length - 1]!); setError(''); setStatus('New private version saved in this browser. Not submitted or published.'); }
        catch (e) { fail(e); }
      }}>
        {(['replacement', 'rationale', 'impact', 'citation'] as const).map(key => <label key={key} htmlFor={`${id}-${key}`}>
          {{ replacement: 'Suggested replacement text', rationale: 'Rationale', impact: 'Impact / cost note (unknown is acceptable)', citation: 'Citation note (title, URL, locator, date and excerpt/version)' }[key]}
          <textarea id={`${id}-${key}`} required rows={key === 'replacement' ? 6 : 3} maxLength={key === 'replacement' ? 10000 : key === 'citation' ? 2000 : 3000} value={fields[key]} onChange={e => { setFields({ ...fields, [key]: e.target.value }); setSelected(null); setStatus(''); }} />
        </label>)}
        <p>Source notes are unverified plain text. Author: This browser · unverified. Publication permission has not been requested or granted.</p>
        <h3>Live comparison against saved base</h3>
        <AmendmentComparison before={base.text} after={fields.replacement} />
        <button type="submit" disabled={conflict}>Save new private version</button>
      </form>
      {error && <p ref={errorRef} tabIndex={-1} role="alert">{error}</p>}<p role="status">{status}</p>
      <h3>Saved private versions</h3>
      <p>Browser storage is editable and can be cleared. These snapshots are not a durable publication audit trail. Saving creates a new version; it never edits an earlier one.</p>
      {versions.length ? <ul>{versions.map((v, index) => <li key={v.id}><button type="button" onClick={() => { setSelected(v); setBase({ ...v.base }); setFields({ replacement: v.replacement, rationale: v.rationale, impact: v.impact, citation: v.citation }); setStatus(`Viewing private version ${index + 1}. Editing and saving will create another version.`); }}>View version {index + 1}</button> <time dateTime={v.savedAt}>{v.savedAt}</time></li>)}</ul> : <p>No versions saved here yet.</p>}
      {versions.length > 0 && <section aria-label="Compare saved revision IDs">
        <h3>Compare saved revision IDs</h3>
        <p>Select two private snapshots. This does not load either into the editing fields.</p>
        {([['Before revision ID', compareBefore, setCompareBefore], ['After revision ID', compareAfter, setCompareAfter]] as const).map(([label, value, update]) => <label key={label}>{label}<select value={value} onChange={e => update(e.target.value)}><option value="">Choose a revision</option>{versions.map(v => <option key={v.id} value={v.id}>{v.id} · {v.savedAt}</option>)}</select></label>)}
        {compareBefore && compareAfter && (() => {
          const a = versions.find(v => v.id === compareBefore), b = versions.find(v => v.id === compareAfter);
          if (!a || !b || !sameBase(a.base, b.base)) return <p role="alert">Needs review — revisions do not share the same source snapshot. Choose revisions from the same base.</p>;
          return <AmendmentComparison before={a.replacement} after={b.replacement} beforeId={a.id} afterId={b.id} />;
        })()}
      </section>}
      {selected && <section aria-label="Saved version details"><h3>Private version {selected.id}</h3><p>{selected.author} · {selected.savedAt} · Publication permission: not requested</p><p>Saved origin: {selected.base.origin} · {selected.base.kind}:{selected.base.id} · {selected.base.title} · {selected.base.jurisdiction}</p><AmendmentComparison before={selected.base.text} after={selected.replacement} afterId={selected.id} /><h4>Rationale</h4><p>{selected.rationale}</p><h4>Impact / cost</h4><p>{selected.impact}</p><h4>Unverified citation note</h4><p>{selected.citation}</p></section>}
    </div>}
  </section>;
}

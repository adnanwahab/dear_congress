import { useEffect, useId, useRef, useState } from 'react';
import { readAmendments, redline, sameBase, saveAmendment, type AmendmentLineage, type AmendmentDraft, type AmendmentFields, type AmendmentSource } from './amendment-drafts';
import './amendment-editor.css';
const storage = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
const message = (error: unknown) => error instanceof Error ? error.message : 'Could not save in this browser. Your editing text is still here.';

export function AmendmentComparison({ before, after }: { before: string; after: string }) {
  const diff = redline(before, after);
  return <div className="amendment-comparison">
    <section><h4>Base proposal text</h4><p>{diff.prefix}{diff.removed && <><span className="amendment-marker">Removed: </span><del>{diff.removed}</del></>}{diff.suffix}</p></section>
    <section><h4>Suggested text</h4><p>{diff.prefix}{diff.added && <><span className="amendment-marker">Added: </span><ins>{diff.added}</ins></>}{diff.suffix}</p></section>
  </div>;
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
  const [event, setEvent] = useState<AmendmentLineage['event']>('revision');
  const [secondParent, setSecondParent] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const conflict = !sameBase(base, source);
  function select(v: AmendmentDraft, navigate = true) {
    setSelected(v); setBase({ ...v.base });
    setFields({ replacement: v.replacement, rationale: v.rationale, impact: v.impact, citation: v.citation });
    setEvent('revision'); setSecondParent('');
    if (navigate) window.history.pushState(null, '', revisionURL(v.id));
    setStatus('Viewing private version. Editing and saving creates a child revision.');
  }
  function revisionURL(revision: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('amendmentSource', JSON.stringify([source.kind, source.id]));
    url.searchParams.set('amendmentRevision', revision);
    return url.pathname + url.search + url.hash;
  }
  useEffect(() => {
    function restore() {
      const params = new URL(window.location.href).searchParams;
      if (params.get('amendmentSource') !== JSON.stringify([source.kind, source.id])) return;
      setOpen(true);
      try {
        const rows = readAmendments(storage, source); setVersions(rows);
        const v = rows.find(row => row.id === params.get('amendmentRevision'));
        if (v) { select(v, false); setError(''); }
        else { setSelected(null); setError('This private revision is unavailable in this browser. Links do not publish or transfer drafts.'); }
      } catch (e) { setError(message(e)); }
    }
    restore(); window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [source.kind, source.id]);
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
      {conflict && <div role="alert"><p>The source has changed since this draft began. Review the current text below. Earlier versions stay unchanged; nothing is automatically rebased. Starting fresh replaces the unsaved editing fields below.</p><h3>Current source text</h3><p className="amendment-text">{source.text}</p><button type="button" onClick={() => { setBase({ ...source }); setFields({ replacement: source.text, rationale: '', impact: '', citation: '' }); setSelected(null); setEvent('revision'); setSecondParent(''); setError(''); setStatus('Started a fresh amendment against the current source.'); }}>Start fresh against current source</button></div>}
      <form onSubmit={e => {
        e.preventDefault();
        try { const next = saveAmendment(storage, source, base, fields, { event, parents: [...(selected ? [selected.id] : []), ...((event === 'merge' || event === 'compromise') && secondParent ? [secondParent] : [])] }); setVersions(next); select(next[next.length - 1]!); setError(''); setStatus('New private version saved in this browser. Not submitted or published.'); }
        catch (e) { fail(e); }
      }}>
        {(['replacement', 'rationale', 'impact', 'citation'] as const).map(key => <label key={key} htmlFor={`${id}-${key}`}>
          {{ replacement: 'Suggested replacement text', rationale: 'Rationale', impact: 'Impact / cost note (unknown is acceptable)', citation: 'Citation note (title, URL, locator, date and excerpt/version)' }[key]}
          <textarea id={`${id}-${key}`} required rows={key === 'replacement' ? 6 : 3} maxLength={key === 'replacement' ? 10000 : key === 'citation' ? 2000 : 3000} value={fields[key]} onChange={e => { setFields({ ...fields, [key]: e.target.value }); setStatus(''); }} />
        </label>)}
        <p>Source notes are unverified plain text. Author: This browser · unverified. Publication permission has not been requested or granted.</p>
        <h3>Live comparison against saved base</h3>
        <AmendmentComparison before={base.text} after={fields.replacement} />
        <label>Relationship to selected parent
          <select aria-label="Revision event" value={event} onChange={e => setEvent(e.target.value as AmendmentLineage['event'])}>
            <option value="revision">Parent revision</option><option value="fork">Fork</option><option value="compromise">Compromise</option><option value="merge">Merge</option>
          </select>
        </label>
        <p>Parent: {selected ? selected.id : 'Source proposal'}. Merge and compromise record your manual text reconciliation, not approval.</p>
        {(event === 'merge' || event === 'compromise') && <label>Second parent
          <select aria-label="Second parent" value={secondParent} onChange={e => setSecondParent(e.target.value)} required>
            <option value="">Choose another saved branch</option>
            {versions.filter(v => v.id !== selected?.id && sameBase(v.base, base)).map(v => <option key={v.id} value={v.id}>{v.id}</option>)}
          </select>
        </label>}
        <button type="submit" disabled={conflict}>Save new private version</button>
      </form>
      {error && <p ref={errorRef} tabIndex={-1} role="alert">{error}</p>}<p role="status">{status}</p>
      <h3>Saved private versions</h3>
      <p>Browser storage is editable and can be cleared. These snapshots are not a durable publication audit trail. Saving creates a new version; it never edits an earlier one.</p>
      <h3>Amendment family tree</h3>
      <p>Private, unreviewed proposal drafts · not enacted law or verified civic participation. Branch links work only where these browser-local records exist. Older snapshots have no recorded ancestry.</p>
      {versions.length > 0 && <svg className="amendment-graph" viewBox={`0 0 240 ${(versions.length + 1) * 36}`} aria-hidden="true" focusable="false">
        <text x="12" y="18">Source proposal · private branches</text>
        {versions.map((v, index) => {
          const x = 24 + (index % 4) * 56, y = (index + 1) * 36;
          return <g key={v.id}>
            {v.lineage && (v.lineage.parents.length ? v.lineage.parents : ['']).map(parent => {
              const p = versions.findIndex(row => row.id === parent);
              const px = p < 0 ? 24 : 24 + (p % 4) * 56, py = p < 0 ? 22 : (p + 1) * 36;
              return <path key={parent} d={`M ${px} ${py} C ${px} ${y - 18}, ${x} ${y - 18}, ${x} ${y}`} />;
            })}
            <circle cx={x} cy={y} r="7" /><text x={x + 10} y={y + 4}>{index + 1}</text>
          </g>;
        })}
      </svg>}
      {versions.length ? <ol className="amendment-tree" aria-label="Revision branches">{versions.map((v, index) => <li key={v.id}>
        <a href={revisionURL(v.id)} aria-current={selected?.id === v.id ? 'true' : undefined} onClick={e => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); select(v); } }}>Branch {index + 1} · {v.lineage?.event ?? 'ancestry unknown'}</a>
        <button type="button" onClick={() => select(v)}>View version {index + 1}</button>
        <time dateTime={v.savedAt}>{v.savedAt}</time>
        <p>Parents: {v.lineage ? (v.lineage.parents.length ? v.lineage.parents.map(parent => <a key={parent} href={revisionURL(parent)} onClick={e => { e.preventDefault(); select(versions.find(row => row.id === parent)!); }}>{parent} </a>) : 'Source proposal') : 'Not recorded'}</p>
      </li>)}</ol> : <p>No versions saved here yet.</p>}
      {selected && <section aria-label="Saved version details"><h3>Private version {selected.id}</h3><p>{selected.author} · {selected.savedAt} · Publication permission: not requested</p><p>Saved origin: {selected.base.origin} · {selected.base.kind}:{selected.base.id} · {selected.base.title} · {selected.base.jurisdiction}</p><AmendmentComparison before={selected.base.text} after={selected.replacement} />{selected.lineage?.parents.map(parent => { const v = versions.find(row => row.id === parent)!; return <section key={parent}><h4>Text changes from parent {parent}</h4><AmendmentComparison before={v.replacement} after={selected.replacement} /></section>; })}<p>Review state: Unreviewed private draft · not submitted · not enacted law</p><h4>Rationale</h4><p>{selected.rationale}</p><h4>Impact / cost</h4><p>{selected.impact}</p><h4>Unverified citation note</h4><p>{selected.citation}</p></section>}
    </div>}
  </section>;
}

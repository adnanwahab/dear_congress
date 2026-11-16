import { requestHaptic } from './haptics';
import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { readAmendments, redline, sameBase, saveAmendment, type AmendmentLineage, type AmendmentDraft, type AmendmentFields, type AmendmentSource } from './amendment-drafts';
import './amendment-editor.css';
const ClauseMarginalia = lazy(() => import('./ClauseMarginalia'));
import { impactCategories, impactExcerpt } from './amendment-impact';
import ClauseReader from './ClauseReader';
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

const DETECTIVE_CASES = [
  { title: 'Permission or duty?', before: 'The fictional library may open a cooling room on heat-alert days.', after: 'The fictional library shall open a cooling room on heat-alert days.', choices: ['Opening becomes a duty on heat-alert days.', 'The room must open every day.', 'Opening is forbidden.'], answer: 0, explanation: '“May” becomes “shall”: the exercise changes permission into a duty, limited by “on heat-alert days”.', edge: 'The clause does not define who issues a heat alert, opening hours, funding or remedies. Those remain unresolved.' },
  { title: 'Who qualifies?', before: 'Residents aged 65 or older may apply for a fictional travel pass.', after: 'Residents aged 60 or older may apply for a fictional travel pass.', choices: ['Every applicant is guaranteed a pass.', 'Residents aged 60–64 become eligible to apply.', 'Only residents aged exactly 60 qualify.'], answer: 1, explanation: 'The lower age threshold expands eligibility to apply to residents aged 60–64. “May apply” does not promise approval.', edge: 'Age 60 is included; age 59 is excluded by this clause. Fees, capacity and other eligibility rules are unspecified.' },
  { title: 'Spot the ambiguity', before: 'The fictional permit office shall reply within 10 calendar days after receiving an application.', after: 'The fictional permit office shall reply promptly after receiving an application.', choices: ['Every application is approved automatically.', 'The deadline becomes exactly one day.', 'The fixed deadline becomes an undefined timing standard.'], answer: 2, explanation: '“Within 10 calendar days” is replaced by “promptly”. The revised clause supplies no numeric deadline; a reply is still required.', edge: 'Ambiguous simulated text: whether 11 days is prompt cannot be determined from this clause alone. A reply is not necessarily approval.' },
] as const;

/** Static fixtures only: no storage, votes, proposal text or model inputs. */
export function RedlineDetective() {
  const id = useId();
  const [round, setRound] = useState(0);
  const [guess, setGuess] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const item = DETECTIVE_CASES[round]!;
  return <details className="redline-detective">
    <summary>Play legislative redline detective · Sandbox</summary>
    <p>Unreviewed demo · fictional clauses, not enacted law or legal advice. Explanations apply only to these invented words. Guesses stay on this page and never count as votes. No model projections are used.</p>
    <h3 ref={heading} tabIndex={-1}>Case {round + 1} of {DETECTIVE_CASES.length}: {item.title}</h3>
    <div className="amendment-comparison">
      <section id={`${id}-before`}><h4>Fictional before · §1</h4><p>{item.before}</p></section>
      <section id={`${id}-after`}><h4>Fictional after · §1 revised</h4><p>{item.after}</p></section>
    </div>
    <form onSubmit={event => { event.preventDefault(); if (guess !== null) setRevealed(true); }}>
      <fieldset disabled={revealed}><legend>What legal effect changed in this fictional clause?</legend>
        {item.choices.map((choice, index) => <label key={choice}><input type="radio" name={`${id}-guess`} checked={guess === index} onChange={() => setGuess(index)} required /> {choice}</label>)}
      </fieldset>
      <button type="submit" disabled={guess === null || revealed}>Reveal explanation</button>
    </form>
    {revealed && <section aria-label="Detective explanation">
      <p role="status">{guess === item.answer ? 'You spotted it.' : 'Look again at the changed words.'} {item.choices[item.answer]}</p>
      <AmendmentComparison before={item.before} after={item.after} />
      <p>{item.explanation}</p>
      <p><a className="pill info" href={`#${id}-before`}>Fictional source · §1 before</a> <a className="pill info" href={`#${id}-after`}>Fictional source · §1 revised</a></p>
      <h4>Edge case / uncertainty</h4><p>{item.edge}</p>
      <button type="button" onClick={() => { setRound((round + 1) % DETECTIVE_CASES.length); setGuess(null); setRevealed(false); heading.current?.focus(); }}>{round === DETECTIVE_CASES.length - 1 ? 'Play again' : 'Next case'}</button>
    </section>}
  </details>;
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
  const [compareBefore, setCompareBefore] = useState('');
  const [compareAfter, setCompareAfter] = useState('');
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
    <Suspense fallback={<p role="status">Loading private clause notes…</p>}><ClauseMarginalia key={`${source.kind}:${source.id}`} source={source} /></Suspense>
    <RedlineDetective />
    <button type="button" aria-expanded={open} aria-controls={`${id}-editor`} onClick={show}>Suggest amendment</button>
    {open && <div id={`${id}-editor`}>
      <h2>Prepare a private amendment</h2>
      <p>Saved only in this browser on this device. Nothing is submitted for moderation or published. Moderation must be built before amendments can become separate advisory voting options. Existing votes stay on the original proposal.</p>
      <p>{source.kind === 'sample' ? 'Fictional sample · not legal text' : 'Citizen-authored proposal · official status not verified'} · {source.title} · {source.jurisdiction}</p>
      <p>Origin: {source.origin} · {source.kind}:{source.id}. The whole proposed text is one editable section; clause boundaries are not inferred.</p>
      {conflict && <div role="alert"><p>The source has changed since this draft began. Review the current text below. Earlier versions stay unchanged; nothing is automatically rebased. Starting fresh replaces the unsaved editing fields below.</p><h3>Current source text</h3><p className="amendment-text">{source.text}</p><button type="button" onClick={() => { setBase({ ...source }); setFields({ replacement: source.text, rationale: '', impact: '', citation: '' }); setSelected(null); setEvent('revision'); setSecondParent(''); setError(''); setStatus('Started a fresh amendment against the current source.'); }}>Start fresh against current source</button></div>}
      <ClauseReader key={JSON.stringify([base, fields.replacement, selected?.id])} source={{ ...base, text: fields.replacement }} revision={selected ? `saved private version ${selected.id}` : 'unsaved working copy against captured base'} />
      <form onSubmit={e => {
        e.preventDefault();
        try { const next = saveAmendment(storage, source, base, fields, { event, parents: [...(selected ? [selected.id] : []), ...((event === 'merge' || event === 'compromise') && secondParent ? [secondParent] : [])] }); setVersions(next); select(next[next.length - 1]!); setError(''); setStatus('New private version saved in this browser. Not submitted or published.'); requestHaptic(e.nativeEvent); }
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
      {selected && <section aria-label="Saved version details"><h3>Private version {selected.id}</h3><p>{selected.author} · {selected.savedAt} · Publication permission: not requested</p><p>Saved origin: {selected.base.origin} · {selected.base.kind}:{selected.base.id} · {selected.base.title} · {selected.base.jurisdiction}</p><AmendmentComparison before={selected.base.text} after={selected.replacement} afterId={selected.id} />{selected.lineage?.parents.map(parent => { const v = versions.find(row => row.id === parent); return v ? <section key={parent}><h4>Text changes from parent {parent}</h4><AmendmentComparison before={v.replacement} after={selected.replacement} beforeId={v.id} afterId={selected.id} /></section> : null; })}<p>Review state: Unreviewed private draft · not submitted · not enacted law</p><h4>Rationale</h4><p>{selected.rationale}</p><h4>Impact / cost</h4><p>{selected.impact}</p><h4>Unverified citation note</h4><p>{selected.citation}</p></section>}
    </div>}
  </section>;
}

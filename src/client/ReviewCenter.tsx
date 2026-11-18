import { useEffect, useMemo, useState } from 'react';
import { originalReviewBills, searchBills, type CatalogBill } from '../shared/bill-catalog';
import './review-center.css';

type Category = 'legal' | 'evidence' | 'fiscal' | 'editorial';
type Decision = { category: Category; decision: string; reason: string; reviewer_id: string; created_at: string; sources: string };
type Submission = { id: string; category: Category; findings: string; sources: string; status: string; created_at: string };
type QueueBill = { id: string; revision: string; jurisdiction: string; snapshot: { problem: string; proposed_change: string; safeguards: string; metrics: string }; decisions: Decision[]; submissions: Submission[] };
const categories: Category[] = ['legal', 'fiscal', 'evidence', 'editorial'];
const categoryNames: Record<Category, string> = { legal: 'Legal', fiscal: 'Fiscal', evidence: 'Evidence', editorial: 'Editorial' };
const validBill = (id: string | null) => originalReviewBills.find(b => b.id === id);
const requestedBill = () => typeof window === 'undefined' ? null : validBill(new URLSearchParams(window.location.search).get('bill'));
const readSources = (raw: string) => { try { return JSON.parse(raw) as string[]; } catch { return []; } };

export default function ReviewCenter() {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(() => requestedBill()?.id ?? 'HFL-059');
  const [mobileDetail, setMobileDetail] = useState(() => Boolean(requestedBill()));
  const [activeTab, setActiveTab] = useState<'concept' | 'statute'>('concept');
  const [token, setToken] = useState('');
  const [reviewerSignedIn, setReviewerSignedIn] = useState(false);
  const [bills, setBills] = useState<QueueBill[]>([]);
  const [status, setStatus] = useState('');
  const [filter, setFilter] = useState<'pending' | 'reviewed' | 'all'>('pending');
  const [category, setCategory] = useState<Category>('legal');
  const [findings, setFindings] = useState('');
  const [sources, setSources] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState('');

  const selectedBill = validBill(selectedId) ?? originalReviewBills[0]!;
  const queueById = useMemo(() => new Map(bills.map(b => [b.id, b])), [bills]);
  const selectedQueue = queueById.get(selectedBill.id);
  const visibleBills = useMemo(() => searchBills(query, '').filter(b => Number(b.id.slice(4)) <= 100).filter(b => {
    const q = queueById.get(b.id);
    if (!q || filter === 'all') return true;
    const complete = categories.every(c => latestDecision(q, c)?.decision === 'approved');
    return filter === 'reviewed' ? complete : !complete;
  }), [query, queueById, filter]);

  useEffect(() => {
    const onPopState = () => {
      const bill = validBill(new URLSearchParams(location.search).get('bill'));
      setSelectedId(bill?.id ?? 'HFL-059');
      setMobileDetail(Boolean(bill));
    };
    addEventListener('popstate', onPopState);
    return () => removeEventListener('popstate', onPopState);
  }, []);

  function selectBill(bill: CatalogBill) {
    setSelectedId(bill.id);
    setActiveTab('concept');
    setSubmissionStatus('');
    const url = new URL(location.href);
    url.searchParams.set('bill', bill.id);
    history.pushState({ bill: bill.id }, '', url);
    setMobileDetail(true);
  }

  function latestDecision(bill: QueueBill, area: Category) {
    return bill.decisions.find(d => d.category === area);
  }

  async function loadQueue(e?: React.FormEvent) {
    e?.preventDefault();
    setStatus('Loading protected review workspace…');
    try {
      const response = await fetch('/api/review/queue', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? 'Reviewer sign-in failed.');
      setBills(data.bills as QueueBill[]);
      setReviewerSignedIn(true);
      setStatus('Signed in. Decisions remain tied to each exact revision.');
    } catch (error) {
      setReviewerSignedIn(false);
      setStatus(error instanceof Error ? error.message : 'Could not load the review queue.');
    }
  }

  async function submitSuggestion(e: React.FormEvent) {
    e.preventDefault();
    setSubmissionStatus('Submitting suggestion…');
    try {
      const response = await fetch('/api/catalog-review/submissions', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ billId: selectedBill.id, revision: selectedBill.revision, jurisdiction: selectedBill.jurisdiction, category, findings, sources: sources.split('\n').map(x => x.trim()).filter(Boolean) }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? 'Could not submit this suggestion.');
      setSubmissionStatus('Saved to the review database. Pending expert review; this is not an approval.');
      setFindings(''); setSources('');
      if (reviewerSignedIn) {
        try { await refreshQueue(); }
        catch { setSubmissionStatus('Saved to the review database. The queue did not refresh; reload it to see the suggestion.'); }
      }
    } catch (error) { setSubmissionStatus(error instanceof Error ? error.message : 'Could not submit this suggestion.'); }
  }

  async function refreshQueue() {
    const response = await fetch('/api/review/queue', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw Error(data.error ?? 'Could not refresh the review queue.');
    setBills(data.bills as QueueBill[]);
  }

  async function decide(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const decision = submitter?.value ?? 'approved';
    const reason = String(formData.get('reason') ?? '');
    const reviewSources = String(formData.get('sources') ?? '').split('\n').map(x => x.trim()).filter(Boolean);
    const area = String(formData.get('category')) as Category;
    setStatus('Saving review decision…');
    try {
      const response = await fetch(`/api/review/bills/${selectedBill.id}/decisions`, {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ revision: selectedBill.revision, jurisdiction: selectedBill.jurisdiction, category: area, decision, reason, sources: reviewSources }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? 'Could not save this decision.');
      setStatus(`Decision saved to the review database by ${data.reviewer}.`);
      form.reset();
      try { await refreshQueue(); }
      catch { setStatus(`Decision saved to the review database by ${data.reviewer}, but the queue did not refresh.`); }
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save this decision.'); }
  }

  const source = selectedQueue?.snapshot ?? { problem: selectedBill.problem, proposed_change: selectedBill.proposedChange, safeguards: selectedBill.safeguards, metrics: selectedBill.metrics };
  const approvedCount = selectedQueue ? categories.filter(c => latestDecision(selectedQueue, c)?.decision === 'approved').length : 0;

  return <main className={`review-center${mobileDetail ? ' review-center--mobile-detail' : ''}`}>
    <header className="review-topbar">
      <a className="review-brand" href="/">✳ Civic Synthesis</a>
      <div><span className="review-eyebrow">Human review workspace</span><h1>Review Center</h1></div>
      <details className="review-signin"><summary>{reviewerSignedIn ? 'Reviewer signed in' : 'Sign in as reviewer'}</summary>
        <form onSubmit={loadQueue}><label htmlFor="reviewer-token">Reviewer credential</label><input id="reviewer-token" type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste your authorized reviewer credential" required/><button type="submit">{reviewerSignedIn ? 'Refresh review workspace' : 'Open review workspace'}</button></form>
      </details>
    </header>

    <div className="review-layout">
      <aside className="review-browser" aria-label="Bill browser">
        <div className="review-browser-heading"><div><span className="review-eyebrow">Original HFL catalog</span><h2>100 bills</h2></div><span className="review-count">{visibleBills.length}</span></div>
        <label className="review-search-label" htmlFor="review-search">Search bills</label>
        <input id="review-search" className="review-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="ID, title, topic…" />
        {reviewerSignedIn && <label className="review-filter-label" htmlFor="review-filter">Queue</label>}
        {reviewerSignedIn && <select id="review-filter" className="review-filter" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="pending">Pending work</option><option value="reviewed">All reviews approved</option><option value="all">All bills</option></select>}
        <p className="review-list-note">{reviewerSignedIn ? 'Select a bill to review its exact revision.' : 'Policy concepts · discussion drafts'}</p>
        <nav className="review-bill-list" aria-label="Select a bill">
          {visibleBills.map(bill => {
            const item = queueById.get(bill.id);
            const complete = item && categories.every(c => latestDecision(item, c)?.decision === 'approved');
            return <button key={bill.id} className={`review-bill-option${selectedBill.id === bill.id ? ' is-selected' : ''}`} aria-current={selectedBill.id === bill.id ? 'true' : undefined} onClick={() => selectBill(bill)}>
              <span className="review-bill-option-meta">{bill.id} · {bill.category}</span><strong>{bill.title}</strong><span className={`review-status-dot${complete ? ' is-complete' : ''}`}>{complete ? 'Reviews complete' : 'Awaiting review'}</span>
            </button>;
          })}
          {!visibleBills.length && <p className="review-empty">No bills match that search.</p>}
        </nav>
      </aside>

      <section className="review-document" aria-labelledby="selected-bill-title">
        <button className="review-back" onClick={() => { setMobileDetail(false); history.pushState({}, '', '/review'); }}>← Back to bills</button>
        <div className="review-document-head"><div><p className="review-eyebrow">{selectedBill.id} · {selectedBill.jurisdiction.toUpperCase()} · DRAFT CONCEPT</p><h2 id="selected-bill-title">{selectedBill.title}</h2><p className="review-document-deck">{selectedBill.proposedChange}</p></div><span className="review-draft-badge">Discussion draft</span></div>
        <div className="review-revision-line"><span>Version {selectedBill.version} · Exact revision-linked source</span><code>{selectedBill.revision}</code></div>
        <div className="review-document-tabs" role="tablist" aria-label="Proposal document type">
          <button role="tab" aria-selected={activeTab === 'concept'} onClick={() => setActiveTab('concept')}>Policy concept</button>
          <button role="tab" aria-selected={activeTab === 'statute'} onClick={() => setActiveTab('statute')}>Full bill text · Not drafted yet</button>
        </div>
        {activeTab === 'concept' ? <div className="review-concept" role="tabpanel">
          <section><h3>The problem</h3><p>{source.problem}</p></section>
          <section><h3>Proposed change</h3><p>{source.proposed_change}</p></section>
          <section><h3>Trade-offs and safeguards</h3><p>{source.safeguards}</p></section>
          <section><h3>Possible success metrics</h3><p>{source.metrics}</p><small>Proposed measures only. No outcomes are measured here.</small></section>
          <aside className="review-not-drafted">Full statutory text has not been supplied for this catalog concept.</aside>
          <div className="review-revision-status"><div><h3>Review status</h3><p>{approvedCount} of 4 expert reviews approved for this exact revision</p></div><div className="review-status-grid">{categories.map(c => { const d = selectedQueue && latestDecision(selectedQueue, c); return <span key={c} className={d?.decision === 'approved' ? 'is-approved' : ''}><i aria-hidden="true" />{categoryNames[c]} <b>{d?.decision === 'approved' ? 'Approved' : d?.decision === 'changes_requested' ? 'Changes requested' : d?.decision === 'declined' ? 'Declined' : 'Pending'}</b></span>; })}</div><small>Review completion records an assessment; it does not mean the reviewer endorses the policy.</small></div>
        </div> : <div className="review-not-drafted review-statute-empty" role="tabpanel"><strong>Full bill text · Not drafted yet</strong><p>This catalog contains policy concepts, not complete statutory language. Definitions, sections, funding authority, implementation dates, and enforcement provisions have not been drafted for this proposal.</p><p>Reviews on this page apply only to the displayed concept revision.</p></div>}
      </section>

      <aside className="review-workspace" aria-label="Review workspace">
        <section className="review-form-card"><span className="review-eyebrow">Public contribution</span><h2>Review this proposal</h2><p>Select this proposal as your context, then submit a finding and supporting sources. It will be a suggestion for human review, not an approval.</p>
          <form onSubmit={submitSuggestion}>
            <label htmlFor="suggestion-category">Review area</label><select id="suggestion-category" value={category} onChange={e => setCategory(e.target.value as Category)}>{categories.map(c => <option key={c} value={c}>{categoryNames[c]}</option>)}</select>
            <label htmlFor="suggestion-findings">Your finding or suggested change</label><textarea id="suggestion-findings" minLength={20} maxLength={10000} required value={findings} onChange={e => setFindings(e.target.value)} placeholder="Describe a question, source, risk, or wording change…" />
            <label htmlFor="suggestion-sources">Supporting source URLs <span>One HTTPS URL per line</span></label><textarea id="suggestion-sources" className="review-source-input" value={sources} onChange={e => setSources(e.target.value)} placeholder="https://…" />
            <button type="submit">Submit for human review</button><p className="review-form-status" role="status">{submissionStatus}</p>
          </form>
        </section>

        {reviewerSignedIn && selectedQueue && <section className="review-form-card review-decision-card"><span className="review-eyebrow">Authorized reviewer</span><h2>Record an assessment</h2><p>Decisions apply only to revision <code>{selectedBill.revision.slice(0, 12)}…</code> in {selectedBill.jurisdiction}.</p>
          <form onSubmit={decide}>
            <label htmlFor="decision-category">Review area</label><select id="decision-category" name="category">{categories.map(c => <option key={c} value={c}>{categoryNames[c]}</option>)}</select>
            <label htmlFor="decision-reason">Assessment rationale</label><textarea id="decision-reason" name="reason" minLength={10} required placeholder="Sources considered, assumptions, limitations, and unresolved questions…" />
            <label htmlFor="decision-sources">Supporting sources <span>One HTTPS URL per line</span></label><textarea id="decision-sources" name="sources" className="review-source-input" placeholder="https://…" />
            <div className="review-decision-actions"><button name="decision" value="approved" type="submit">Record review complete</button><button className="review-secondary" name="decision" value="changes_requested" type="submit">Request changes</button><button className="review-secondary" name="decision" value="declined" type="submit">Decline approval</button></div>
          </form>
          <h3>Decision history</h3>{selectedQueue.decisions.length ? selectedQueue.decisions.map((d, i) => <details key={`${d.category}-${d.created_at}-${i}`} className="review-history-item"><summary>{categoryNames[d.category]} · {d.decision} · {d.reviewer_id}</summary><p>{d.reason}</p><small>{d.created_at} · exact revision {selectedQueue.revision}</small></details>) : <p className="review-muted">No decisions recorded for this revision.</p>}
          <h3>Submitted findings</h3>{selectedQueue.submissions.length ? selectedQueue.submissions.map(s => <details key={s.id} className="review-history-item"><summary>{categoryNames[s.category]} suggestion · {s.status}</summary><p>{s.findings}</p><ul>{readSources(s.sources).map(url => <li key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul></details>) : <p className="review-muted">No public suggestions yet.</p>}
        </section>}
        <p className="review-feedback" role="status" aria-live="polite">{status}</p>
      </aside>
    </div>
  </main>;
}

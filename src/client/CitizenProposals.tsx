import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ADVISORY_CHOICES, CITIZEN_PROPOSAL_LIMITS, PROPOSAL_JURISDICTIONS,
  type AdvisoryChoice, type CitizenProposalInput, type CitizenProposalView, type ProposalJurisdiction,
} from "../shared/citizen-proposals";
import "./citizen-proposals.css";

const API = "/api/citizen-proposals";
const DRAFTS_KEY = "civic_synthesis_proposal_drafts_v1";
const jurisdictionLabels: Record<ProposalJurisdiction, string> = {
  city: "City", county: "County", state: "State", federal: "Federal", unsure: "Not sure yet",
};
const choiceLabels: Record<AdvisoryChoice, string> = { support: "Support", oppose: "Oppose", unsure: "Not sure" };
class ProposalRequestError extends Error {
  constructor(message: string, readonly status: number | null) { super(message); }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
    });
  } catch {
    throw new ProposalRequestError("We couldn’t connect. Please check your connection and try again.", null);
  }
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new ProposalRequestError("The server returned an unexpected response. Please try again.", response.ok ? null : response.status); }
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
      ? data.error : "That request didn’t complete. Please try again.";
    throw new ProposalRequestError(message, response.status);
  }
  return data as T;
}

function messageOf(error: unknown) { return error instanceof Error ? error.message : "Something went wrong. Please try again."; }
function dateLabel(value: string) { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
function placeLabel(proposal: CitizenProposalInput) {
  return [jurisdictionLabels[proposal.jurisdiction], proposal.jurisdictionName].filter(Boolean).join(" · ");
}
function detailUrl(id: string) { return `/proposals/${encodeURIComponent(id)}`; }

export function isCitizenProposalPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/votes" || path === "/feed" || path === "/proposals/new" || /^\/proposals\/[^/]+$/.test(path);
}

function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`cp-notice${error ? " cp-notice-error" : ""}`} role={error ? "alert" : "status"}>{children}</div>;
}

function Shell({ children, current }: { children: ReactNode; current: "votes" | "feed" | "new" | "detail" }) {
  return <div className="cp-app">
    <a className="cp-skip" href="#proposal-main">Skip to content</a>
    <header className="cp-header">
      <a className="cp-brand" href="/votes"><span aria-hidden="true" className="cp-brand-mark">◎</span><span>Civic Synthesis<small>Ideas into shared decisions</small></span></a>
      <span className="cp-advisory"><span aria-hidden="true">●</span> Advisory · not binding</span>
    </header>
    <nav className="cp-nav" aria-label="Main navigation">
      <a href="/journal">Journal</a>
      <a href="/feed" aria-current={current === "feed" ? "page" : undefined}>Feed</a>
      <a href="/votes" aria-current={current === "votes" || current === "detail" ? "page" : undefined}>Votes</a>
      <a href="/synth">Synthesis</a>
      <a className="cp-nav-propose" href="/proposals/new" aria-current={current === "new" ? "page" : undefined}>＋ Propose a law</a>
    </nav>
    <main id="proposal-main" tabIndex={-1}>{children}</main>
    <footer className="cp-footer"><a href="/privacy">Privacy &amp; removal</a><span>Civic Synthesis</span><p>Anonymous, non-binding advisory participation; one vote per browser ID, not one verified person. Publishing here does not enact a law or send anything to an official.</p></footer>
  </div>;
}

export function CitizenProposalsApp() {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/proposals/new") return <Shell current="new"><ProposalEditor /></Shell>;
  if (path.startsWith("/proposals/")) {
    let id: string;
    try { id = decodeURIComponent(path.slice("/proposals/".length)); }
    catch { return <Shell current="detail"><Notice error>The proposal address is invalid. <a href="/votes">Return to proposals</a>.</Notice></Shell>; }
    return <Shell current="detail"><ProposalDetail id={id} /></Shell>;
  }
  return <Shell current={path === "/feed" ? "feed" : "votes"}><ProposalBoard feed={path === "/feed"} /></Shell>;
}

function ProposalBoard({ feed }: { feed: boolean }) {
  const [proposals, setProposals] = useState<CitizenProposalView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [jurisdiction, setJurisdiction] = useState("all");
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    request<{ proposals: CitizenProposalView[] }>(API).then(result => {
      if (active) setProposals(result.proposals);
    }).catch(err => { if (active) setError(messageOf(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const query = search.trim().toLowerCase();
  const filtered = proposals.filter(p => (jurisdiction === "all" || p.jurisdiction === jurisdiction)
    && (!query || `${p.title} ${p.problem} ${p.proposedChange} ${p.jurisdictionName ?? ""}`.toLowerCase().includes(query)));
  return <>
    <section className="cp-hero">
      <div><p className="cp-eyebrow">{feed ? "THE PUBLIC PROPOSAL FEED" : "YOUR VOICE, A CONCRETE CHANGE"}</p>
        <h1>{feed ? "See what people want to change." : "A better rule starts with an idea."}</h1>
        <p className="cp-lede">Put a change into words. Read what others propose. Help shape the next conversation with an advisory vote.</p>
        <div className="cp-actions"><a className="cp-button" href="/proposals/new">＋ Propose a law</a><a className="cp-text-link" href="/journal">Start with your experience <span aria-hidden="true">↗</span></a></div>
      </div>
      <aside className="cp-hero-note"><span className="cp-note-symbol" aria-hidden="true">“</span><p>You don’t need legal language to begin.</p><small>Describe the problem and the rule you would change. A clear first draft is enough.</small></aside>
    </section>
    <section aria-labelledby="cp-board-title">
      <div className="cp-section-heading"><div><p className="cp-eyebrow">OPEN FOR ADVISORY VOTES</p><h2 id="cp-board-title">Published proposals</h2></div><span className="cp-total">{loading ? "Loading…" : `${proposals.length} proposal${proposals.length === 1 ? "" : "s"}`}</span></div>
      <div className="cp-filters"><label>Search proposals<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="A title, problem, or place" /></label><label>Where it applies<select value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}><option value="all">All jurisdictions</option>{PROPOSAL_JURISDICTIONS.map(value => <option key={value} value={value}>{jurisdictionLabels[value]}</option>)}</select></label></div>
      {loading && <p className="cp-loading" role="status">Loading published proposals…</p>}
      {error && <Notice error>{error} <button className="cp-inline-button" onClick={() => setAttempt(n => n + 1)}>Try again</button></Notice>}
      {!loading && !error && proposals.length === 0 && <div className="cp-empty"><span className="cp-empty-mark" aria-hidden="true">＋</span><h3>Be the first to put a change forward.</h3><p>A housing rule, a better bus service, a clearer permit process. Start with something that matters to you.</p><a className="cp-button" href="/proposals/new">Write the first proposal</a><small>New proposals start with zero responses.</small></div>}
      {!loading && !error && proposals.length > 0 && filtered.length === 0 && <div className="cp-empty"><h3>No proposals match those filters.</h3><p>Try a broader search or another jurisdiction.</p><button className="cp-button cp-button-secondary" onClick={() => { setSearch(""); setJurisdiction("all"); }}>Clear filters</button></div>}
      {!loading && !error && filtered.length > 0 && <ul className="cp-proposal-list">{filtered.map(proposal => <li key={proposal.id}><article className="cp-proposal-card"><div className="cp-card-top"><span className="cp-tag">{placeLabel(proposal)}</span><time dateTime={proposal.publishedAt}>{dateLabel(proposal.publishedAt)}</time></div><h3><a href={detailUrl(proposal.id)}>{proposal.title}</a></h3><p className="cp-card-excerpt">{proposal.problem}</p><div className="cp-card-bottom"><span>{proposal.countTotal.toLocaleString()} advisory response{proposal.countTotal === 1 ? "" : "s"} from browsers</span><a className="cp-text-link" href={detailUrl(proposal.id)}>Read & vote <span aria-hidden="true">→</span></a></div>{proposal.ownVote && <p className="cp-your-choice">Your choice: {choiceLabels[proposal.ownVote]}</p>}</article></li>)}</ul>}
    </section>
  </>;
}

interface LocalDraft { id: string; values: CitizenProposalInput; savedAt: string; }
function blankValues(): CitizenProposalInput { return { title: "", problem: "", proposedChange: "", jurisdiction: "unsure", jurisdictionName: "", supportingInfo: "" }; }
function isDraft(value: unknown): value is LocalDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<LocalDraft>;
  const fields = draft.values;
  return typeof draft.id === "string" && /^[0-9a-f-]{36}$/i.test(draft.id) && typeof draft.savedAt === "string" && Number.isFinite(Date.parse(draft.savedAt))
    && !!fields && typeof fields.title === "string" && typeof fields.problem === "string" && typeof fields.proposedChange === "string"
    && PROPOSAL_JURISDICTIONS.includes(fields.jurisdiction)
    && (fields.jurisdictionName === undefined || typeof fields.jurisdictionName === "string")
    && (fields.supportingInfo === undefined || typeof fields.supportingInfo === "string")
    && (fields.sourceEntryId === undefined || typeof fields.sourceEntryId === "string");
}
function readDrafts(): LocalDraft[] {
  const raw = localStorage.getItem(DRAFTS_KEY);
  if (!raw) return [];
  const rows: unknown = JSON.parse(raw);
  if (!Array.isArray(rows) || !rows.every(isDraft)) throw new Error("Saved draft data could not be read.");
  return rows;
}
function initialEditor() {
  const params = new URLSearchParams(window.location.search);
  try {
    const drafts = readDrafts();
    const selectedId = params.get("draft");
    const selected = selectedId ? drafts.find(draft => draft.id === selectedId) : undefined;
    return { drafts, id: selected?.id ?? crypto.randomUUID(), values: selected?.values ?? blankValues(), savedAt: selected?.savedAt,
      error: selectedId && !selected ? "That draft is not saved in this browser. You can start a new proposal below." : "" };
  } catch {
    return { drafts: [] as LocalDraft[], id: crypto.randomUUID(), values: blankValues(), savedAt: undefined,
      error: "Saved drafts aren’t available in this browser. You can still write and publish here, but saving a draft may fail." };
  }
}

function ProposalEditor() {
  const [initial] = useState(initialEditor);
  const [values, setValues] = useState(initial.values);
  const [drafts, setDrafts] = useState(initial.drafts);
  const [savedAt, setSavedAt] = useState(initial.savedAt);
  const [dirty, setDirty] = useState(false);
  const [confirmedPublic, setConfirmedPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(initial.error);
  const [status, setStatus] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const [sourceSkipped, setSourceSkipped] = useState(false);
  const [uncertainPublish, setUncertainPublish] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const published = useRef(false);
  const sourceId = new URLSearchParams(window.location.search).get("fromJournal");
  const draftId = initial.id;

  useEffect(() => {
    if (!sourceId || initial.savedAt || sourceSkipped) return;
    let active = true;
    setSourceLoading(true); setSourceError("");
    request<{ entry: { id: string; text: string; author: string; createdAt: string } }>(`${API}/journal/${encodeURIComponent(sourceId)}`).then(({ entry }) => {
      if (!active) return;
      setValues(current => ({ ...current, problem: entry.text.slice(0, CITIZEN_PROPOSAL_LIMITS.problem), sourceEntryId: entry.id }));
      setSourceTitle(`From the shared journal${entry.author ? ` · ${entry.author}` : ""}`);
      setDirty(true);
      if (entry.text.length > CITIZEN_PROPOSAL_LIMITS.problem) setStatus("The first 5,000 characters were copied. Review and summarize the experience before publishing.");
    }).catch(err => { if (active) setSourceError(messageOf(err)); }).finally(() => { if (active) setSourceLoading(false); });
    return () => { active = false; };
  }, [sourceId, sourceAttempt, sourceSkipped, initial.savedAt]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { if (!published.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update<K extends keyof CitizenProposalInput>(key: K, value: CitizenProposalInput[K]) {
    setValues(current => ({ ...current, [key]: value }));
    setDirty(true); setStatus("");
  }

  function removeJournalLink() {
    if (submitting || sourceLoading) return;
    setValues(current => {
      const { sourceEntryId: _sourceEntryId, ...remaining } = current;
      return remaining;
    });
    setSourceSkipped(true); setSourceTitle(""); setSourceError("");
    setError(current => /source journal|sourceEntryId|source link/i.test(current) ? "" : current);
    setDirty(true);
    setStatus("Journal link removed. The copied experience is still in your proposal.");
  }

  function persistDraft() {
    const next: LocalDraft = { id: draftId, values, savedAt: new Date().toISOString() };
    const saved = [next, ...readDrafts().filter(draft => draft.id !== draftId)];
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(saved));
    setDrafts(saved); setSavedAt(next.savedAt); setDirty(false); setStorageWarning("");
    window.history.replaceState(null, "", `/proposals/new?draft=${encodeURIComponent(draftId)}`);
  }

  function saveDraft() {
    setError("");
    try {
      persistDraft();
      setStatus(uncertainPublish ? "Draft saved in this browser. Publication is not confirmed; retry with the same text." : "Draft saved in this browser. It has not been published.");
    } catch {
      setError("We couldn’t save this draft. Browser storage may be disabled or full. Your text is still in this form; keep this page open or copy it before leaving.");
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || sourceLoading || !!sourceError || !confirmedPublic) return;
    if (!formRef.current?.reportValidity()) return;
    setSubmitting(true); setError(""); setStatus("");
    // Preserve the exact retry key and text before the request can reach the server.
    // A storage failure must not prevent an otherwise valid public submission.
    try { persistDraft(); }
    catch { setStorageWarning("A recovery draft couldn’t be saved in this browser. Keep this page open until publishing finishes, and retry here if the connection fails."); }
    try {
      const { proposal } = await request<{ proposal: CitizenProposalView }>(API, { ...values, idempotencyKey: draftId, confirmedPublic: true });
      published.current = true;
      setDirty(false);
      // The server has accepted the proposal. Draft cleanup is best-effort only.
      try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(readDrafts().filter(draft => draft.id !== draftId))); } catch { /* Keep published success independent of browser storage. */ }
      setStatus("Published. Opening your proposal…");
      // Remove the unsaved-change guard before navigating after successful publication.
      window.setTimeout(() => window.location.assign(detailUrl(proposal.id)), 0);
    } catch (err) {
      setError(messageOf(err));
      setUncertainPublish(err instanceof ProposalRequestError && (err.status === null || err.status >= 500));
      setSubmitting(false);
    }
  }

  return <>
    <a className="cp-back" href="/votes">← Back to proposals</a>
    <section className="cp-editor-heading"><p className="cp-eyebrow">FROM AN IDEA TO A PUBLIC PROPOSAL</p><h1>What would you change?</h1><p className="cp-lede">Start in your own words. Make the problem clear, then describe the rule or policy you want people to consider.</p></section>
    <div className="cp-editor-layout">
      <form className="cp-panel cp-editor" onSubmit={publish} ref={formRef}>
        <div className="cp-form-intro"><h2>Your proposal</h2><span>Fields marked * are required to publish.</span></div>
        {sourceLoading && <Notice>Loading the journal experience…</Notice>}
        {sourceError && <Notice error>{sourceError}<div className="cp-actions"><button type="button" className="cp-inline-button" onClick={() => setSourceAttempt(n => n + 1)}>Try loading again</button><button type="button" className="cp-inline-button" onClick={() => { setSourceSkipped(true); setSourceError(""); }}>Start without the journal entry</button></div></Notice>}
        {values.sourceEntryId && <div className="cp-source"><span>{sourceTitle || "Based on a shared journal experience"}</span><p>Review the copied experience and describe your proposed change below. Nothing is published until you choose to publish.</p><button type="button" className="cp-inline-button" disabled={submitting || sourceLoading} onClick={removeJournalLink}>Remove journal link</button></div>}
        <fieldset disabled={submitting || sourceLoading || !!sourceError}>
          <label className="cp-field" htmlFor="proposal-title"><span>Title <b aria-hidden="true">*</b></span><input id="proposal-title" aria-describedby="proposal-title-hint" aria-label="Title" name="title" required maxLength={CITIZEN_PROPOSAL_LIMITS.title} value={values.title} onChange={e => update("title", e.target.value)} placeholder="For example, publish one clear permit checklist" autoComplete="off" /><small id="proposal-title-hint">A short name that says what you want to change.</small></label>
          <label className="cp-field" htmlFor="proposal-problem"><span>Problem <b aria-hidden="true">*</b></span><textarea id="proposal-problem" aria-describedby="proposal-problem-hint" aria-label="Problem" name="problem" required rows={4} maxLength={CITIZEN_PROPOSAL_LIMITS.problem} value={values.problem} onChange={e => update("problem", e.target.value)} placeholder="What is happening? Who does it affect?" /><small id="proposal-problem-hint">Describe the experience behind your proposal. Keep personal information out of public text.</small></label>
          <label className="cp-field" htmlFor="proposal-change"><span>Proposed change <b aria-hidden="true">*</b></span><textarea id="proposal-change" aria-describedby="proposal-change-hint" aria-label="Proposed change" name="proposedChange" required rows={5} maxLength={CITIZEN_PROPOSAL_LIMITS.proposedChange} value={values.proposedChange} onChange={e => update("proposedChange", e.target.value)} placeholder="What should the rule, service, or policy say or do?" /><small id="proposal-change-hint">Plain language is welcome. You do not need to write a legal clause.</small></label>
          <div className="cp-field-pair"><label className="cp-field" htmlFor="proposal-jurisdiction"><span>Where it applies <b aria-hidden="true">*</b></span><select id="proposal-jurisdiction" aria-label="Where it applies" name="jurisdiction" value={values.jurisdiction} onChange={e => update("jurisdiction", e.target.value as ProposalJurisdiction)}>{PROPOSAL_JURISDICTIONS.map(value => <option key={value} value={value}>{jurisdictionLabels[value]}</option>)}</select></label><label className="cp-field" htmlFor="proposal-place"><span>Place <small>Optional</small></span><input id="proposal-place" aria-label="Place" name="jurisdictionName" value={values.jurisdictionName ?? ""} maxLength={CITIZEN_PROPOSAL_LIMITS.jurisdictionName} onChange={e => update("jurisdictionName", e.target.value)} placeholder="For example, Houston or Texas" /></label></div>
          <label className="cp-field" htmlFor="proposal-info"><span>Supporting information <small>Optional</small></span><textarea id="proposal-info" aria-describedby="proposal-info-hint" aria-label="Supporting information" name="supportingInfo" rows={4} maxLength={CITIZEN_PROPOSAL_LIMITS.supportingInfo} value={values.supportingInfo ?? ""} onChange={e => update("supportingInfo", e.target.value)} placeholder="Sources, benefits, costs, concerns, or questions to investigate" /><small id="proposal-info-hint">Unknown costs or unanswered questions are fine. Say what still needs checking.</small></label>
          <div className="cp-publish-box"><h3>Ready for other people to consider?</h3><p>Publishing creates a public page and adds your proposal to the feed and advisory voting list. Published text cannot be edited here yet, so review it first.</p><label className="cp-checkbox"><input type="checkbox" checked={confirmedPublic} onChange={e => setConfirmedPublic(e.target.checked)} /><span>I have reviewed this proposal and want to publish its contents publicly for advisory voting.</span></label></div>
        </fieldset>
        {error && <Notice error>{error}</Notice>}
        {storageWarning && <Notice>{storageWarning}</Notice>}
        {uncertainPublish && <p className="cp-hint">The last publication may have reached the server. Retry with the same text to retrieve the same proposal safely.</p>}
        <div className="cp-form-actions"><button type="button" className="cp-button cp-button-secondary" disabled={submitting || sourceLoading || !!sourceError} onClick={saveDraft}>Save draft</button><button className="cp-button" type="submit" disabled={submitting || sourceLoading || !!sourceError || !confirmedPublic}>{submitting ? "Publishing…" : "Publish for advisory voting"}</button></div>
        <div className="cp-save-status" aria-live="polite">{status || (savedAt ? `${dirty ? "Unsaved changes · Last saved" : "Saved in this browser"} ${new Date(savedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : "Drafts stay in this browser until you publish.")}</div>
      </form>
      <aside className="cp-editor-sidebar">
        <div className="cp-side-note"><p className="cp-eyebrow">A USEFUL FIRST DRAFT</p><h2>Specific beats perfect.</h2><ol><li><b>Name the problem.</b><span>Give people enough context to understand why it matters.</span></li><li><b>Describe one change.</b><span>Make the action clear enough that others can discuss it.</span></li><li><b>Leave room for questions.</b><span>Sources and unknowns help the next person contribute.</span></li></ol></div>
        <section className="cp-drafts" aria-labelledby="cp-drafts-title" id="saved-drafts"><h2 id="cp-drafts-title">Your saved drafts <span>{drafts.length}</span></h2><p>Draft copies are stored only in this browser.</p>{drafts.length === 0 ? <small>Choose “Save draft” to return to your idea later.</small> : <ul>{drafts.map(draft => <li key={draft.id}><a href={`/proposals/new?draft=${encodeURIComponent(draft.id)}`} aria-current={draft.id === draftId ? "page" : undefined}>{draft.values.title.trim() || "Untitled proposal"}<small>{dateLabel(draft.savedAt)}{draft.id === draftId ? " · Open now" : ""}</small></a></li>)}</ul>}</section>
      </aside>
    </div>
  </>;
}

function ProposalDetail({ id }: { id: string }) {
  const [proposal, setProposal] = useState<CitizenProposalView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState("");
  const [status, setStatus] = useState("");
  const [commentText, setCommentText] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [commentKey, setCommentKey] = useState(() => crypto.randomUUID());
  const [commenting, setCommenting] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [commentStatus, setCommentStatus] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setNotFound(false);
    request<{ proposal: CitizenProposalView }>(`${API}/${encodeURIComponent(id)}`).then(result => {
      if (active) { setProposal(result.proposal); document.title = `${result.proposal.title} · Civic Synthesis`; }
    }).catch(err => { if (active) { setError(messageOf(err)); setNotFound(err instanceof ProposalRequestError && err.status === 404); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, attempt]);
  async function vote(choice: AdvisoryChoice | null) {
    if (voting || commenting) return;
    setVoting(true); setVoteError(""); setStatus("");
    try {
      const result = await request<{ proposal: CitizenProposalView }>(`${API}/${encodeURIComponent(id)}/vote`, { choice });
      setProposal(result.proposal);
      setStatus(choice === null ? "Your response was removed." : `Your advisory response is saved: ${choiceLabels[choice]}.`);
    } catch (err) { setVoteError(messageOf(err)); }
    finally { setVoting(false); }
  }
  async function postComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (commenting || voting || !commentText.trim()) return;
    setCommenting(true); setCommentError(""); setCommentStatus("");
    try {
      const result = await request<{ proposal: CitizenProposalView }>(`${API}/${encodeURIComponent(id)}/comments`, { text: commentText, displayName, idempotencyKey: commentKey });
      setProposal(result.proposal); setCommentText(""); setCommentKey(crypto.randomUUID());
      setCommentStatus("Your comment is published.");
    } catch (err) { setCommentError(messageOf(err)); }
    finally { setCommenting(false); }
  }
  return <>
    <a className="cp-back" href="/votes">← All proposals</a>
    {loading && <p className="cp-loading" role="status">Loading this proposal…</p>}
    {!loading && error && <div className="cp-panel"><h1>{notFound ? "Proposal not found." : "This proposal couldn’t load."}</h1><Notice error>{error}</Notice>{!notFound && <button className="cp-button" onClick={() => setAttempt(n => n + 1)}>Try again</button>}<a className="cp-text-link" href="/votes">Browse published proposals →</a></div>}
    {!loading && !error && proposal && <>
      <header className="cp-detail-heading"><div className="cp-card-top"><span className="cp-tag">{placeLabel(proposal)}</span><span>Citizen proposal · Open for advisory votes</span></div><h1>{proposal.title}</h1><p>Published <time dateTime={proposal.publishedAt}>{dateLabel(proposal.publishedAt)}</time></p></header>
      <div className="cp-detail-layout"><article className="cp-panel cp-proposal-text"><section><p className="cp-eyebrow">01 · THE PROBLEM</p><h2>Why this matters</h2><p>{proposal.problem}</p></section><section className="cp-change"><p className="cp-eyebrow">02 · THE PROPOSAL</p><h2>What would change</h2><p>{proposal.proposedChange}</p></section><section><p className="cp-eyebrow">03 · WHERE IT APPLIES</p><h2>{placeLabel(proposal)}</h2>{proposal.jurisdiction === "unsure" && <p>The appropriate jurisdiction still needs to be identified.</p>}</section>{proposal.supportingInfo && <section><p className="cp-eyebrow">04 · SUPPORTING INFORMATION</p><h2>Sources, benefits, and open questions</h2><p>{proposal.supportingInfo}</p></section>}{proposal.sourceEntryId && <section className="cp-origin"><p className="cp-eyebrow">STARTED WITH AN EXPERIENCE</p><p>This proposal was created from a shared journal entry.</p><a className="cp-text-link" href={`/journal#entry-${encodeURIComponent(proposal.sourceEntryId)}`}>Read the source journal entry →</a></section>}</article>
        <aside className="cp-panel cp-vote-panel" aria-labelledby="cp-vote-title"><p className="cp-eyebrow">ADD YOUR VOICE</p><h2 id="cp-vote-title">What do you think?</h2><p>You can change or remove your choice at any time.</p><div className="cp-vote-buttons" role="group" aria-label="Your advisory response">{ADVISORY_CHOICES.map(choice => <button key={choice} className={`cp-vote-choice cp-choice-${choice}${proposal.ownVote === choice ? " cp-choice-selected" : ""}`} aria-pressed={proposal.ownVote === choice} disabled={voting || commenting} onClick={() => vote(choice)}><span>{proposal.ownVote === choice ? "✓ " : ""}{choiceLabels[choice]}</span><b>{proposal.counts[choice].toLocaleString()}</b></button>)}</div><p className="cp-response-total"><b>{proposal.countTotal.toLocaleString()}</b> advisory response{proposal.countTotal === 1 ? "" : "s"} from browsers</p><p className="cp-vote-caveat">One current choice per browser identity. These counts do not verify residency or represent a public poll.</p>{proposal.ownVote && <button className="cp-inline-button" disabled={voting || commenting} onClick={() => vote(null)}>Remove my response</button>}{voting && <p role="status">Saving your response…</p>}{voteError && <Notice error>{voteError}</Notice>}<p className="cp-save-status" role="status">{status}</p><div className="cp-vote-boundary"><b>What happens next?</b><p>This proposal stays available for public discussion and advisory voting. Adoption by a government requires a separate process.</p></div></aside>
      </div>
      <section className="cp-panel cp-discussion" aria-labelledby="cp-discussion-title"><div className="cp-section-heading"><div><p className="cp-eyebrow">MAKE THE PROPOSAL CLEARER</p><h2 id="cp-discussion-title">Public discussion</h2></div><span className="cp-total">{proposal.comments.length} comment{proposal.comments.length === 1 ? "" : "s"}</span></div><p className="cp-discussion-intro">Ask a question, offer a source, or explain a benefit or concern. Keep the conversation about the proposed change.</p>{proposal.comments.length ? <ol className="cp-comments">{proposal.comments.map(comment => <li key={comment.id}><div><b>{comment.displayName}</b><time dateTime={comment.createdAt}>{dateLabel(comment.createdAt)}</time></div><p>{comment.text}</p></li>)}</ol> : <p className="cp-no-comments">No comments yet. Start the conversation.</p>}<form onSubmit={postComment} className="cp-comment-form"><fieldset disabled={commenting || voting}><label className="cp-field" htmlFor="comment-name"><span>Display name <small>Optional</small></span><input id="comment-name" aria-label="Display name" maxLength={80} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Participant" /></label><label className="cp-field" htmlFor="comment-text"><span>Your comment</span><textarea id="comment-text" aria-describedby="comment-text-hint" aria-label="Your comment" required maxLength={2000} rows={4} value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="What would help people understand this proposal?" /><small id="comment-text-hint">Your comment and display name will be public. Avoid personal or identifying information.</small></label><button type="submit" className="cp-button" disabled={commenting || voting || !commentText.trim()}>{commenting ? "Posting…" : "Post public comment"}</button></fieldset>{commentError && <Notice error>{commentError}</Notice>}<p role="status" className="cp-save-status">{commentStatus}</p></form></section>
      <div className="cp-after-detail"><p>Have another change in mind?</p><a className="cp-button cp-button-secondary" href="/proposals/new">＋ Propose a law</a></div>
    </>}
  </>;
}

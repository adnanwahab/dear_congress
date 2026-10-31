import { useEffect, useMemo, useState } from "react";
import type {
  JournalEntry, NeedDef, NeedDemand, PackageResult, PlanItem, Proposal, ProposalStats, Stance, UserVote, Weights,
} from "../engine/types";

type PublishStage = "journal" | "needs" | "vote" | "synthesize";
type StageStatus = "idle" | "running" | "done" | "error";

type StageEvent =
  | { stage: "journal"; status: "done"; entry_id: string; labels: string[] }
  | { stage: "needs"; status: "done"; matched: { need_id: string; name: string; voices: number; isNew: boolean }[] }
  | { stage: "vote"; status: "done"; deltas: { item_id: string; name: string; rankBefore: number; rankAfter: number }[] }
  | { stage: "synthesize"; status: "running" | "done"; diff?: { added: string[]; removed: string[]; reinforced: string[]; nearMiss?: { item: string; entriesNeeded: number } } }
  | { stage: string; status: "error"; message: string };

interface PublishFlow {
  forkId: string | null;
  stages: Record<PublishStage, StageStatus>;
  notes: Partial<Record<PublishStage, string>>;
}

interface AppState {
  needs: NeedDef[];
  changeLevels: string[];
  proposals: Proposal[];
  stats: Record<string, ProposalStats>;
  demand: Record<string, NeedDemand>;
  mechanismShare: Record<string, number>;
  goalSupport: Record<string, number>;
  entries: JournalEntry[];
  population: { n: number; archetypes: { name: string; share: number }[]; realVoices?: number };
  user: { votes: Record<string, UserVote>; allocation: Record<string, number>; goalVotes: Record<string, boolean>; answers: { id: string; needId: string; text: string; proposalId: string }[] };
  defaultWeights: Weights;
}

const JOURNAL_CREATE_ENDPOINTS = ["/api/journal", "/api/entries", "/api/publish_draft"];
const VOTER_ID_KEY = "civic_synthesis_voter_id";

function getVoterId() {
  const existing = localStorage.getItem(VOTER_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(VOTER_ID_KEY, id);
  return id;
}

async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const resolvedMethod = (method ?? (body === undefined ? "GET" : "POST")).toUpperCase();
  const res = await fetch(path, {
    method: resolvedMethod,
    headers: {
      "content-type": "application/json",
      "x-voter-id": getVoterId(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  const data = await res.json();
  if (resolvedMethod === "POST" && JOURNAL_CREATE_ENDPOINTS.some((p) => path.startsWith(p))) {
    window.dispatchEvent(new CustomEvent("journal:created", { detail: { path } }));
  }
  return data;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const money = (b: number | null) => (b === null ? "Not costed" : b >= 1 ? `$${b.toFixed(1)}B` : b > 0 ? `$${Math.round(b * 1000)}M` : "$0");

type Tab = "journal" | "needs" | "vote" | "synth";
type LiveStatus = "connecting" | "live" | "reconnecting";
const TABS: { id: Tab; n: string; label: string; hint: string }[] = [
  { id: "journal", n: "1", label: "Journal", hint: "Describe your life" },
  { id: "needs", n: "2", label: "Needs", hint: "What people share" },
  { id: "vote", n: "3", label: "Vote", hint: "Goals, ideas, priorities" },
  { id: "synth", n: "4", label: "Synthesize", hint: "One coherent plan" },
];

const STAGE_BY_TAB: Record<Tab, PublishStage> = { journal: "journal", needs: "needs", vote: "vote", synth: "synthesize" };

const EMPTY_FLOW: PublishFlow = {
  forkId: null,
  stages: { journal: "idle", needs: "idle", vote: "idle", synthesize: "idle" },
  notes: {},
};

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>("journal");
  const [focusNeedId, setFocusNeedId] = useState<string | null>(null);
  const [publishFlow, setPublishFlow] = useState<PublishFlow>(EMPTY_FLOW);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("connecting");
  const refresh = () => api<AppState>("/api/state").then(setState);
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const onJournalCreated = () => { refresh(); };
    window.addEventListener("journal:created", onJournalCreated);
    return () => window.removeEventListener("journal:created", onJournalCreated);
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/entries/events");

    es.onopen = () => {
      setLiveStatus("live");
    };

    es.onerror = () => {
      setLiveStatus("reconnecting");
    };

    es.onmessage = (m) => {
      try {
        const payload = JSON.parse(m.data) as { entries?: JournalEntry[] };
        if (!Array.isArray(payload.entries)) return;
        setState((prev) => prev ? { ...prev, entries: payload.entries } : prev);
        setLiveStatus("live");
      } catch {
        // ignore malformed SSE payloads
      }
    };

    return () => es.close();
  }, []);

  const onPublishStart = (forkId: string) => {
    setPublishFlow({
      forkId,
      stages: { journal: "running", needs: "idle", vote: "idle", synthesize: "idle" },
      notes: {},
    });
  };

  const onPublishEvent = (ev: StageEvent) => {
    if (ev.stage === "needs" && ev.status === "done" && ev.matched[0]) setFocusNeedId(ev.matched[0].need_id);
    setPublishFlow((prev) => {
      const next: PublishFlow = {
        ...prev,
        stages: { ...prev.stages },
        notes: { ...prev.notes },
      };

      if (ev.status === "error") {
        if (ev.stage in next.stages) next.stages[ev.stage as PublishStage] = "error";
        if (ev.stage === "journal") next.notes.journal = ev.message;
        if (ev.stage === "needs") next.notes.needs = ev.message;
        if (ev.stage === "vote") next.notes.vote = ev.message;
        if (ev.stage === "synthesize") next.notes.synthesize = ev.message;
        return next;
      }

      if (ev.stage === "journal") {
        next.stages.journal = "done";
        next.notes.journal = `Published with ${ev.labels.length} label${ev.labels.length === 1 ? "" : "s"}.`;
      }
      if (ev.stage === "needs") {
        next.stages.needs = "done";
        const first = ev.matched[0];
        if (!first) next.notes.needs = "No need match found.";
        else {
          next.notes.needs = first.isNew
            ? `Seeded new need: ${first.name}.`
            : `Joined ${first.name}, now ${first.voices} voices.`;
        }
      }
      if (ev.stage === "vote") {
        next.stages.vote = "done";
        const moved = ev.deltas.find((d) => d.rankAfter < d.rankBefore);
        next.notes.vote = moved
          ? `+1 to ${moved.name} (rank ${moved.rankBefore} → ${moved.rankAfter}).`
          : (ev.deltas[0] ? `Added weight to ${ev.deltas[0].name}.` : "No ballot delta yet.");
      }
      if (ev.stage === "synthesize" && ev.status === "running") {
        next.stages.synthesize = "running";
        next.notes.synthesize = "Simulating plan delta…";
      }
      if (ev.stage === "synthesize" && ev.status === "done") {
        next.stages.synthesize = "done";
        const diff = ev.diff;
        if (!diff) next.notes.synthesize = "Plan update queued.";
        else if (diff.added.length > 0) next.notes.synthesize = `Moved “${diff.added[0]}” into the plan.`;
        else if ((diff.reinforced?.length ?? 0) > 0) next.notes.synthesize = `Your entry reinforced ${diff.reinforced.length} existing plan item${diff.reinforced.length === 1 ? "" : "s"}.`;
        else if (diff.nearMiss) next.notes.synthesize = `No change yet. ${diff.nearMiss.entriesNeeded} more similar entries would add “${diff.nearMiss.item}”.`;
        else next.notes.synthesize = "No structural plan change yet.";
      }

      return next;
    });
  };

  if (!state) return <div className="loading">Loading…</div>;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden>◎</span>
          <div>
            <h1>Civic Synthesis</h1>
            <p>Journals → needs → open votes → the smallest coherent set of changes</p>
          </div>
        </div>
        <button className="ghost small" onClick={async () => { if (confirm("Reset all your entries and votes?")) { await api("/api/reset", {}); refresh(); } }}>Reset demo</button>
      </header>

      <nav className="loop" aria-label="Steps">
        {TABS.map((t, i) => {
          const stage = STAGE_BY_TAB[t.id];
          const status = publishFlow.stages[stage];
          const note = publishFlow.notes[stage] ?? t.hint;
          return (
            <button key={t.id} className={`step ${tab === t.id ? "on" : ""} ${status !== "idle" ? `step-${status}` : ""}`} onClick={() => setTab(t.id)}>
              <span className="num">{status === "done" ? "✓" : status === "running" ? "…" : status === "error" ? "!" : t.n}</span>
              <span><b>{t.label}</b><small>{note}</small></span>
              {i < TABS.length - 1 && <span className="arrow" aria-hidden>→</span>}
            </button>
          );
        })}
      </nav>

      <main>
        {tab === "journal" && <JournalView state={state} refresh={refresh} liveStatus={liveStatus} onPublishStart={onPublishStart} onPublishEvent={onPublishEvent} onSeeNeed={(needId) => { setTab("needs"); setFocusNeedId(needId); }} />}
        {tab === "needs" && <NeedsView state={state} focusNeedId={focusNeedId} />}
        {tab === "vote" && <VoteView state={state} refresh={refresh} />}
        {tab === "synth" && <SynthView state={state} />}
      </main>

      <footer>
        Prototype. Signals blend {state.population.realVoices ?? 0} real voices with {state.population.n} simulated residents ({state.population.archetypes.map((a) => a.name).join(", ")}). Costs and support figures are illustrative.
      </footer>
    </div>
  );
}

/* ------------------------------ shared bits ------------------------------ */

function Bar({ value, tone = "accent", label }: { value: number; tone?: string; label?: string }) {
  return (
    <div className="bar" title={label}>
      <div className={`fill ${tone}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

function Split({ s }: { s: ProposalStats }) {
  return (
    <div className="split" title={`Support ${pct(s.support)} · Neutral ${pct(s.neutral)} · Oppose ${pct(s.oppose)}`}>
      <div className="sup" style={{ width: pct(s.support) }} />
      <div className="neu" style={{ width: pct(s.neutral) }} />
      <div className="opp" style={{ width: pct(s.oppose) }} />
    </div>
  );
}

function SplitLegend({ s }: { s: ProposalStats }) {
  return (
    <div className="legend">
      <span><i className="dot sup" />{pct(s.support)} support</span>
      <span><i className="dot neu" />{pct(s.neutral)} neutral</span>
      <span><i className="dot opp" />{pct(s.oppose)} oppose</span>
    </div>
  );
}

const needLabel = (state: AppState, id: string) => state.needs.find((n) => n.id === id)?.label ?? id;

/* -------------------------------- Journal -------------------------------- */

function JournalView({
  state,
  refresh,
  liveStatus,
  onPublishStart,
  onPublishEvent,
  onSeeNeed,
}: {
  state: AppState;
  refresh: () => void;
  liveStatus: LiveStatus;
  onPublishStart: (forkId: string) => void;
  onPublishEvent: (ev: StageEvent) => void;
  onSeeNeed: (needId: string) => void;
}) {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [preview, setPreview] = useState<{ labels: string[]; matched: { need_id: string; name: string; voices: number }[]; deltas: { item_id: string; name: string; rankBefore: number; rankAfter: number }[] } | null>(null);
  const [undo, setUndo] = useState<{ forkId: string; expiresAt: number; needId: string | null } | null>(null);
  const [undoLeft, setUndoLeft] = useState(0);

  useEffect(() => {
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await api<{ labels: string[]; matched: { need_id: string; name: string; voices: number }[]; deltas: { item_id: string; name: string; rankBefore: number; rankAfter: number }[] }>("/api/entries/preview", { text });
      setPreview(res);
    }, 800);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    if (!undo) return;
    const tick = () => {
      const left = Math.max(0, undo.expiresAt - Date.now());
      setUndoLeft(left);
      if (left === 0) setUndo(null);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [undo]);

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    const published = await api<{ entry_id: string; fork_id: string; entry: JournalEntry }>("/api/entries", {
      text,
      author,
      labels: preview?.labels ?? [],
    });
    onPublishStart(published.fork_id);
    setEntry(published.entry);
    setText("");
    setBusy(false);
    refresh();

    const es = new EventSource(`/api/forks/${published.fork_id}/events`);
    let needFocus: string | null = null;
    es.onmessage = (m) => {
      const ev: StageEvent = JSON.parse(m.data);
      onPublishEvent(ev);
      if (ev.stage === "needs" && ev.status === "done") needFocus = ev.matched[0]?.need_id ?? null;
      if (ev.stage === "synthesize" && ev.status === "done") {
        setUndo({ forkId: published.fork_id, expiresAt: Date.now() + 10_000, needId: needFocus });
        es.close();
      }
      if (ev.status === "error") es.close();
    };
    es.onerror = () => es.close();
  }

  async function undoPublish() {
    if (!undo) return;
    await api(`/api/forks/${undo.forkId}/undo`, {});
    setUndo(null);
    setEntry(null);
    refresh();
  }

  const previewNeedsLine = preview?.matched.length
    ? `Would join: ${preview.matched[0]!.name}${preview.matched.length > 1 ? ` + ${preview.matched.length - 1} more` : ""}.`
    : "No need match yet.";

  return (
    <div className="grid two">
      <section className="card">
        <h2 className="prompt">What's happening in your life? What would make it better?</h2>
        <p className="muted">Publish is now staged: Journal → Needs → Vote → Synthesize.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Rent went up again and the bus to my job takes over an hour…"
          rows={6}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
        />
        {text.trim() && <p className="note faint">{previewNeedsLine}</p>}
        {preview?.labels?.length ? (
          <div className="chips">{preview.labels.map((id) => <span key={id} className="chip s">{needLabel(state, id)}</span>)}</div>
        ) : null}
        <div className="row">
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Name · neighborhood (optional)" />
          <button onClick={submit} disabled={busy || !text.trim()}>{busy ? "Publishing…" : "Publish"}</button>
        </div>

        {entry && (
          <div className="interp">
            <div className="interp-head">
              <h3>Published</h3>
              <span className="badge ok">live</span>
            </div>
            <blockquote>{entry.text}</blockquote>
            <label className="lbl">Locked labels</label>
            <div className="chips">
              {entry.extraction.needs.map((n) => <span key={n.id} className="chip">{needLabel(state, n.id)}</span>)}
            </div>
          </div>
        )}

        {undo && (
          <div className="interp">
            <div className="row">
              <button className="ghost" onClick={undoPublish}>Undo ({Math.ceil(undoLeft / 1000)}s)</button>
              {undo.needId && <button className="ghost" onClick={() => onSeeNeed(undo.needId!)}>See where your entry went</button>}
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>
          Recent entries <span className="count">{state.entries.length}</span>{" "}
          <span className={`badge live-status ${liveStatus === "live" ? "live ok" : "new"}`}>{liveStatus === "live" ? "Live" : liveStatus === "connecting" ? "Connecting…" : "Reconnecting…"}</span>
        </h2>
        <p className="muted">Every interpretation stays attached to the original words.</p>
        <ul className="feed">
          {state.entries.map((e) => (
            <li key={e.id}>
              <p>{e.text}</p>
              <div className="feed-meta">
                <span className="who">{e.author}</span>
                {e.extraction.needs.map((n) => <span key={n.id} className="chip s">{needLabel(state, n.id)}</span>)}
                {e.corrected && <span className="badge ok">corrected</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* --------------------------------- Needs --------------------------------- */

function NeedsView({ state, focusNeedId }: { state: AppState; focusNeedId: string | null }) {
  const sorted = useMemo(() => [...state.needs].sort((a, b) => state.demand[b.id]!.demand - state.demand[a.id]!.demand), [state]);
  const [sel, setSel] = useState(focusNeedId ?? sorted[0]!.id);
  useEffect(() => {
    if (focusNeedId) setSel(focusNeedId);
  }, [focusNeedId]);
  const need = state.needs.find((n) => n.id === sel)!;
  const props = state.proposals.filter((p) => p.needId === sel);

  const jurisdictions = ["Houston", "Harris County", "Texas", "United States"];
  const byJur = jurisdictions.map((j) => {
    const needIds = [...new Set(state.proposals.filter((p) => p.jurisdiction === j && !p.rightsIssue).map((p) => p.needId))];
    return { j, ranked: needIds.map((id) => ({ id, d: state.demand[id]!.demand })).sort((a, b) => b.d - a.d).slice(0, 5) };
  });

  return (
    <div className="grid two">
      <section className="card">
        <h2>Shared needs</h2>
        <p className="muted">Blends how often and how urgently people write about something with how they spend their priority points.</p>
        <ul className="needs">
          {sorted.map((n) => {
            const d = state.demand[n.id]!;
            return (
              <li key={n.id} className={sel === n.id ? "on" : ""}>
                <button onClick={() => setSel(n.id)}>
                  <div className="need-top"><b>{n.label}</b><span className="num-s">{Math.round(d.demand * 100)}</span></div>
                  <Bar value={d.demand} />
                  <small>{d.journalCount} journal mention{d.journalCount === 1 ? "" : "s"} · {d.avgPoints} avg priority pts</small>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="stack">
        <div className="card">
          <h2>{need.label}</h2>
          <ol className="ladder">
            <li><span>Value</span>{need.value}</li>
            <li><span>Goal</span>{need.goal}</li>
            <li><span>Metric</span>{need.metric}</li>
            <li>
              <span>Policies</span>
              <ul className="policies">
                {props.map((p) => (
                  <li key={p.id}>
                    <div className="pol-head">
                      <b>{p.title}</b>
                      {p.rightsIssue && <span className="badge bad">Rights conflict</span>}
                      {p.emergent && <span className="badge new">Citizen idea</span>}
                    </div>
                    <Split s={state.stats[p.id]!} />
                    <small className="muted">{state.changeLevels[p.changeLevel]} · {p.authority} · {money(p.costB)}</small>
                  </li>
                ))}
              </ul>
            </li>
            <li><span>Implementation</span>See the Synthesize step</li>
          </ol>
        </div>

        <div className="card">
          <h2>Constituent priorities by jurisdiction</h2>
          <p className="muted">What each level of government would see this week, limited to needs it has tools for.</p>
          <div className="jur">
            {byJur.map(({ j, ranked }) => (
              <div key={j}>
                <h4>{j}</h4>
                <ol>{ranked.map((r) => <li key={r.id}><span>{needLabel(state, r.id)}</span><b>{Math.round(r.d * 100)}</b></li>)}</ol>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* --------------------------------- Vote ---------------------------------- */

const STANCES: { v: Stance; label: string }[] = [
  { v: -2, label: "Strongly oppose" }, { v: -1, label: "Oppose" }, { v: 0, label: "Neutral" }, { v: 1, label: "Support" }, { v: 2, label: "Strongly support" },
];

function VoteView({ state, refresh }: { state: AppState; refresh: () => void }) {
  const [alloc, setAlloc] = useState<Record<string, number>>(() => ({ ...state.user.allocation }));
  const [needId, setNeedId] = useState(state.needs[0]!.id);
  const [answer, setAnswer] = useState("");
  const [answerMsg, setAnswerMsg] = useState("");
  const [votes, setVotes] = useState<Record<string, UserVote>>(() => ({ ...state.user.votes }));
  const [saved, setSaved] = useState("");

  const used = Object.values(alloc).reduce((s, v) => s + v, 0);
  const need = state.needs.find((n) => n.id === needId)!;
  const props = state.proposals.filter((p) => p.needId === needId);
  const goalVote = state.user.goalVotes[needId];

  const setPts = (id: string, v: number) => {
    const others = used - (alloc[id] ?? 0);
    setAlloc({ ...alloc, [id]: Math.max(0, Math.min(v, 100 - others)) });
  };

  const vote = (pid: string, patch: Partial<UserVote>) => {
    const cur = votes[pid] ?? { proposalId: pid, stance: 0 as Stance, importance: 0.5, acceptCompromise: true, concern: "", changeMind: "" };
    setVotes({ ...votes, [pid]: { ...cur, ...patch } });
  };

  async function saveAll(msg: string) {
    await api("/api/votes", { votes: Object.values(votes), allocation: alloc });
    setSaved(msg);
    setTimeout(() => setSaved(""), 2500);
    refresh();
  }

  async function submitAnswer() {
    if (!answer.trim()) return;
    const r = await api<{ proposalId: string; isNew: boolean }>("/api/answers", { needId, text: answer });
    setAnswerMsg(r.isNew ? "That's a new idea. It now appears as its own option for others to weigh in on." : "Grouped with a similar idea people already suggested.");
    setAnswer("");
    refresh();
  }

  const mech = props.map((p) => ({ p, share: state.mechanismShare[p.id] ?? 0, mine: state.user.answers.filter((a) => a.proposalId === p.id).length }))
    .sort((a, b) => b.share - a.share || b.mine - a.mine);

  return (
    <div className="grid vote">
      <section className="card">
        <h2>Your priority points</h2>
        <p className="muted">100 points to spend this month. Shows how much each issue matters to you, not just which side you're on.</p>
        <div className={`pts-left ${used >= 100 ? "full" : ""}`}><b>{100 - used}</b> points left</div>
        <ul className="alloc">
          {state.needs.map((n) => (
            <li key={n.id}>
              <span>{n.label}</span>
              <input type="range" min={0} max={100} step={5} value={alloc[n.id] ?? 0} onChange={(e) => setPts(n.id, Number(e.target.value))} aria-label={n.label} />
              <b className="num-s">{alloc[n.id] ?? 0}</b>
            </li>
          ))}
        </ul>
        <div className="row end">
          {saved && <span className="saved">{saved}</span>}
          <button onClick={() => saveAll("Priorities saved")}>Save priorities</button>
        </div>
      </section>

      <section className="stack">
        <div className="card">
          <div className="need-tabs">
            {state.needs.map((n) => <button key={n.id} className={`chip-btn ${n.id === needId ? "on" : ""}`} onClick={() => { setNeedId(n.id); setAnswerMsg(""); }}>{n.label}</button>)}
          </div>

          <h3 className="q">Step 1 · Agree on the goal</h3>
          <p className="goal">Should we commit to this: <b>{need.goal}</b>?</p>
          <div className="row">
            <button className={goalVote === true ? "" : "ghost"} onClick={async () => { await api("/api/votes", { goalVotes: { [needId]: true } }); refresh(); }}>Yes</button>
            <button className={goalVote === false ? "" : "ghost"} onClick={async () => { await api("/api/votes", { goalVotes: { [needId]: false } }); refresh(); }}>No</button>
            <div className="goal-res"><Bar value={state.goalSupport[needId]!} tone="sup" /><span>{pct(state.goalSupport[needId]!)} say yes</span></div>
          </div>

          <h3 className="q">Step 2 · How should we get there?</h3>
          <p className="muted">Write your own answer. It's grouped with similar ideas, or becomes a new option.</p>
          <div className="row">
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your idea…" onKeyDown={(e) => e.key === "Enter" && submitAnswer()} />
            <button onClick={submitAnswer} disabled={!answer.trim()}>Submit idea</button>
          </div>
          {answerMsg && <p className="note">{answerMsg}</p>}

          <table className="mech">
            <thead><tr><th>Preferred approach</th><th className="r">Share</th></tr></thead>
            <tbody>
              {mech.map(({ p, share, mine }) => (
                <tr key={p.id}>
                  <td>{p.title}{mine > 0 && <span className="badge new">your idea ×{mine}</span>}{p.rightsIssue && <span className="badge bad">rights conflict</span>}</td>
                  <td className="r">{pct(share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 className="q">Step 3 · Weigh in on each option</h3>
          <ul className="ballot">
            {props.map((p) => {
              const v = votes[p.id];
              return (
                <li key={p.id}>
                  <div className="pol-head"><b>{p.title}</b><span className="muted s">{money(p.costB)} · {state.changeLevels[p.changeLevel]}</span></div>
                  <Split s={state.stats[p.id]!} />
                  <div className="stances">
                    {STANCES.map((s) => (
                      <button key={s.v} className={`st st${s.v} ${v?.stance === s.v ? "on" : ""}`} onClick={() => vote(p.id, { stance: s.v })}>{s.label}</button>
                    ))}
                  </div>
                  {v && (
                    <div className="vote-more">
                      <label>Importance<input type="range" min={0} max={1} step={0.05} value={v.importance} onChange={(e) => vote(p.id, { importance: Number(e.target.value) })} /></label>
                      <label className="check"><input type="checkbox" checked={v.acceptCompromise} onChange={(e) => vote(p.id, { acceptCompromise: e.target.checked })} />I'd accept this as a compromise</label>
                      <input value={v.concern} onChange={(e) => vote(p.id, { concern: e.target.value })} placeholder="What concern do you have?" />
                      <input value={v.changeMind} onChange={(e) => vote(p.id, { changeMind: e.target.value })} placeholder="What would change your mind?" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="row end">
            {saved && <span className="saved">{saved}</span>}
            <button onClick={() => saveAll("Votes saved")}>Save votes</button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------- Synthesize ------------------------------ */

const WEIGHT_LABELS: Record<keyof Weights, string> = {
  support: "Public support", welfare: "Expected welfare gain", fairness: "Fairness (low strong opposition)",
  feasibility: "Feasibility", reversibility: "Reversibility", evidence: "Evidence quality",
};

function SynthView({ state }: { state: AppState }) {
  const [weights, setWeights] = useState<Weights>(state.defaultWeights);
  const [lambda, setLambda] = useState(0.25);
  const [budget, setBudget] = useState(40);
  const [pkgs, setPkgs] = useState<PackageResult[] | null>(null);
  const [active, setActive] = useState("A");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setPkgs(await api<PackageResult[]>("/api/synthesize", { weights, lambda, budget }));
    setBusy(false);
  }
  useEffect(() => { run(); }, []);

  const pkg = pkgs?.find((p) => p.id === active);

  return (
    <div className="grid synth">
      <section className="card controls">
        <h2>Synthesis settings</h2>
        <p className="muted">In a real deployment these weights would themselves be set democratically.</p>
        {(Object.keys(WEIGHT_LABELS) as (keyof Weights)[]).map((k) => (
          <label key={k} className="slider">
            <span>{WEIGHT_LABELS[k]}</span>
            <input type="range" min={0} max={1} step={0.05} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} />
            <b className="num-s">{weights[k].toFixed(2)}</b>
          </label>
        ))}
        <hr />
        <label className="slider">
          <span>Institutional-change penalty</span>
          <input type="range" min={0} max={1} step={0.05} value={lambda} onChange={(e) => setLambda(Number(e.target.value))} />
          <b className="num-s">{lambda.toFixed(2)}</b>
        </label>
        <label className="slider">
          <span>Annual budget</span>
          <input type="range" min={5} max={150} step={5} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          <b className="num-s">${budget}B</b>
        </label>
        <button className="big" onClick={run} disabled={busy}>{busy ? "Synthesizing…" : "Synthesize"}</button>
      </section>

      <section className="stack">
        {pkgs && (
          <div className="pkg-tabs">
            {pkgs.map((p) => (
              <button key={p.id} className={`pkg ${p.id === active ? "on" : ""}`} onClick={() => setActive(p.id)}>
                <span className="pkg-name">Package {p.id} · {p.name}</span>
                <span className="pkg-sub">{p.items.length} changes · {money(p.totalCost)} · {pct(p.avgSupport)} avg support</span>
              </button>
            ))}
          </div>
        )}

        {pkg && (<>
          <div className="card">
            <div className="plan-head">
              <div>
                <h2>The synthesis</h2>
                <p className="muted">{pkg.description}. These {pkg.items.length} changes address the highest-priority needs with the least institutional disruption that fits the budget.</p>
              </div>
              <div className="kpis">
                <div><b>{money(pkg.totalCost)}</b><small>of ${pkg.budget}B</small></div>
                <div><b>{pct(pkg.avgSupport)}</b><small>avg support</small></div>
                <div><b>{pkg.avgChange.toFixed(1)}</b><small>avg change level</small></div>
              </div>
            </div>
            <Bar value={pkg.totalCost / pkg.budget} tone="accent" />
            <ol className="plan">
              {pkg.items.map((it) => <PlanRow key={it.proposal.id} it={it} state={state} />)}
            </ol>
          </div>

          {pkg.unfundedPopularCost > 0 && (
            <div className="card warn">
              <h3>Budget conflict</h3>
              <p>Options with more support than opposition that didn't fit would cost another <b>{money(pkg.unfundedPopularCost)}</b> a year. Raise the budget, add a funding source, or accept the tradeoff.</p>
              <ul className="plain">
                {pkg.deferred.filter((d) => d.reason.startsWith("Doesn't fit")).map((d) => <li key={d.title}>{d.title} · {money(d.costB)} · {pct(d.support)} support</li>)}
              </ul>
            </div>
          )}

          {pkg.blocked.length > 0 && (
            <div className="card bad">
              <h3>Blocked by rights constraints</h3>
              <p className="muted">Excluded no matter how popular. Majority preference can't override fundamental rights.</p>
              {pkg.blocked.map((b) => <div key={b.title} className="blocked"><b>{b.title}</b> <span className="badge">{pct(b.support)} support</span><p>{b.issue}</p></div>)}
            </div>
          )}

          {pkg.emerging.length > 0 && (
            <div className="card">
              <h3>Emerging citizen ideas</h3>
              <p className="muted">New options from open-ended answers. They need costing and legal review before they can enter a plan.</p>
              <ul className="plain">{pkg.emerging.map((e) => <li key={e.title}>{e.title}</li>)}</ul>
            </div>
          )}

          <details className="card">
            <summary>Everything else considered ({pkg.deferred.length})</summary>
            <table className="mech">
              <thead><tr><th>Option</th><th>Cost</th><th>Support</th><th>Why not included</th></tr></thead>
              <tbody>{pkg.deferred.map((d) => <tr key={d.title}><td>{d.title}</td><td>{money(d.costB)}</td><td>{pct(d.support)}</td><td>{d.reason}</td></tr>)}</tbody>
            </table>
          </details>
        </>)}
      </section>
    </div>
  );
}

function PlanRow({ it, state }: { it: PlanItem; state: AppState }) {
  const [open, setOpen] = useState(false);
  const p = it.proposal;
  return (
    <li className={`plan-item ${open ? "open" : ""}`}>
      <button className="plan-sum" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="plan-title">
          <b>{p.title}</b>
          <small>{it.needLabel} · {p.authority} · {state.changeLevels[p.changeLevel]}</small>
        </div>
        <div className="plan-nums">
          <span>{money(p.costB)}</span>
          <Split s={it.stats} />
        </div>
        <span className="chev" aria-hidden>{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="why">
          <div className="why-grid">
            <div>
              <h4>Why?</h4>
              <ul className="bars">
                <li><span>Need demand</span><Bar value={it.demand.demand} /><b>{pct(it.demand.demand)}</b></li>
                <li><span>Prefer this approach</span><Bar value={it.mechanismShare} /><b>{pct(it.mechanismShare)}</b></li>
                <li><span>Support</span><Bar value={it.stats.support} tone="sup" /><b>{pct(it.stats.support)}</b></li>
                <li><span>Feasibility</span><Bar value={it.parts.feasibility} /><b>{pct(it.parts.feasibility)}</b></li>
                <li><span>Evidence</span><Bar value={it.parts.evidence} /><b>{pct(it.parts.evidence)}</b></li>
              </ul>
              <small className="muted">Score {it.score.toFixed(2)} (change penalty −{it.changeCost.toFixed(2)})</small>
            </div>
            <div>
              <h4>Who asked for this?</h4>
              <p className="muted s">{it.demand.journalCount} journal entries · {it.demand.avgPoints} avg priority points</p>
              {it.quotes.map((q) => <blockquote key={q.text}>{q.text}<cite>{q.author}</cite></blockquote>)}
              {it.yourAnswers.map((a) => <blockquote key={a} className="mine">{a}<cite>Your idea</cite></blockquote>)}
            </div>
          </div>

          <div className="why-grid">
            <div>
              <h4>Who disagrees?</h4>
              <SplitLegend s={it.stats} />
              <ul className="bars">
                {it.stats.objections.filter((o) => o.share > 0).map((o) => (
                  <li key={o.key}><span>{o.text}</span><Bar value={o.share} tone="opp" /><b>{pct(o.share)}</b></li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Changed because of those objections</h4>
              {it.mitigations.length ? <ul className="plain">{it.mitigations.map((m) => <li key={m}>{m}</li>)}</ul> : <p className="muted">No objection cited by 15%+ of opponents.</p>}
            </div>
          </div>

          <dl className="facts">
            <div><dt>Cost</dt><dd>{money(p.costB)} / year</dd></div>
            <div><dt>Who implements it</dt><dd>{p.authority} via {p.mechanism}</dd></div>
            <div><dt>Jurisdiction</dt><dd>{p.jurisdiction}</dd></div>
            <div><dt>Law change</dt><dd>{p.legalChange}</dd></div>
            <div><dt>New agency</dt><dd>{it.newAgency ? "Yes" : "No"}</dd></div>
            <div><dt>Rollout</dt><dd>{it.rollout}</dd></div>
            <div><dt>How we'd know it worked</dt><dd>{p.metrics.map((m) => <code key={m}>{m}</code>)}</dd></div>
          </dl>

          <details className="handoff">
            <summary>Legislative handoff</summary>
            <pre>{JSON.stringify(it.handoff, null, 2)}</pre>
            <button className="ghost small" onClick={() => navigator.clipboard?.writeText(JSON.stringify(it.handoff, null, 2))}>Copy JSON</button>
          </details>
        </div>
      )}
    </li>
  );
}

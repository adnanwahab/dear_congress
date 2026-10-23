import { useEffect, useMemo, useState } from "react";
import type {
  JournalEntry, NeedDef, NeedDemand, PackageResult, PlanItem, Proposal, ProposalStats, Stance, UserVote, Weights,
} from "../engine/types";

interface AppState {
  needs: NeedDef[];
  changeLevels: string[];
  proposals: Proposal[];
  stats: Record<string, ProposalStats>;
  demand: Record<string, NeedDemand>;
  mechanismShare: Record<string, number>;
  goalSupport: Record<string, number>;
  entries: JournalEntry[];
  population: { n: number; archetypes: { name: string; share: number }[] };
  user: { votes: Record<string, UserVote>; allocation: Record<string, number>; goalVotes: Record<string, boolean>; answers: { id: string; needId: string; text: string; proposalId: string }[] };
  defaultWeights: Weights;
}

async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const money = (b: number | null) => (b === null ? "Not costed" : b >= 1 ? `$${b.toFixed(1)}B` : b > 0 ? `$${Math.round(b * 1000)}M` : "$0");

type Tab = "journal" | "needs" | "vote" | "synth";
const TABS: { id: Tab; n: string; label: string; hint: string }[] = [
  { id: "journal", n: "1", label: "Journal", hint: "Describe your life" },
  { id: "needs", n: "2", label: "Needs", hint: "What people share" },
  { id: "vote", n: "3", label: "Vote", hint: "Goals, ideas, priorities" },
  { id: "synth", n: "4", label: "Synthesize", hint: "One coherent plan" },
];

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>("journal");
  const refresh = () => api<AppState>("/api/state").then(setState);
  useEffect(() => { refresh(); }, []);

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
        {TABS.map((t, i) => (
          <button key={t.id} className={`step ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
            <span className="num">{t.n}</span>
            <span><b>{t.label}</b><small>{t.hint}</small></span>
            {i < TABS.length - 1 && <span className="arrow" aria-hidden>→</span>}
          </button>
        ))}
      </nav>

      <main>
        {tab === "journal" && <JournalView state={state} refresh={refresh} />}
        {tab === "needs" && <NeedsView state={state} />}
        {tab === "vote" && <VoteView state={state} refresh={refresh} />}
        {tab === "synth" && <SynthView state={state} />}
      </main>

      <footer>
        Prototype. Opinions come from {state.user ? "your inputs plus " : ""}{state.population.n} simulated residents ({state.population.archetypes.map((a) => a.name).join(", ")}). Costs and support figures are illustrative.
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

function JournalView({ state, refresh }: { state: AppState; refresh: () => void }) {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [draftNeeds, setDraftNeeds] = useState<string[]>([]);

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    const e = await api<JournalEntry>("/api/journal", { text, author });
    setEntry(e);
    setDraftNeeds(e.extraction.needs.map((n) => n.id));
    setText("");
    setBusy(false);
    refresh();
  }

  async function saveCorrection() {
    if (!entry) return;
    const e = await api<JournalEntry>(`/api/journal/${entry.id}`, { needs: draftNeeds }, "PATCH");
    setEntry(e);
    refresh();
  }

  const changed = entry && draftNeeds.join() !== entry.extraction.needs.map((n) => n.id).join();

  return (
    <div className="grid two">
      <section className="card">
        <h2 className="prompt">What's happening in your life? What would make it better?</h2>
        <p className="muted">Write normally. No policy language needed.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Rent went up again and the bus to my job takes over an hour…"
          rows={6}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
        />
        <div className="row">
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Name · neighborhood (optional)" />
          <button onClick={submit} disabled={busy || !text.trim()}>{busy ? "Reading…" : "Add to journal"}</button>
        </div>

        {entry && (
          <div className="interp">
            <div className="interp-head">
              <h3>How the system read this</h3>
              {entry.corrected && <span className="badge ok">Corrected by you</span>}
            </div>
            <blockquote>{entry.text}</blockquote>

            <label className="lbl">Needs</label>
            <div className="chips">
              {draftNeeds.length === 0 && <span className="muted">No needs detected. Add one below.</span>}
              {draftNeeds.map((id) => (
                <span key={id} className="chip">
                  {needLabel(state, id)}
                  <button aria-label="Remove" onClick={() => setDraftNeeds(draftNeeds.filter((x) => x !== id))}>×</button>
                </span>
              ))}
              <select value="" onChange={(e) => e.target.value && setDraftNeeds([...draftNeeds, e.target.value])}>
                <option value="">+ add a need</option>
                {state.needs.filter((n) => !draftNeeds.includes(n.id)).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
            </div>

            <label className="lbl">Importance</label>
            <div className="row tight"><Bar value={entry.extraction.importance} /><span className="num-s">{pct(entry.extraction.importance)}</span></div>

            {entry.extraction.constraints.length > 0 && (<>
              <label className="lbl">Constraints</label>
              <ul className="plain">{entry.extraction.constraints.map((c) => <li key={c}>{c}</li>)}</ul>
            </>)}
            {entry.extraction.concerns.length > 0 && (<>
              <label className="lbl">Concerns</label>
              <ul className="plain">{entry.extraction.concerns.map((c) => <li key={c}>“{c}”</li>)}</ul>
            </>)}
            {entry.extraction.proposalIds.length > 0 && (<>
              <label className="lbl">Ideas it relates to</label>
              <ul className="plain">{entry.extraction.proposalIds.map((id) => <li key={id}>{state.proposals.find((p) => p.id === id)?.title}</li>)}</ul>
            </>)}

            <div className="row end">
              {changed
                ? <button onClick={saveCorrection}>Save correction</button>
                : <button className="ghost" onClick={() => setEntry(null)}>Looks right</button>}
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Recent entries <span className="count">{state.entries.length}</span></h2>
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

function NeedsView({ state }: { state: AppState }) {
  const sorted = useMemo(() => [...state.needs].sort((a, b) => state.demand[b.id]!.demand - state.demand[a.id]!.demand), [state]);
  const [sel, setSel] = useState(sorted[0]!.id);
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

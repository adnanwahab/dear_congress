import { useEffect, useId, useState } from "react";
import { EVIDENCE_QUESTIONS, PILOT_SCOPE, PILOT_TEXT, evidenceUpdateUrl } from "./evidence-conditions";
import "./evidence-conditions.css";
import type { PolicyComparison } from "../server/policy-comparison";

export function PolicyComparisonPanel() {
  const [a, setA] = useState("A");
  const [b, setB] = useState("B");
  const [seed, setSeed] = useState("42");
  const [comparison, setComparison] = useState<PolicyComparison | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load(url: string, init?: RequestInit) {
    setBusy(true); setError("");
    try {
      const response = await fetch(url, init);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Comparison unavailable");
      setComparison(data.comparison);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("comparison");
    if (id) void load(`/api/policy-comparisons/${encodeURIComponent(id)}`);
  }, []);
  const valid = seed.trim() !== "" && Number.isInteger(Number(seed)) && Number(seed) >= 0 && Number(seed) <= 0xffffffff;
  return <section className="card" aria-label="Policy comparison pilot">
    <h3>Compare frozen policy inputs</h3>
    <p>Simulation, not forecast. Advisory only. This pilot captures two packages using default settings (budget 40, real voices); it does not use the customized plan above.</p>
    <fieldset disabled={busy}>
      <legend>Choose comparison inputs</legend>
      {([["World A", a, setA], ["World B", b, setB]] as const).map(([label, value, setter]) => <label key={label}>{label} <select value={value} onChange={e => setter(e.target.value)}>
        <option value="A">Balanced</option><option value="B">Minimal change</option><option value="C">Most popular</option>
      </select> </label>)}
      <label>Shared seed <input type="number" min="0" max="4294967295" step="1" value={seed} onChange={e => setSeed(e.target.value)} /></label>
      <button disabled={!valid} onClick={() => void load("/api/policy-comparisons", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ a, b, seed: Number(seed) }) })}>Capture comparison</button>
    </fieldset>
    <p role="status">{busy ? "Loading comparison…" : comparison ? "Frozen inputs ready. Model execution unavailable." : ""}</p>
    {!valid && <p role="alert">Seed must be a whole number from 0 to 4,294,967,295.</p>}
    {error && <p role="alert">{error}</p>}
    {comparison && <ComparisonDetails comparison={comparison} />}
  </section>;
}

export function ComparisonDetails({ comparison }: { comparison: PolicyComparison }) {
  return <div>
    <p>100 shared run seeds; horizons 1, 5 and 10 years. No WebGPU required to inspect or replay these inputs. A shared schedule is not evidence of paired model execution.</p>
    <table><caption>Frozen package inputs — {comparison.content.costUnits}</caption>
      <thead><tr><th scope="col">World</th><th scope="col">Package</th><th scope="col">Policies</th><th scope="col">Illustrative cost</th></tr></thead>
      <tbody>{comparison.content.worlds.map((world, index) => <tr key={index}><th scope="row">{index === 0 ? "A" : "B"}</th><td>{world.name}</td><td>{world.items.map(item => item.proposal.title).join("; ") || "No selected policies"}</td><td>{world.totalCost}</td></tr>)}</tbody>
    </table>
    <p>Housing, commuting, flood, fiscal and distribution outcomes at every horizon: unknown. Median, p10, p90 and paired effects unavailable; no model runs have been executed. These costs are policy inputs, not measured or modeled outcomes.</p>
    <label>Share/replay link <input readOnly value={`${location.origin}/synth?comparison=${comparison.id}`} onFocus={e => e.currentTarget.select()} /></label>
    <p><a href={`/api/policy-comparisons/${comparison.id}`} target="_blank" rel="noopener">Inspect frozen provenance and seed schedule (JSON)</a></p>
    <details><summary>Input provenance and identity</summary>
      <p style={{ overflowWrap: "anywhere" }}>Input SHA-256: {comparison.inputHash}. This is not a result hash. Source: {comparison.content.sourceRepository}; revision: {comparison.content.sourceRevision ?? "unknown (local build)"}. Receiving model version: unavailable.</p>
      <p>Server-stored replay survives policy changes and restart on the same database. Export the JSON for your records; availability depends on that database being retained.</p>
    </details>
  </div>;
}

/** Private, page-memory sandbox. Intentionally has no API or voting dependency. */
export function EvidenceConditionCards({ scope }: { scope: string }) {
  // Key the editor by exact source identity even if a caller reuses the component.
  return scope === PILOT_SCOPE ? <EvidenceConditionEditor key={scope} /> : null;
}

function EvidenceConditionEditor() {
  const [cards, setCards] = useState<Record<string, { condition: string; title: string; url: string; locator: string; linked: boolean }>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const prefix = useId();
  const patch = (id: string, values: Partial<(typeof cards)[string]>) => {
    setCards(previous => ({ ...previous, [id]: { ...previous[id]!, ...values } }));
    setMessage('Private edits kept on this page only.'); setError('');
  };
  return <section className="evidence-conditions" aria-label="Private evidence conditions">
    <h4>What evidence would change my mind?</h4>
    <p>Optional fictional sandbox. Name a threshold; you do not have to change your mind. Nothing here is verified civic participation, and no card changes any vote or creates a public political profile.</p>
    <p>Private to this page, visible to anyone looking at this screen. Text is not sent or saved to browser storage. Leaving or reloading discards it. Avoid sensitive information.</p>
    <details><summary>Try a private evidence card</summary>
      <p>Questions from the sample proposal’s unresolved access and funding claims. No claim-level evidence has been supplied; these templates are prompts, not findings.</p>
      <p className="evidence-scope">Source revision: {PILOT_SCOPE} · exact clause: {PILOT_TEXT}</p>
      {EVIDENCE_QUESTIONS.map(question => {
        const card = cards[question.id];
        return <fieldset key={question.id}>
          <legend>{question.question}</legend>
          {!card ? <button type="button" onClick={() => {
            setCards(previous => ({ ...previous, [question.id]: { condition: question.template, title: '', url: '', locator: '', linked: false } }));
            setMessage('Template added privately. Replace bracketed prompts with your threshold.'); setError('');
          }}>Use {question.id === 'access' ? 'access' : 'funding'} template</button> : <>
            <label>My evidence threshold<textarea maxLength={2000} rows={5} value={card.condition} onChange={e => patch(question.id, { condition: e.target.value })} /></label>
            <p>Specify a measure, baseline, minimum change, time period and whose experience matters. A threshold is your judgment, not a promise to vote.</p>
            <label>Published update title<input maxLength={200} value={card.title} onChange={e => patch(question.id, { title: e.target.value, linked: false })} /></label>
            <label>Published update URL<input type="url" inputMode="url" maxLength={2000} value={card.url} onChange={e => patch(question.id, { url: e.target.value, linked: false })} /></label>
            <label>Publication date, passage or table locator<input maxLength={500} value={card.locator} onChange={e => patch(question.id, { locator: e.target.value, linked: false })} /></label>
            <p>No update yet? Leave these fields blank and return when evidence is published. Links are not fetched, monitored or verified. You decide whether an update meets your threshold.</p>
            <div className="evidence-actions"><button type="button" onClick={() => {
              if (!card.title.trim() || !card.locator.trim() || !evidenceUpdateUrl(card.url)) {
                setError('Enter an update title, an HTTP(S) URL without credentials, and a publication date or passage locator. Your edits are retained.'); setMessage(''); return;
              }
              patch(question.id, { linked: true }); setMessage('Published update linked privately. Evidence remains unverified; no vote changed.');
            }}>Link published update privately</button>
            <button type="button" onClick={() => {
              setCards(previous => { const next = { ...previous }; delete next[question.id]; return next; });
              setMessage('Private card discarded. No vote changed.'); setError('');
            }}>Discard {question.id} card</button></div>
            {card.linked && <p>Unverified evidence update: <a href={evidenceUpdateUrl(card.url)!} target="_blank" rel="noopener noreferrer">{card.title}</a> · {card.locator}. Opening this link visits the publisher; your condition is not included.</p>}
          </>}
        </fieldset>;
      })}
    </details>
    <p id={`${prefix}-status`} role="status">{message}</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}

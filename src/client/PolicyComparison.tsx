import { useEffect, useState } from "react";
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

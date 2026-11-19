import { useState, type FormEvent } from "react";
import {
  HELIOS_TRANSFORMERS, reduceHelios,
  type HeliosAnalysis, type HeliosReading, type HeliosSynthesis, type HeliosTransformer,
} from "../shared/helios-ensemble";
import "./helios-ensemble.css";

const NAME: Record<HeliosTransformer, string> = {
  muse: "Muse", grok: "Grok", gemini: "Gemini", claude: "Claude", openAI: "OpenAI",
};
const EXAMPLE_QUESTION = "Should a city expand affordable public transit while protecting accessibility, budgets, and neighborhood needs?";
function fixture(stance: HeliosAnalysis["stance"], summary: string, areas: HeliosAnalysis["focusAreas"], risk: string): HeliosAnalysis {
  return {
    stance, summary, focusAreas: areas,
    benefits: ["Could expand mobility and access to jobs and services"],
    risks: [risk],
    assumptions: ["Reliable operating funding and implementation capacity"],
    questions: ["What does measured pilot evidence show for different neighborhoods?"],
  };
}
// Invented examples, not outputs from these companies. They must never become civic votes.
const EXAMPLE_READINGS: HeliosReading[] = [
  { transformer: "muse", status: "completed", model: "fictional example", analysis: fixture("revise", "Pilot neighborhood routes and let riders shape accessible stops.", ["equity", "implementation"], "A design that overlooks people with disabilities") },
  { transformer: "grok", status: "completed", model: "fictional example", analysis: fixture("revise", "Publish operating costs, service targets and a clear exit condition.", ["cost", "evidence"], "Unfunded long-term maintenance") },
  { transformer: "gemini", status: "completed", model: "fictional example", analysis: fixture("support", "Better access can be valuable if evidence and geography guide service.", ["equity", "evidence"], "Uneven distribution of benefits") },
  { transformer: "claude", status: "completed", model: "fictional example", analysis: fixture("revise", "Require accessible consultation and preserve unresolved objections.", ["rights", "equity"], "Excluding people who cannot attend hearings") },
  { transformer: "openAI", status: "completed", model: "fictional example", analysis: fixture("uncertain", "Test alternatives and compare outcomes against a credible baseline.", ["evidence", "long_term"], "Overstating predicted benefits before measurement") },
];
const STANCE_LABEL = { support: "Support", revise: "Revise", oppose: "Oppose", uncertain: "Uncertain" };
const AREA_LABEL = { rights: "Rights", equity: "Equity", cost: "Cost", implementation: "Implementation", evidence: "Evidence", long_term: "Long term" };

export function HeliosEnsemble() {
  const [question, setQuestion] = useState(EXAMPLE_QUESTION);
  const [token, setToken] = useState("");
  const [consent, setConsent] = useState(false);
  const [report, setReport] = useState<HeliosSynthesis | null>(null);
  const [mode, setMode] = useState<"synthetic" | "live" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function showExample() {
    setQuestion(EXAMPLE_QUESTION);
    setReport(reduceHelios(EXAMPLE_READINGS));
    setMode("synthetic");
    setError("");
  }
  async function runModels(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent || !token.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/helios/ensemble", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json", authorization: "Bearer " + token.trim() },
        body: JSON.stringify({ question: question.trim(), consentToExternalProcessing: true }),
      });
      const payload = await response.json() as HeliosSynthesis & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Model evaluation could not be completed");
      setReport(payload);
      setMode("live");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Model evaluation could not be completed");
    } finally {
      setBusy(false);
    }
  }

  return <main className="helios-ensemble">
    <header className="helios-hero">
      <a className="helios-back" href="/">← Civic Synthesis</a>
      <div className="helios-kicker">HELIOS · ADVISORY INTELLIGENCE</div>
      <h1>Five perspectives.<br/><em>One inspectable synthesis.</em></h1>
      <p>Ask Muse, Grok, Gemini, Claude and OpenAI to analyze the same civic proposal. The reducer makes agreement, disagreement, assumptions and missing evidence visible. People retain decision-making authority.</p>
      <div className="helios-pipeline" aria-label="Five model reviewers feed a deterministic reducer">
        <div className="helios-rail">
          {HELIOS_TRANSFORMERS.map((name, index) => <div className="helios-node" key={name}><span className="helios-node-index">0{index + 1}</span><strong>{NAME[name]}</strong></div>)}
        </div>
        <div className="helios-connector" aria-hidden="true">↓</div>
        <div className="helios-reducer">REDUCER <span>→</span> HELIOS <small>→ HUMAN REVIEW</small></div>
      </div>
    </header>

    <section className="helios-workspace" aria-label="Try the Helios ensemble">
      <div className="helios-input-panel">
        <div className="helios-section-label">01 / INPUT</div>
        <h2>A policy question</h2>
        <form onSubmit={runModels}>
          <label htmlFor="helios-question">Public, non-sensitive question or proposal</label>
          <textarea id="helios-question" value={question} onChange={event => setQuestion(event.target.value)} minLength={10} maxLength={1800} rows={5} required />
          <div className="helios-form-note">A synthetic example makes no external calls. Live mode sends the text to each configured provider only after explicit approval. Do not enter private journals, personal details, or credentials.</div>
          <button type="button" className="helios-button helios-primary" onClick={showExample}>Explore synthetic example</button>
          <details className="helios-operator">
            <summary>Operator-only live model evaluation</summary>
            <label htmlFor="helios-token">HELIOS operator token (not a vendor API key)</label>
            <input id="helios-token" type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" />
            <label className="helios-checkbox"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> I am authorized to submit this non-sensitive text to the configured external model providers.</label>
            <button type="submit" className="helios-button helios-secondary" disabled={!consent || !token.trim() || busy || question.trim().length < 10}>{busy ? "Reviewing…" : "Run configured models"}</button>
            <p>Live analysis is disabled by default and must be activated by the server operator. Missing providers are reported, never simulated.</p>
          </details>
        </form>
        {error && <p className="helios-error" role="alert">{error}</p>}
      </div>

      <div className="helios-output-panel" aria-live="polite">
        <div className="helios-section-label">02 / HELIOS SYNTHESIS</div>
        {report ? <>
          <h2>{mode === "synthetic" ? "Invented example · not model output" : "Live provider responses"}</h2>
          <div className="helios-summary-grid">
            <div><span>Responses</span><strong>{report.completed} / {report.total}</strong></div>
            <div><span>Model alignment</span><strong>{report.agreement === "aligned" ? "Aligned" : report.agreement === "divergent" ? "Divergent" : "Insufficient"}</strong></div>
            <div><span>Majority model stance</span><strong>{report.majorityStance ? STANCE_LABEL[report.majorityStance] : "None"}</strong></div>
          </div>
          <h3>Model positions</h3>
          <div className="helios-stance-bars">
            {(["support", "revise", "oppose", "uncertain"] as const).map(stance => <div className="helios-stance-row" key={stance}>
              <span>{STANCE_LABEL[stance]}</span>
              <div className="helios-bar-track"><div style={{ width: report.completed ? (report.stanceCounts[stance] / report.completed * 100) + "%" : "0%" }} /></div>
              <b>{report.stanceCounts[stance]}</b>
            </div>)}
          </div>
          <h3>Areas highlighted by models</h3>
          {report.focusAreas.length > 0
            ? <div className="helios-tags">{report.focusAreas.map(item => <span key={item.area}>{AREA_LABEL[item.area]} · {item.transformers.length}/{report.completed}</span>)}</div>
            : <p>No shared areas were reported.</p>}
          <p className="helios-disclaimer">{report.disclaimer}</p>
        </> : <>
          <h2>See what the models agree on — and where they don't.</h2>
          <p className="helios-empty">Start with the no-API synthetic example, or open the operator controls for an explicitly authorized live run.</p>
        </>}
      </div>
    </section>

    {report && <section className="helios-readings">
      <div className="helios-section-label">03 / PROVENANCE AND DISSENT</div>
      <h2>Every model stays visible.</h2>
      <div className="helios-reading-grid">
        {report.readings.map(reading => <article className="helios-reading" key={reading.transformer}>
          <header><strong>{NAME[reading.transformer]}</strong><span>{reading.status === "completed" ? mode === "synthetic" ? "Synthetic fixture" : STANCE_LABEL[reading.analysis.stance] : reading.status === "failed" ? "Failed" : "Unconfigured"}</span></header>
          {reading.status === "completed" ? <>
            <p className="helios-model">{reading.model}</p>
            <p className="helios-reading-summary">{reading.analysis.summary}</p>
            <h3>Benefits</h3><ul>{reading.analysis.benefits.map((item, index) => <li key={index}>{item}</li>)}</ul>
            <h3>Risks</h3><ul>{reading.analysis.risks.map((item, index) => <li key={index}>{item}</li>)}</ul>
            <h3>Assumptions</h3><ul>{reading.analysis.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul>
            <h3>Open questions</h3><ul>{reading.analysis.questions.map((item, index) => <li key={index}>{item}</li>)}</ul>
          </> : <p>{reading.status === "failed" ? "The configured model did not return a valid review. It was excluded from the counts." : "No provider credentials or adapter are configured. This model was not called."}</p>}
        </article>)}
      </div>
    </section>}
    <footer className="helios-footer">HELIOS suggests; humans deliberate. No model output creates a vote, approves a bill, or changes a law. <a href="/documentation">How Civic Synthesis works</a></footer>
  </main>;
}

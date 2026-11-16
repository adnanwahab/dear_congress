import { CivicHeader } from './CivicHeader';

export const LAUNCH_LINK = '/?audience=launch';

// One public editorial mode; never infer an audience from referrers or identity.
export function isLaunchLanding(pathname: string, search: string): boolean {
  const audiences = new URLSearchParams(search).getAll('audience');
  return pathname === '/' && audiences.length === 1 && audiences[0] === 'launch';
}

export function LaunchLanding() {
  return <div className="civic-shell">
    <CivicHeader stage="Launch overview" />
    <main id="main-content" tabIndex={-1} className="civic-main">
      <section className="home-start" aria-labelledby="launch-title">
        <p>For journalists, civic organizers and curious newcomers</p>
        <h1 id="launch-title">Understand the beta before taking part</h1>
        <h2>The 30-second explanation</h2>
        <p>Civic Synthesis is an independently operated, non-binding beta. Explore a policy proposal, inspect its sources, express an advisory preference and see how a sample draft could move toward a public office. It has no governmental authority. Reading requires no account or vote.</p>
        <a className="dashboard-button" href="/documentation#provenance-explorer">Inspect source methodology</a>
      </section>
      <section className="panel" aria-labelledby="launch-limits">
        <h2 id="launch-limits">What the evidence can and cannot say</h2>
        <p>Sample proposals are fictional, response counts are illustrative and sponsor outcomes are simulated. They do not establish public support, enacted policy or real-world impact. Browser advisory choices do not verify identity or represent a public poll.</p>
        <p>Official background references provide context; they do not validate fictional clauses. Check each original source, date and revision. Model estimates depend on assumptions; missing, stale or conflicting evidence remains a limitation.</p>
        <p><a href="/documentation">Read the public guide and sources</a> · <a href="/account">Participation and privacy</a></p>
      </section>
      <section className="panel" aria-labelledby="launch-tour">
        <h2 id="launch-tour">A short product tour</h2>
        <p>Follow one fictional transit proposal at your own pace. Opening a stage does not cast a vote or send a message.</p>
        <ol>
          <li><a href="/published?proposal=demo-transit">Inspect source context</a> — distinguish official background from the sample.</li>
          <li><a href="/draft?proposal=demo-transit">Compare the sample draft</a> — read the illustrative change and its summary.</li>
          <li><a href="/outcomes?proposal=demo-transit">Examine outcome limits</a> — separate simulated follow-up from synthetic measurements.</li>
        </ol>
        <p><a href="/?demo=1">Play the optional guided sample tour</a> · <a href="/">Explore the regular homepage</a></p>
      </section>
      <section className="panel" aria-labelledby="launch-share">
        <h2 id="launch-share">One link to this overview</h2>
        <p><a href={LAUNCH_LINK}>Share this launch overview</a> — copy this link using your browser. It contains no personal details or referral tracking. Nothing is sent automatically.</p>
        <p>Everyone sees the same overview. No sensitive attributes determine this page.</p>
      </section>
      <section className="panel" aria-labelledby="launch-check">
        <h2 id="launch-check">Was this useful?</h2>
        <p>Before sharing, can you explain which material is fictional, what an advisory vote means and what evidence would establish a real outcome?</p>
        <details><summary>Check your understanding</summary><p>Sample proposals, counts and sponsor outcomes demonstrate the workflow. Advisory votes are non-binding. A real outcome needs implementation evidence and dated measurements with a baseline and named source. Sharing alone does not demonstrate meaningful participation.</p></details>
        <p>This self-check saves or sends no answers.</p>
      </section>
    </main>
  </div>;
}

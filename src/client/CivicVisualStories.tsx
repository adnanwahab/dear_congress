import { useEffect, useRef, useState } from 'react';
import './civic-visual-stories.css';

type DemoId = 'latency' | 'constitutions' | 'world' | 'helios' | 'clocks' | 'why';

const DEMOS: ReadonlyArray<{ id: DemoId; number: string; eyebrow: string; title: string; description: string; path: string }> = [
  { id: 'latency', number: '02', eyebrow: 'The speed of a signal', title: 'From latency to learning', description: 'An animated comparison of mail-era communication, modern networks, and what happens when evidence can arrive sooner.', path: 'Communication → Experimentation → Learning' },
  { id: 'constitutions', number: '03', eyebrow: '1,000 voices. One plan.', title: 'Ideas become reviewable drafts', description: 'Explore 1,000 hypothetical constitutions, trace a person’s idea through an attention network, and inspect the resulting draft.', path: 'People → Corpus → Transformer → Proposal' },
  { id: 'world', number: '04', eyebrow: 'The world has something to say.', title: 'A luminous consensus network', description: 'Rotate the planet, change its particle field, select a region, and follow the voluntary discussion-and-revision cycle.', path: 'Planetary signals · MAGI-inspired visualization' },
  { id: 'helios', number: '05', eyebrow: 'Intelligence that listens.', title: 'Human judgment stays in charge', description: 'Explore feedback, public explanations, 100 possible futures, human review, and protected dissent in an interactive civic control room.', path: 'Feedback · Explain · Simulate · Review · Dissent' },
  { id: 'clocks', number: '06', eyebrow: 'Find the waiting. Keep the safeguards.', title: 'The four clocks of government', description: 'Turn the four interlocking government clocks. Reduce time lost in queues while preserving the time needed for evidence and accountable review.', path: 'Listen · Propose · Decide · Learn' },
  { id: 'why', number: '07', eyebrow: 'Every decision should answer “why.”', title: 'An inspectable decision history', description: 'Trace a fictional housing pilot back to its evidence, objections, amendments, reviewers, and unresolved questions.', path: 'Need → Evidence → Text → Review → Decision → Outcome' },
];

export function CivicVisualStories() {
  const [horizon, setHorizon] = useState<1 | 4>(4);
  const [selectedId, setSelectedId] = useState<DemoId>('latency');
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);
  const chart = useRef<HTMLDivElement | null>(null);
  const selected = DEMOS.find(d => d.id === selectedId) ?? DEMOS[0]!;
  const days = horizon === 4 ? 1461 : 365;

  useEffect(() => {
    const element = chart.current;
    if (!element || !('IntersectionObserver' in window) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.18 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <section className="cvs-section" id="visual-stories" aria-labelledby="cvs-title">
    <div className="csh-container">
      <p className="cvs-kicker">INTERACTIVE CIVIC STORIES / SEVEN IDEAS</p>
      <div className="cvs-opening">
        <div>
          <h2 id="cvs-title" className="cvs-title">Everyone has something <em>worth contributing.</em></h2>
          <p className="cvs-intro">What if eight billion people could help write a better plan—and we could test, explain, and revise it together? Technology can accelerate communication. People still provide the judgment, rights, and accountability.</p>
        </div>
        <div className="cvs-principles"><strong>Great ideas come from everyone.</strong><p>Participation is voluntary. Disagreement is protected. AI proposes; people decide.</p></div>
      </div>

      <section className="cvs-frequency" aria-label="Illustrative comparison of review frequency">
        <div className="cvs-frequency-heading">
          <div>
            <p className="cvs-kicker">01 / THE OPPORTUNITY TO LEARN FASTER</p>
            <h3>One decision, or <em>1,461 chances</em> to reconsider?</h3>
            <p>A four-year planning interval allows one scheduled reconsideration. A daily check-in creates more opportunities to notice problems, collect evidence and revise a plan. More check-ins do not automatically produce more learning.</p>
          </div>
          <span className="cvs-example-tag">FREQUENCY COMPARISON · NOT MEASURED OUTCOMES</span>
        </div>
        <div className="cvs-chart-card" ref={chart}>
          <div className="cvs-chart-head"><strong>Potential planning / review checkpoints</strong><div className="cvs-horizon" role="group" aria-label="Comparison timeframe">
            <button type="button" aria-pressed={horizon === 4} onClick={() => setHorizon(4)}>Across 4 years</button>
            <button type="button" aria-pressed={horizon === 1} onClick={() => setHorizon(1)}>Across 1 year</button>
          </div></div>
          <div className={`cvs-bar-plot ${visible ? 'cvs-revealed' : ''}`} role="img" aria-label={`In a ${horizon}-year comparison, a four-year checkpoint has ${horizon === 4 ? 'one' : 'zero'} scheduled review milestones and a daily checkpoint has ${days.toLocaleString()} opportunities. These are not completed policy experiments.`}>
            <div className="cvs-guide-lines" aria-hidden="true"><span>{days.toLocaleString()}</span><span>{Math.round(days / 2).toLocaleString()}</span><span>0</span></div>
            <div className="cvs-bar-column"><strong>{horizon === 4 ? '1' : '0'}</strong><div className="cvs-bar cvs-small-bar" style={{ height: horizon === 4 ? '2px' : '0px' }} /><span>Every 4 years</span></div>
            <div className="cvs-bar-column"><strong>{days.toLocaleString()}</strong><div className="cvs-bar cvs-tall-bar" style={{ height: visible ? '88%' : '0%' }} /><span>Every day</span></div>
          </div>
          <div className="cvs-chart-summary">
            <strong>{horizon === 4 ? '1,461× review frequency' : '365 daily checkpoints'}</strong>
            <p>An illustrative comparison over {horizon === 4 ? 'four years' : 'one year'}. These are possible checkpoints—not {days.toLocaleString()} experiments, decisions, policy changes or successful learning cycles.</p>
          </div>
          <p className="cvs-chart-caveat">A daily feedback cadence can help identify what to study next. Meaningful learning also requires reliable observations, causal analysis, sufficient time for effects, accessible participation, and human decision-making. Four years here includes a leap day.</p>
        </div>
        <div className="cvs-learning-steps">
          <div><span>01 / INPUT</span><strong>Listen</strong><p>What do people actually need?</p></div>
          <div><span>02 / EXPERIMENT</span><strong>Test</strong><p>Try a bounded, authorized change.</p></div>
          <div><span>03 / EVIDENCE</span><strong>Measure</strong><p>What helped? What harmed?</p></div>
          <div><span>04 / REVIEW</span><strong>Revise</strong><p>Change the proposal with oversight.</p></div>
        </div>
      </section>

      <div className="cvs-gallery-intro">
        <div><p className="cvs-kicker">02–07 / VISUAL STORIES</p><h3>Follow an idea from voice to accountable action.</h3></div>
        <p>Choose any demo below. Each is the original interactive HTML prototype, opened in an isolated frame so it cannot submit votes, access the civic session, or approve a policy.</p>
      </div>
      <div className="cvs-gallery-nav" role="group" aria-label="Choose an interactive civic visualization">
        {DEMOS.map(d => <button key={d.id} type="button" aria-pressed={selectedId === d.id} onClick={() => { setSelectedId(d.id); setExpanded(false); }}>
          <span>{d.number} / 07</span><strong>{d.title}</strong>
        </button>)}
      </div>
      <article className="cvs-demo" aria-labelledby="cvs-demo-title">
        <div className="cvs-demo-info">
          <div><span className="cvs-kicker">{selected.number} / 07 · {selected.eyebrow}</span><h4 id="cvs-demo-title">{selected.title}</h4><p>{selected.description}</p><small>{selected.path}</small></div>
          <button className="cvs-expand" type="button" aria-pressed={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? 'Restore compact view ↕' : 'Expand interactive diagram ↕'}</button>
        </div>
        <div className={`cvs-frame-shell ${expanded ? 'cvs-expanded' : ''}`}>
          <iframe key={selected.id} src={`/visual-lab/${selected.id}`} title={`${selected.title} — interactive fictional demonstration`} loading="lazy" sandbox="allow-scripts" referrerPolicy="no-referrer" />
        </div>
        <div className="cvs-demo-foot"><span>Original supplied visualization · Synthetic scenarios · Human review required</span><a href={`/visual-lab/${selected.id}`} target="_blank" rel="noopener noreferrer">Open full demo ↗</a></div>
      </article>
      <div className="cvs-ending">
        <div><p className="cvs-kicker">THE FUTURE IS A PUBLIC PROJECT</p><h3>Ideas should travel freely.<br />Power should stay accountable.</h3><p>Explore the policy drafts, offer an objection or amendment, and help test better possibilities. These visualizations are simulations and design concepts—not real consensus counts, lawmaking authority, or verified policy impacts.</p></div>
        <a href="/votes">Explore civic proposals ↗</a>
      </div>
    </div>
  </section>;
}

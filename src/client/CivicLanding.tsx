import { RealityLens } from './RealityLens';
import { useMemo, useState } from 'react';
import { billCollection, searchBills } from '../shared/bill-catalog';
import './civic-landing.css';
import { CivicVisualStories } from './CivicVisualStories';

const CATEGORY_LABELS: Record<string, string> = {
  'Economic security and freedom from desperation': 'Economic freedom',
  'Housing and livable cities': 'Homes & cities',
  'Physical and mental health': 'Health & care',
  'Education and human development': 'Learning',
  'Meaningful work, autonomy, and time': 'Work & time',
  'Friendship, community, and belonging': 'Community & arts',
  'Justice, dignity, and second chances': 'Justice & dignity',
  'Democracy, wisdom, and government': 'Better democracy',
  'Technology, AI, and digital freedom': 'Technology & AI',
  'Nature, safety, and future generations': 'Nature & the future',
};

const CREATIVE_IDS = new Set(['HFL-038', 'HFL-039', 'HFL-040', 'HFL-051', 'HFL-052', 'HFL-055', 'HFL-059', 'HFL-087', 'HFL-090']);
const ideaCount = billCollection.bills.length;
const categories = billCollection.categories;

export default function CivicLanding() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const matches = useMemo(() => {
    const base = searchBills(query, category === 'all' || category === 'creative' ? '' : category);
    return category === 'creative' ? base.filter(b => CREATIVE_IDS.has(b.id)) : base;
  }, [query, category]);
  const visible = expanded ? matches : matches.slice(0, 9);
  const [arts, setArts] = useState(22);
  const [research, setResearch] = useState(33);
  const remaining = 100 - arts - research;
  const health = Math.round(remaining * .6);
  const learning = remaining - health;
  const allocation = [
    { id: 'arts', label: 'Public arts & culture', value: arts, color: '#f88c76' },
    { id: 'research', label: 'Open science & R&D', value: research, color: '#8777d1' },
    { id: 'health', label: 'Health & care', value: health, color: '#47a696' },
    { id: 'learning', label: 'Learning & libraries', value: learning, color: '#e7b953' },
  ];

  function selectCategory(next: string) {
    setCategory(next);
    setExpanded(false);
  }
  return <div className="csh-home">
    <header className="csh-nav">
      <div className="csh-container csh-nav-inner">
        <a className="csh-brand" href="/" aria-label="Civic Synthesis homepage"><span className="csh-brand-icon" aria-hidden="true">✳</span><span>civic synthesis<span className="csh-brand-dot">.</span></span></a>
        <nav className="csh-links" aria-label="Homepage navigation">
          <a href="#visual-stories">Visual stories</a>
          <a href="/votes">Explore {ideaCount} Bills</a>
          <a className="csh-button csh-small csh-dark" href="/votes">Join the conversation <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
      <RealityLens />
    </header>
    <main id="main-content" tabIndex={-1}>
      <section className="csh-hero">
        <div className="csh-container csh-hero-grid">
          <div>
            <p className="csh-eyebrow">THE FUTURE IS A PUBLIC PROJECT</p>
            <h1>Imagine wildly.<br/><em>Govern wisely.</em></h1>
            <p className="csh-lead">What if we could listen, improve a proposal, and understand its consequences much faster—without rushing human judgment? Explore <strong>{ideaCount} bold policy drafts</strong> and help shape better ideas together.</p>
            <div className="csh-hero-buttons">
              <a className="csh-button csh-dark" href="#ideas">Explore the {ideaCount} ideas <span aria-hidden="true">↘</span></a>
              <a className="csh-button csh-light" href="/proposals/new">Propose your own <span aria-hidden="true">↗</span></a>
            </div>
            <p className="csh-hero-note"><span className="csh-green-dot" aria-hidden="true"/>Open for imagination. Grounded in evidence, review, and real people.</p>
            <div className="csh-contributor-invite">
              <span className="csh-contributor-kicker">YOUR IDEA → REAL-WORLD POSSIBILITY</span>
              <h2>Your idea today. <em>A prototype tomorrow.</em></h2>
              <p>A thoughtful contribution could inspire something useful as soon as the next day—a prototype, a local experiment, or a better proposal. Great contributors could receive public credit, opportunities to collaborate, and, if a future program is established, other incentives.</p>
              <p className="csh-contributor-caveat">Possibilities, not promises: rewards and turnaround times are not guaranteed. Changing laws requires evidence, public participation, human review, and legal approval.</p>
              <a href="/proposals/new">Share an idea ↗</a>
            </div>
          </div>
          <div className="csh-hero-art" role="img" aria-label="An illustrated orbit of arts, science, nature and community around an editable future">
            <span className="csh-scene-title">THE FUTURE MACHINE · IDEA SPACE</span>
            <span className="csh-orbit csh-o1" aria-hidden="true"/><span className="csh-orbit csh-o2" aria-hidden="true"/><span className="csh-orbit csh-o3" aria-hidden="true"/>
            <span className="csh-core"><span><small>A WORK IN PROGRESS</small>THE<br/>FUTURE<br/>IS<br/>EDITABLE ✳</span></span>
            <span className="csh-planet csh-p1">🎨 MORE ART</span>
            <span className="csh-planet csh-p2">🧪 BOLDER SCIENCE</span>
            <span className="csh-planet csh-p3">🌱 THRIVING CITIES</span>
            <span className="csh-planet csh-p4">🤝 BETTER TOGETHER</span>
          </div>
        </div>
      </section>
      <section className="csh-section csh-imagine" id="vision" aria-labelledby="csh-vision-title">
        <div className="csh-container">
          <p className="csh-section-kicker">01 / THREE IDEAS FOR A FASTER, WISER DEMOCRACY</p>
          <div className="csh-section-head"><h2 id="csh-vision-title">From horse-speed mail<br/>to <em>continuous dialogue.</em></h2><p>We can shorten the time between a question and a better draft. The goal is faster learning and broader participation, never less evidence, fewer rights, or rushed lawmaking.</p></div>
          <div className="csh-features csh-principles">
            <article className="csh-feature csh-pink">
              <div className="csh-feature-top"><span className="csh-feature-id">01 / LEGAL LATENCY</span><span className="csh-feature-emoji" aria-hidden="true">⌛</span></div>
              <h3>What if feedback traveled at network speed?</h3>
              <p>In 1776, correspondence moved by post road and rider. A documented benchmark from 1799: a Savannah–Portland letter and reply typically took about 40 days. Modern network transit can take fractions of a second—even between Georgia and Shenzhen.</p>
              <div className="csh-latency-compare" aria-label="Communication round-trip comparison, historical and illustrative">
                <div><span>1799 · SAVANNAH ↔ PORTLAND</span><strong>~40 days</strong><small>Letter + reply · historical estimate</small></div>
                <div><span>TODAY · GEORGIA ↔ SHENZHEN</span><strong>~0.2–0.5 sec</strong><small>Illustrative network RTT · not live-measured</small></div>
              </div>
              <a href="https://press.uchicago.edu/ucp/books/book/chicago/P/bo4134270.html">Historical source: The Postal Age ↗</a><span className="csh-feature-bg" aria-hidden="true">↝</span>
            </article>
            <article className="csh-feature csh-lav">
              <div className="csh-feature-top"><span className="csh-feature-id">02 / VOLUNTARY CONSENSUS</span><span className="csh-feature-emoji" aria-hidden="true">◎</span></div>
              <h3>Can a plan get to 100% support?</h3>
              <p>Our hypothesis: with enough listening, evidence, and careful redesign, a proposal might become good enough that everyone <em>wants</em> to support it. Treat objections as insight, not obstacles to erase.</p>
              <div className="csh-civic-loop" aria-label="Propose, hear objections, revise, and ask again"><span>Propose</span><span>Listen</span><span>Revise</span><span>Recheck</span></div>
              <p className="csh-principle-note"><strong>A north star, not a claim:</strong> 100% voluntary support is not guaranteed. Show the denominator, participation, unresolved objections, and each revision. No coerced agreement, and silence never counts as a yes.</p>
              <a href="/votes">Explore advisory participation ↗</a><span className="csh-feature-bg" aria-hidden="true">✳</span>
            </article>
            <article className="csh-feature csh-yellow">
              <div className="csh-feature-top"><span className="csh-feature-id">03 / HELIOS-INSPIRED PHILOSOPHY</span><span className="csh-feature-emoji" aria-hidden="true">✺</span></div>
              <h3>AI helps us think. People stay in charge.</h3>
              <p>HELIOS in <em>Deus Ex</em> imagines computing that synthesizes society's input. Keep the exciting idea of continuous feedback; reject the fantasy of an unaccountable machine ruler.</p>
              <div className="csh-civic-loop" aria-label="Listen, explain trade-offs, simulate outcomes, preserve human authority"><span>Listen</span><span>Explain</span><span>Simulate</span><span>Human review</span></div>
              <p className="csh-principle-note">The principles: participatory democracy, transparent reasoning, epistemic humility, protected dissent, and contestable AI advice. Advisory input does not itself enact laws.</p>
              <a href="/bills/HFL-090">Explore public futures simulation ↗</a><span className="csh-feature-bg" aria-hidden="true">◎</span>
            </article>
          </div>
          <p className="csh-foundation-footnote">Sources and limits: <a href="https://press.uchicago.edu/ucp/books/book/chicago/P/bo4134270.html">David M. Henkin, <em>The Postal Age</em></a> documents the 1799 mail example; it is not a measured 1776 delivery time. The modern round-trip range is an illustration, not an instrumented Georgia–Shenzhen benchmark; real routing varies. Compare <a href="https://hatsnet.io/docs/network/latency/regions/north-america-to-asia-pacific">intercontinental network measurements</a>. HELIOS is <a href="https://en.wikiquote.org/wiki/Deus_Ex">fictional inspiration from <em>Deus Ex</em></a>, not the site's governing authority. Network latency is not legislative decision time.</p>
          <div className="csh-idea-banner"><div><strong>Speed up learning. Keep democracy accountable.</strong><p>People need time to understand, disagree, and change their minds. Expert review, publication checks, rights, and legal processes remain essential.</p></div><a href="/proposals/new">Propose an improvement ↗</a></div>
        </div>
      </section>
      <CivicVisualStories />
      <section className="csh-section" id="how">
        <div className="csh-container">
          <p className="csh-section-kicker">02 / HOW WE BUILD TOGETHER</p>
          <div className="csh-section-head"><h2>From “what if?”<br/>to “what next?”</h2><p>A place to imagine ambitiously, ask hard questions, and keep a clear record of what's a proposal versus what's actually happened.</p></div>
          <div className="csh-steps">
            <article><span>STEP 01 · IMAGINE</span><h3>Start with an idea.</h3><p>Describe the world you want and the problem you think needs fixing.</p></article>
            <article><span>STEP 02 · UNDERSTAND</span><h3>Make it concrete.</h3><p>Read a proposal, weigh trade-offs, and surface safeguards and unanswered questions.</p></article>
            <article><span>STEP 03 · EXPLORE</span><h3>Compare futures.</h3><p>Use scenarios and evidence to investigate possible outcomes, not pretend to predict them.</p></article>
            <article><span>STEP 04 · PARTICIPATE</span><h3>Shape the next draft.</h3><p>Contribute to public discussion and advisory participation where a proposal is eligible.</p></article>
          </div>
        </div>
      </section>
      
      <section className="csh-section csh-studio" id="studio" aria-labelledby="csh-studio-title">
        <div className="csh-container">
          <p className="csh-section-kicker">03 / INTERACTIVE CIVIC LAB</p>
          <div className="csh-section-head"><h2 id="csh-studio-title">What if we funded<br/><em>possibility?</em></h2><p>A tiny explorable notebook about choices. Move the sliders and watch the priorities change. The right questions come before the right numbers.</p></div>
          <div className="csh-lab-frame">
            <div className="csh-lab-panel">
              <div className="csh-lab-top"><span>EXPERIMENT / 001</span><span className="csh-lab-status">SANDBOX · LOCAL ONLY</span></div>
              <div className="csh-lab-caption"><i aria-hidden="true"/> YOUR HYPOTHETICAL PRIORITIES</div>
              <h3>Where should attention go?</h3>
              <p className="csh-lab-desc">Divide 100 imaginary priority points among four goals. Change arts and research; the remaining points adjust automatically across health and learning.</p>
              <div className="csh-lab-slider">
                <div><label htmlFor="csh-art-points">🎨 Public arts &amp; culture</label><output htmlFor="csh-art-points">{arts} points</output></div>
                <input id="csh-art-points" type="range" min={0} max={100 - research} step={1} value={arts} onChange={e => setArts(Number(e.target.value))} aria-describedby="csh-studio-note" />
                <small>Public art, music, performances, access to creative spaces.</small>
              </div>
              <div className="csh-lab-slider">
                <div><label htmlFor="csh-research-points">🔬 Open science &amp; R&amp;D</label><output htmlFor="csh-research-points">{research} points</output></div>
                <input id="csh-research-points" type="range" min={0} max={100 - arts} step={1} value={research} onChange={e => setResearch(Number(e.target.value))} aria-describedby="csh-studio-note" />
                <small>New proposal concept: research funding and exploration, not a catalog bill.</small>
              </div>
              <div className="csh-lab-readonly"><div>🏥 Health &amp; care<strong>{health} points</strong></div><div>📚 Learning &amp; libraries<strong>{learning} points</strong></div></div>
              <a className="csh-lab-link" href="/bills/HFL-059">Read the real arts draft ↗</a>
            </div>
            <div className="csh-lab-panel">
              <div className="csh-lab-top"><span>EXPLORABLE DISTRIBUTION</span><span>NO FORECAST</span></div>
              <div className="csh-lab-total"><div><span>HYPOTHETICAL TOTAL</span><strong>100 <small>priority points</small></strong></div><span>↻ INSTANT<br/>VISUAL UPDATE</span></div>
              <div className="csh-lab-stacked" role="img" aria-label={'Allocation: arts ' + arts + ', research ' + research + ', health ' + health + ', learning ' + learning + ' out of 100'}>{allocation.map(item => <span key={item.id} style={{ width: item.value + '%', background: item.color }}/>)}</div>
              <div className="csh-lab-bars">{allocation.map(item => <div key={item.id}>
                <div className="csh-lab-bar-label"><span>{item.label}</span><strong>{item.value} / 100</strong></div>
                <div className="csh-lab-track"><div style={{ width: item.value + '%', background: item.color }}/></div>
              </div>)}</div>
              <p className="csh-lab-note" id="csh-studio-note"><b>IMPORTANT</b> <span>This illustrates trade-offs—not dollars, a legislative budget, costs, impact estimates, or endorsements. No data is submitted or saved.</span></p>
            </div>
          </div>
          <div className="csh-lab-ledger" aria-label="How proposals should be evaluated">
            <article><small>01 / STATUS</small><h3>Know what’s a draft.</h3><p>All 110 current HFL concepts are editorial drafts, not introduced or enacted laws.</p></article>
            <article><small>02 / EVIDENCE</small><h3>Keep unknowns visible.</h3><p>Fiscal cost and independent evidence review are outstanding, not zero.</p></article>
            <article><small>03 / PEOPLE</small><h3>Humans make the call.</h3><p>Review safeguards and jurisdiction before any eligible advisory vote. <a href="/bills/HFL-090">Inspect a draft ↗</a></p></article>
          </div>
        </div>
      </section>
      <section className="csh-section csh-catalog" id="ideas">
        <div className="csh-container">
          <p className="csh-section-kicker">04 / THE IDEA LIBRARY</p>
          <div className="csh-section-head"><h2>110 bills.<br/>110 starting points.</h2><p>Explore the expanded draft collection, from affordable housing and community art to safer technology and public futures research.</p></div>
          <p className="csh-catalog-notice"><strong>DISCUSSION DRAFTS</strong> These are unreviewed editorial concepts, not enacted laws, legislative filings, costed plans, or live ballots.</p>
          <div className="csh-catalog-controls"><label className="csh-search"><span aria-hidden="true">⌕</span><span className="csh-sr-only">Search the 110 policy drafts</span><input type="search" value={query} placeholder="Search an idea, problem, or possibility…" onChange={e => { setQuery(e.target.value); setExpanded(false); }}/></label><span role="status" aria-live="polite">{'Showing ' + visible.length + ' of ' + matches.length + ' ideas'}</span></div>
          <div className="csh-chips" role="group" aria-label="Filter ideas by theme">
            <button type="button" aria-pressed={category === 'all'} onClick={() => selectCategory('all')}>✳ All ideas</button>
            <button type="button" className="csh-creative-chip" aria-pressed={category === 'creative'} onClick={() => selectCategory('creative')}>🎨 Arts &amp; science</button>
            {categories.map(name => <button type="button" key={name} aria-pressed={category === name} onClick={() => selectCategory(name)}>{CATEGORY_LABELS[name] || name}</button>)}
          </div>
          {matches.length ? <div className="csh-bills">{visible.map(b => <article className="csh-bill" key={b.id}>
            <div className="csh-bill-header"><span>{b.id}</span><span>DRAFT CONCEPT</span></div>
            <h3>{b.title}</h3><p>{b.proposedChange}</p>
            <a className="csh-webgpu-ad" href="#studio" aria-label="WebGPU futures lab coming soon; explore the current illustrative sandbox">
              <span className="csh-webgpu-mark" aria-hidden="true">✳</span>
              <span className="csh-webgpu-copy"><strong>WEBGPU FUTURES LAB</strong><small>Coming soon · explore possible futures</small></span>
              <span className="csh-webgpu-arrow" aria-hidden="true">↗</span>
            </a>
            <div className="csh-bill-bottom"><span>{CATEGORY_LABELS[b.category] || b.category}</span><a href={'/bills/' + encodeURIComponent(b.id)} aria-label={'Read ' + b.id + ': ' + b.title}>Explore draft ↗</a></div>
          </article>)}</div> : <div className="csh-no-results">No drafts match these filters. Try another search or select All ideas.</div>}
          {matches.length > 9 && <div className="csh-more-row"><button type="button" className="csh-button csh-light" onClick={() => { setExpanded(!expanded); if (expanded) document.getElementById('ideas')?.scrollIntoView({ behavior: 'smooth' }); }}>{expanded ? 'Show fewer ideas ↑' : 'Show all ' + matches.length + ' matching ideas ↓'}</button></div>}
          <p className="csh-provenance">110 Bills for Human Flourishing, expanded November 18, 2026. IDs HFL-001–HFL-100 are preserved; seven texts were revised and HFL-101–HFL-110 were added. All drafts still require review.</p>
        </div>
      </section>
      <section className="csh-end"><div className="csh-container csh-end-inner"><div><p className="csh-section-kicker">05 / WRITE THE NEXT CHAPTER</p><h2>The future isn’t fixed.<br/><em>It’s a conversation.</em></h2><p>What would you change first? Start with the experience you know, propose a concrete idea, or explore how different choices could change everyday life.</p></div><a className="csh-button" href="/proposals/new">Start a proposal ↗</a></div></section>
    </main>
    <footer className="csh-footer"><div className="csh-container"><p className="csh-credit">Built for curiosity, evidence, and a more creative civic life. ✳</p></div></footer>
  </div>;
}

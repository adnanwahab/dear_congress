import { useMemo, useState } from 'react';
import { billCollection, searchBills } from '../shared/bill-catalog';
import './civic-landing.css';

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
          <a href="/votes">Explore {ideaCount} Bills</a>
          <a className="csh-button csh-small csh-dark" href="/votes">Join the conversation <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
    </header>
    <main id="main-content" tabIndex={-1}>
      <section className="csh-hero">
        <div className="csh-container csh-hero-grid">
          <div>
            <p className="csh-eyebrow">THE FUTURE IS A PUBLIC PROJECT</p>
            <h1>Imagine wildly.<br/><em>Govern wisely.</em></h1>
            <p className="csh-lead">What if democracy felt like building the future together? Discover <strong>{ideaCount} bold policy ideas</strong> for healthier communities, more creativity, better science, and lives worth living.</p>
            <div className="csh-hero-buttons">
              <a className="csh-button csh-dark" href="#ideas">Explore the {ideaCount} ideas <span aria-hidden="true">↘</span></a>
              <a className="csh-button csh-light" href="/proposals/new">Propose your own <span aria-hidden="true">↗</span></a>
            </div>
            <p className="csh-hero-note"><span className="csh-green-dot" aria-hidden="true"/>Open for imagination. Grounded in evidence, review, and real people.</p>
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
      <div className="csh-tape"><div className="csh-container">
        <div><strong>{ideaCount}</strong><span>original ideas worth discussing</span></div>
        <div><strong>{categories.length}</strong><span>areas of human flourishing</span></div>
        <div><strong>∞</strong><span>possible futures to explore</span></div>
      </div></div>
      <section className="csh-section csh-imagine" id="vision">
        <div className="csh-container">
          <p className="csh-section-kicker">01 / A CIVIC RENAISSANCE</p>
          <div className="csh-section-head"><h2>More wonder.<br/><em>More possibility.</em></h2><p>Good policy should make room for more than survival. It should help people create, discover, connect, and delight in being alive.</p></div>
          <div className="csh-features">
            <article className="csh-feature csh-pink">
              <div className="csh-feature-top"><span className="csh-feature-id">HFL-059 · IN THE 110</span><span className="csh-feature-emoji" aria-hidden="true">🎭</span></div>
              <h3>Let a thousand art scenes bloom.</h3><p>Bring public art, music, performances, and creative programs to more neighborhoods, with community-led choices and transparent grants.</p>
              <a href="/bills/HFL-059">Explore the Public Arts and Music Act ↗</a><span className="csh-feature-bg" aria-hidden="true">✺</span>
            </article>
            <article className="csh-feature csh-lav">
              <div className="csh-feature-top"><span className="csh-feature-id">HFL-106 · IN THE 110</span><span className="csh-feature-emoji" aria-hidden="true">🔬</span></div>
              <h3>A public R&amp;D moonshot.</h3><p>Imagine larger, accountable funding for high-risk research, open science, public laboratories, and unexpected breakthroughs.</p>
              <a href="/bills/HFL-106">Explore the Open Science and Public Discovery Act ↗</a><span className="csh-feature-bg" aria-hidden="true">✳</span>
            </article>
            <article className="csh-feature csh-yellow">
              <div className="csh-feature-top"><span className="csh-feature-id">HFL-090 · IN THE 110</span><span className="csh-feature-emoji" aria-hidden="true">🪐</span></div>
              <h3>Try the future before it arrives.</h3><p>Explore public policy simulations that show uncertainty, alternatives, assumptions, and who benefits or gets left out.</p>
              <a href="/bills/HFL-090">Explore the Public Futures Simulation Act ↗</a><span className="csh-feature-bg" aria-hidden="true">◎</span>
            </article>
          </div>
          <div className="csh-idea-banner"><div><strong>Imagine creative cities, citizen science, libraries that double as laboratories.</strong><p>Arts and R&amp;D expansions are new discussion directions, not enacted policies or verified budgets. The new open-science concept is now HFL-106 in the 110-draft catalog.</p></div><a href="/proposals/new">Add your idea ↗</a></div>
        </div>
      </section>
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

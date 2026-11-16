import { NegotiationTabletop } from './NegotiationTabletop';
import { previewTabletop, tabletopDefaults } from '../shared/negotiation-tabletop';
import './classroom.css';

const alternatives = [
  { name: 'A · Smaller grants, broader eligibility', budget: 6000, grant: 1000, ceiling: 50000 },
  { name: 'B · Larger grants, narrower eligibility', budget: 6000, grant: 2000, ceiling: 30000 },
];

/** Standalone teaching surface: no API, identity, ballot or persistence dependencies. */
export default function Classroom() {
  return <div className="classroom"><a href="#main-content">Skip to lesson</a><header><a href="/bills">Civic Synthesis · draft catalog</a><p>Independently operated, non-binding beta</p></header>
    <main id="main-content" tabIndex={-1}>
      <h1>Classroom lesson: compare a fictional grant program</h1>
      <p className="classroom-notice"><strong>Fictional demo.</strong> These invented households and policy options are teaching examples, not government proposals, official advice or measured results. No account, vote or saved ballot is required.</p>
      <p>All exercises are optional. Read, compare and discuss without declaring a political stance. Nothing entered here is sent or saved; reloading resets the simulation.</p>
      <p>Share this lesson URL: <a href="/classroom">/classroom</a>. Copy the address from your browser. The link opens the same starting lesson; it does not include your slider changes.</p>
      <nav aria-label="Lesson sections"><a href="#compare">1 · Compare</a>{' · '}<a href="#evidence">2 · Evidence</a>{' · '}<a href="#simulation">3 · Simulation</a>{' · '}<a href="#discussion">4 · Discuss</a></nav>
      <section id="compare"><h2>1 · Compare two alternatives</h2><p>Both spend $4,000 in this invented example, but distribute it differently. Neither is ranked as the correct answer.</p>
        <div className="classroom-options">{alternatives.map(option => { const result = previewTabletop(option); return <article key={option.name}><h3>{option.name}</h3><dl>
          <dt>Annual budget</dt><dd>${option.budget.toLocaleString('en-US')}</dd><dt>Annual grant per qualifying household</dt><dd>${option.grant.toLocaleString('en-US')}</dd><dt>Income eligibility ceiling</dt><dd>${option.ceiling.toLocaleString('en-US')}</dd><dt>Qualifying / excluded households</dt><dd>{result.eligible} / {result.excluded}</dd><dt>Annual cost</dt><dd>${result.cost.toLocaleString('en-US')}</dd>
        </dl><p>Qualifying households may gain a grant; excluded households receive none. Who funds it and actual welfare effects are unknown.</p></article>; })}</div>
      </section>
      <section id="evidence"><h2>2 · Inspect evidence and assumptions</h2><p>Source identity: adnanwahab/dear_congress · fictional-six-households.v1 · src/shared/negotiation-tabletop.ts. This is repository fixture provenance, not empirical policy evidence.</p>
        <p>Six invented annual household incomes: $15,000, $25,000, $35,000, $45,000, $55,000 and $65,000. Income at or below the ceiling qualifies. Annual cost = qualifying households × annual grant. Units are USD per year. Over-budget scenarios do not automatically select or deny households.</p>
        <p>Missing evidence: real household data, take-up, administrative costs, funding sources, legal review and distributional impacts. No housing, health or other welfare outcome is predicted. Ask which independently sourced evidence could test these assumptions.</p>
      </section>
      <section id="simulation"><h2>3 · Change assumptions in a simulation</h2><p>The simulator starts with a separate baseline: ${tabletopDefaults.budget.toLocaleString('en-US')} budget, ${tabletopDefaults.grant.toLocaleString('en-US')} grant and ${tabletopDefaults.ceiling.toLocaleString('en-US')} ceiling. Try A and B above, then change one assumption at a time. Use the sliders with touch or arrow keys. Reset returns to this baseline.</p><NegotiationTabletop /></section>
      <section id="discussion"><h2>4 · Discussion questions</h2><ol>
        <li>Why can equal total costs produce different benefits and exclusions?</li><li>Whose needs are missing from six fictional households? Who might bear the funding cost?</li><li>Which statements are arithmetic, assumptions or claims requiring real evidence?</li><li>What evidence could challenge your preferred option? It is fine to remain unsure.</li><li>Change one slider. Explain what changed and what the simulation still cannot tell you.</li>
      </ol><p>Optional comprehension check: explain the difference between a simulated cost and a measured outcome to a partner. Educators can ask whether the exercise helped and what remained unclear, without collecting names or political preferences. No completion or participation is tracked here.</p></section>
    </main>
  </div>;
}

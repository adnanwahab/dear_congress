/** Public editorial examples, identical for every visitor; never inferred from records. */
export const TOPIC_ORIENTATIONS: Record<string, {
  title: string; description: string; question: string; scenarios: readonly [string, string]; caveat: string;
}> = {
  housing: {
    title: 'Housing affordability: costs, stability and trade-offs',
    description: 'Explore housing costs and stability through two fictional scenarios, source limits and competing policy alternatives in a non-binding civic beta.',
    question: 'How could housing become more affordable while keeping people securely housed?',
    scenarios: ['A renter faces a lease increase and weighs moving costs against a longer commute.', 'A household wants a smaller home nearby, but available homes exceed its budget.'],
    caveat: 'These examples are not rent statistics, legal advice or evidence that a housing policy works.',
  },
  childcare: {
    title: 'Childcare affordability: cost, availability and care',
    description: 'Explore childcare cost and availability through two fictional scenarios, source limits and competing policy alternatives in a non-binding civic beta.',
    question: 'How could families find affordable childcare that fits their working hours?',
    scenarios: ['A parent can afford some care but cannot find a place covering an evening shift.', 'A small childcare provider weighs staff pay and operating costs against the fees families can afford.'],
    caveat: 'These examples are not provider listings, eligibility guidance or measured childcare outcomes.',
  },
  transit: {
    title: 'Reliable transit: waiting, access and service trade-offs',
    description: 'Explore transit reliability and access through two fictional scenarios, source limits and competing policy alternatives in a non-binding civic beta.',
    question: 'How could transit make everyday trips more reliable and accessible?',
    scenarios: ['A worker misses a connection when the first bus arrives late and risks missing a shift.', 'A rider using a mobility aid needs an accessible stop and dependable evening service.'],
    caveat: 'These examples are not current timetables, accessibility audits or measured service results.',
  },
  climate: {
    title: 'Climate resilience: flooding, heat and local trade-offs',
    description: 'Explore climate resilience through two fictional scenarios about flooding and heat, source limits and policy alternatives in a non-binding civic beta.',
    question: 'How could communities prepare for flooding and extreme heat fairly?',
    scenarios: ['A household faces repeated street flooding and weighs drainage improvements against disruption and cost.', 'An outdoor worker needs shade and cooling access during extreme heat, while the community weighs maintenance costs.'],
    caveat: 'These examples are not local forecasts, emergency guidance or evidence of reduced climate risk.',
  },
};

export function TopicOrientation({ id }: { id: string }) {
  const page = TOPIC_ORIENTATIONS[id];
  if (!page) return null;
  return <section className="panel topic-orientation" aria-label="Topic orientation">
    <h2>{page.question}</h2>
    <p>Independently operated, non-binding beta. This site has no governmental authority.</p>
    <h3>Two representative scenarios · fictional</h3>
    <ul>{page.scenarios.map(s => <li key={s}>{s}</li>)}</ul>
    <p><strong>Source caveat:</strong> {page.caveat} Repository samples and catalog alternatives are illustrative. Background references do not establish current local conditions or official endorsement; check their scope, dates and missing evidence below.</p>
    <a href={`/needs?topic=${id}`}>Next: compare {id} needs and policy alternatives</a>
  </section>;
}

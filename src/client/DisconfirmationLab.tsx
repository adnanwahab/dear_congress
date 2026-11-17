import { useId, useState } from 'react';
import { structuredAmendment, type CivicLawContext } from './civic-law-context';

export const TEST_SOURCES = ['Paired synthetic checkpoints', 'Public aggregate dataset', 'Consented pilot measurements'] as const;
export type TestSource = typeof TEST_SOURCES[number];
export type TestPlan = { hypothesis: string; falsifier: string; source: TestSource; sourceDetails: string; threshold: string };
export const TEST_UNCERTAINTY = 'Synthetic mechanisms and sampling do not establish real-world causality; measurement bias and confounding require review.';
export function proposedTestReceipt(context: CivicLawContext, plan: TestPlan) {
  if (!TEST_SOURCES.includes(plan.source) || [plan.hypothesis, plan.falsifier, plan.sourceDetails].some(v => !v.trim() || v.length > 1000)
    || !plan.threshold.trim() || !Number.isFinite(Number(plan.threshold)) || Math.abs(Number(plan.threshold)) > 1e9) {
    throw Error('Provide a hypothesis, measurable falsifier, data source details and finite failure threshold (within ±1 billion).');
  }
  return { schemaVersion: 'civic-proposed-test.v1', status: 'proposed test—awaiting review',
    sourceDataMode: 'synthetic model context; proposed evidence not collected',
    scenario: structuredAmendment(context), majorUncertainty: TEST_UNCERTAINTY,
    test: { hypothesis: plan.hypothesis.trim(), falsifier: plan.falsifier.trim(), source: plan.source,
      sourceDetails: plan.sourceDetails.trim(), failureThreshold: Number(plan.threshold) } };
}

/** Private page-memory planning only: no execution, publication, or review authority. */
export function DisconfirmationLab({ context }: { context: CivicLawContext }) {
  const id = useId();
  const [plan, setPlan] = useState<TestPlan>({ hypothesis: '', falsifier: '', source: TEST_SOURCES[0], sourceDetails: '', threshold: '' });
  const [receipt, setReceipt] = useState<ReturnType<typeof proposedTestReceipt> | null>(null);
  const [error, setError] = useState('');
  const scenario = structuredAmendment(context);
  function change(key: keyof TestPlan, value: string) {
    setPlan(p => ({ ...p, [key]: value })); setReceipt(null); setError('');
  }
  return <section aria-labelledby={`${id}-title`}>
    <h4 id={`${id}-title`}>Disconfirmation lab · What would refute this claim?</h4>
    <p>Source data mode: synthetic. Seed {scenario.seed}; model version {scenario.modelVersion || 'unavailable—run the model first'}; horizon {scenario.horizon} {scenario.clock}s. Major uncertainty: {TEST_UNCERTAINTY}</p>
    <p>Design a proposed test, not a verified effect or forecast. Text stays in this page’s memory; it is never executed as law, sent or published. Copy the receipt before leaving. Review must assess measurement, units, comparison, timing and confounders before any conclusion.</p>
    <form onSubmit={e => { e.preventDefault(); try { setReceipt(proposedTestReceipt(context, plan)); setError(''); } catch (e) { setReceipt(null); setError((e as Error).message); } }}>
      {(['hypothesis', 'falsifier', 'sourceDetails'] as const).map(key => <p key={key}><label htmlFor={`${id}-${key}`}>{({ hypothesis: 'Model hypothesis', falsifier: 'Measurable falsifier (metric, units, comparison, timing and failure direction)', sourceDetails: 'Proposed data source (dataset/version, coverage and collection plan)' })[key]}</label><textarea id={`${id}-${key}`} required maxLength={1000} value={plan[key]} onChange={e => change(key, e.target.value)} /></p>)}
      <p><label htmlFor={`${id}-source`}>Evidence source type</label><select id={`${id}-source`} value={plan.source} onChange={e => change('source', e.target.value)}>{TEST_SOURCES.map(source => <option key={source}>{source}</option>)}</select></p>
      <p><label htmlFor={`${id}-threshold`}>Numeric failure threshold (in the falsifier’s units)</label><input id={`${id}-threshold`} required type="number" step="any" min={-1e9} max={1e9} value={plan.threshold} onChange={e => change('threshold', e.target.value)} /></p>
      <button type="submit">Prepare proposed test receipt</button>
      <button type="button" onClick={() => { setPlan({ hypothesis: '', falsifier: '', source: TEST_SOURCES[0], sourceDetails: '', threshold: '' }); setReceipt(null); setError(''); }}>Clear test</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {receipt && <div role="status"><p>Proposed test—awaiting review. No evidence collected; no effect verified.</p><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(receipt, null, 2)}</pre></div>}
  </section>;
}

import { useState } from 'react';
import type { BudgetRow } from '../shared/plan-budget';
import { receiptMoney, receiptValue, RESIDENT_DENOMINATORS, type ReceiptView } from '../shared/budget-receipt';

export function BudgetReceipt({ rows, lane }: { rows: BudgetRow[]; lane: string }) {
  const [selected, setSelected] = useState('');
  const [view, setView] = useState<ReceiptView>('annual');
  const row = rows.find(r => r.id === selected) ?? rows[0];
  const denominator = row && RESIDENT_DENOMINATORS[row.jurisdiction];
  let value: number | undefined;
  let error = '';
  if (row) try { value = receiptValue(row, view); } catch (e) { error = (e as Error).message; }
  return <section className="budget-receipt" aria-label="Interactive illustrative receipt">
    <h4>Where a budget dollar goes</h4>
    <p><b>Illustrative receipt · {lane === 'real' ? 'Real-input lane' : 'Blended-input lane'} · simulated fiscal amounts in both lanes.</b> This is not a verified personal tax bill or a prediction of anyone’s taxes or benefits. No personal financial information is requested or saved.</p>
    {!row ? <p role="status">No allocated proposals to convert. Synthesize a plan with an allocation first.</p> : <>
      <label>Receipt proposal <select value={row.id} onChange={e => setSelected(e.target.value)}>{rows.map(r => <option key={r.id} value={r.id}>{r.title} — {r.jurisdiction}</option>)}</select></label>
      <label>Receipt view <select value={view} onChange={e => setView(e.target.value as ReceiptView)}><option value="annual">Whole proposal per year</option><option value="resident">Per resident per year</option></select></label>
      <p role="status" aria-live="polite">{error || `${receiptMoney(value!)} ${view === 'resident' ? 'per resident per year' : 'per year'} — ${row.title}`}</p>
      <dl><dt>Budget level / jurisdiction</dt><dd>{denominator?.level ?? 'Unmapped level'} / {row.jurisdiction}</dd>
        <dt>Time period</dt><dd>One model year (1 year denominator); no fiscal calendar year specified. The model treats costs as recurring annual amounts, including capital proposals; one-time costs are not separately modeled.</dd>
        <dt>Funding source</dt><dd>Unspecified in the model. No tax, borrowing, grant or spending-offset mix is assumed or verified.</dd>
        <dt>Amount provenance</dt><dd>{row.source}; estimate date: {row.date}; uncertainty unknown.</dd></dl>
      {denominator ? <p>Resident denominator: {denominator.residents.toLocaleString('en-US')} people, {denominator.scope}. <a href={denominator.source}>U.S. Census Bureau, April 1, 2020 Census</a> (historical count, not current population). Residents include children and non-taxpayers; they are not a taxpayer or beneficiary count.</p> : <p>No matching sourced population is available; no other jurisdiction’s population is substituted.</p>}
      <p>Calculation: {row.amount.toLocaleString('en-US')} million USD × 1,000,000{view === 'resident' && denominator ? ` ÷ ${denominator.residents.toLocaleString('en-US')} residents` : ''} ÷ 1 model year. Display rounded to cents; this scale comparison assumes an equal share, not an actual allocation to each resident.</p>
    </>}
  </section>;
}

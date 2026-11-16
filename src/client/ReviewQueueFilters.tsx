import type { PublicPull } from '../shared/hbl-governance';
import { EMPTY_QUEUE_FILTERS, type QueueFilters } from './pr-review-queue';
export function ReviewQueueFilters({pulls, value, onChange}: {pulls: PublicPull[]; value: QueueFilters; onChange: (next: QueueFilters) => void}) {
  const reasons = [...new Set(pulls.filter(p => p.eligibility.state === 'blocked').map(p => p.eligibility.reason))].sort();
  const labels = [...new Set(pulls.flatMap(p => p.labels))].sort();
  const fields: [keyof QueueFilters, string, [string,string][]][] = [
    ['checks', 'Checks', ['unknown','pending','failed','passed'].map(v => [v,v])],
    ['review', 'Code review', [['unknown','Unknown'],['changes-requested','Changes requested'],['requested','Reviewer requested'],['needed','Current-head approval needed'],['review-ready','Current-head approval present']]],
    ['reason', 'Blocked reason', reasons.map(v => [v,v])],
    ['feature', 'Affected feature (GitHub label)', [['unknown','Unknown / no labels'],...labels.map(v => [`label:${v}`,v] as [string,string])]],
    ['age', 'Time since GitHub update', [['recent','Under 7 days'],['older','7 days or more'],['unknown','Unknown timestamp']]],
  ];
  return <fieldset className="gp-queue-filters"><legend>Discover PRs by evidence and consequence</legend><p>Labels describe affected features as reported by contributors. Missing evidence stays unknown; open PR details to fetch evidence. Current-head approval does not mean merge approval.</p><div>{fields.map(([key,label,options]) => <label key={key}>{label}<select value={value[key]} onChange={e => onChange({...value,[key]:e.target.value})}><option value="all">All</option>{options.map(([id,text]) => <option key={id} value={id}>{text}</option>)}</select></label>)}</div><button onClick={() => onChange({...EMPTY_QUEUE_FILTERS})}>Clear evidence filters</button></fieldset>;
}

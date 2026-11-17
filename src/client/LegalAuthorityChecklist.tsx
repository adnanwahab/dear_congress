import type { CatalogBill } from '../shared/bill-catalog';

/** Review prompts only: jurisdiction and popularity never establish legal authority.
 * No reviewed state is inferred or persisted by this read-only catalog. */
export function LegalAuthorityChecklist({ bill }: { bill: CatalogBill }) {
  const thirdPlaces = bill.id === 'HFL-051';
  const hypothesis = thirdPlaces
    ? 'Hypothesis only: a city might support noncommercial gathering spaces through facilities or operating grants. The city, enabling authority, appropriation process and limits have not been identified or verified.'
    : `Hypothesis only: the proposed ${bill.jurisdiction} jurisdiction might enact this concept. A reviewer must identify the responsible body, specific constitutional, statutory or charter authority, and required enactment and funding process.`;
  return <section className="bill-notice" aria-labelledby="legal-authority-heading">
    <h2 id="legal-authority-heading">Legal-authority checklist</h2>
    <p><strong>Legal review status: unverified</strong> · Non-binding editorial review prompts</p>
    <p>Proposed jurisdiction is not proof of power to enact this draft. No legal validity finding or human legal review is recorded.</p>
    <dl className="bill-fields">
      <div><dt>Authority hypothesis — unresolved</dt><dd>{hypothesis}</dd></div>
      <div><dt>Preemption questions — unresolved</dt><dd>{thirdPlaces
        ? 'Do state or federal rules limit city facilities, grants, procurement or funding conditions? Which local charter, budget and program rules apply?'
        : 'Could state or federal law preempt this proposal? Do existing laws, delegated powers or intergovernmental responsibilities limit the proposed action?'}</dd></div>
      <div><dt>Rights questions — unresolved</dt><dd>{thirdPlaces
        ? 'How would access and grant criteria protect equal treatment, disability access, speech, religious freedom and visitor privacy? What complaint and appeal protections are needed?'
        : 'What constitutional and civil-rights questions arise, including equal treatment, due process, speech, disability access and privacy? Which safeguards and remedies require review?'}</dd></div>
      <div><dt>Draft-specific review context</dt><dd>{bill.proposedChange} Existing safeguard prompt: {bill.safeguards}</dd></div>
      <div><dt>Authority sources / findings</dt><dd>None recorded. Obtain primary legal sources and document scope, conflicting interpretations and remaining uncertainty.</dd></div>
      <div><dt>Human reviewer / review date</dt><dd>Unassigned / not reviewed. A qualified human reviewer must record their name, date, sources and findings for this exact draft and any supplement before a validity finding can be displayed.</dd></div>
    </dl>
    <p>Checklist scope: {bill.id} · catalog revision {bill.revision}{thirdPlaces ? ' · plus the separate HFL-051 discussion supplement, version 1 (not included in the catalog digest)' : ''}. This checklist does not approve legislation, authorize participation or establish measured outcomes.</p>
  </section>;
}

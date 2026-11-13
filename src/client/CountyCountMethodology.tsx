/** Only local simulation counts belong here. Never pass observed participant counts. */
export function modeledCountyPercent(numerator: number, denominator: number, digits = 1) {
  return denominator === 0 ? 'No county models' : `${(numerator / denominator * 100).toFixed(digits)}%`;
}

export function CountyCountMethodology({ supported, total, revision }: { supported: number; total: number; revision: number }) {
  return <details className="county-methodology">
    <summary>How these counts were obtained</summary>
    <dl>
      <dt>What is counted?</dt>
      <dd>County models, not people. The population is all {total.toLocaleString()} bundled county and county-equivalent shapes in the 50 states and D.C.; territories are excluded. Every model has equal weight, regardless of population.</dd>
      <dt>Current numerator and denominator</dt>
      <dd>Revision {revision}: {supported.toLocaleString()} / {total.toLocaleString()} county models meet all four synthetic requirements ({modeledCountyPercent(supported, total)}). Shape coverage is {total.toLocaleString()} / {total.toLocaleString()} bundled shapes. Search, selection and status filters do not change these national denominators.</dd>
      <dt>Source and update</dt>
      <dd>Data origin: U.S. Census Bureau 2023 boundaries; requirements generated deterministically from county FIPS codes. Counts recalculate locally on each plan revision or restart. There is no observation collection window or live update timestamp. Plan scores use a 0–100 model scale, not a percentage of residents.</dd>
      <dt>Real participation and privacy</dt>
      <dd>Raw resident ballots, distinct unverified browser tokens, verified eligible participants and observed geographic coverage: not collected by this map. No real observations are added to these simulated totals. County geometry does not establish participation. No resident cells or subgroups are published here; real geographic counts need privacy review and withholding of small groups before publication.</dd>
      <dt>Missingness and nonresponse</dt>
      <dd>Resident geography and eligibility are not collected here. Nonresponse is unknown: there is no invitation list or known number of eligible people invited. Missing resident data are not opposition or zero participation.</dd>
      <dt>Uncertainty and interpretation</dt>
      <dd>This is not a representative survey. Voluntary browser responses elsewhere are self-selected and do not verify unique people or residency. Population approval, margin of error and survey design effects cannot be estimated from this simulation. Meeting all modeled requirements is not evidence of public consensus.</dd>
    </dl>
  </details>;
}

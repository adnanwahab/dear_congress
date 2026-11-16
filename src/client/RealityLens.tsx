import { useEffect, useId, useState } from 'react';
import './reality-lens.css';

export const REALITY_LENS_KEY = 'civic-reality-lens-v1';
type Detail = 'compact' | 'expanded';
const parseDetail = (value: string | null): Detail => value === 'expanded' ? 'expanded' : 'compact';
function readDetail(): Detail {
  try { return parseDetail(localStorage.getItem(REALITY_LENS_KEY)); } catch { return 'compact'; }
}

/** A reading aid only. Never changes API inputs, record origins, or counts. */
export function RealityLens() {
  const [detail, setDetail] = useState<Detail>(readDetail);
  const id = useId();
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === REALITY_LENS_KEY || event.key === null) setDetail(readDetail());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const expanded = detail === 'expanded';
  return <section className="reality-lens" aria-label="Reality lens">
    <div className="reality-lens-heading">
      <strong>Reality lens</strong>
      <span>Actual activity · Seeded examples · Model simulations</span>
      <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => {
        const next = expanded ? 'compact' : 'expanded';
        setDetail(next);
        try { localStorage.setItem(REALITY_LENS_KEY, next); } catch { /* Reading aid still works without storage. */ }
      }}>{expanded ? 'Less detail' : 'Explain data'}</button>
    </div>
    <div id={id} hidden={!expanded}>
      <dl>
        <div><dt>Actual activity</dt><dd>Saved public submissions and browser advisory choices. These are unverified activity, not unique people, representative opinion or official votes.</dd></div>
        <div><dt>Seeded examples</dt><dd>Fictional sample proposals, stories and illustrative tallies. A linked real source does not make an example an actual event.</dd></div>
        <div><dt>Model simulations</dt><dd>Generated residents, scenarios, scores and estimated outcomes. Mixed-input synthesis remains model output, not measured participation.</dd></div>
        <div><dt>Source-backed records</dt><dd>Read the original source, retrieval date and limitations. Official metadata and measured conditions are separate from participation and fictional outcomes.</dd></div>
        <div><dt>Missing or mixed origin</dt><dd>Missing provenance or unavailable counts mean unknown, not zero or verified activity. Read each section’s origin label; mixed displays do not make a combined actual count.</dd></div>
      </dl>
      <p>This preference saves the legend’s detail level in this browser across pages. It never changes data, totals, vote authority or synthesis settings. Loading, empty and error states do not establish provenance.</p>
    </div>
  </section>;
}

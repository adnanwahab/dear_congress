import { useState } from 'react';
import './jurisdiction.css';

export const JURISDICTIONS = ['United States', 'Texas', 'Harris County', 'Houston'] as const;
export type Jurisdiction = '' | typeof JURISDICTIONS[number];
export const JURISDICTION_KEY = 'civic_browse_jurisdiction_v1';
export function validJurisdiction(value: string | null): value is Jurisdiction {
  return value === '' || JURISDICTIONS.some(j => j === value);
}
export function useJurisdiction() {
  const [preference, setPreference] = useState(() => {
    try {
      const saved = localStorage.getItem(JURISDICTION_KEY);
      return saved === null || validJurisdiction(saved)
        ? { value: (saved ?? '') as Jurisdiction, notice: '' }
        : { value: '' as Jurisdiction, notice: 'Unsupported saved locality. Showing All jurisdictions.' };
    } catch { return { value: '' as Jurisdiction, notice: 'Browser storage is unavailable. Showing All jurisdictions; choices work for this visit.' }; }
  });
  function change(value: string) {
    const valid = validJurisdiction(value);
    const next = valid ? value : '';
    let notice = valid ? '' : 'Unsupported locality. Showing All jurisdictions.';
    try {
      if (next) localStorage.setItem(JURISDICTION_KEY, next);
      else localStorage.removeItem(JURISDICTION_KEY);
    } catch { notice += ' Browser storage is unavailable; this choice applies only to this visit. A previous saved choice may return after reload.'; }
    setPreference({ value: next, notice });
  }
  return { ...preference, change };
}
export function JurisdictionPicker({ preference, count }: { preference: ReturnType<typeof useJurisdiction>; count: number | null }) {
  return <section className="jurisdiction-picker" aria-label="Jurisdiction browsing preference">
    <div><label>Browse jurisdiction<select value={preference.value} onChange={e => preference.change(e.target.value)}>
      <option value="">All jurisdictions</option>{JURISDICTIONS.map(j => <option key={j}>{j}</option>)}
    </select></label><button type="button" onClick={() => preference.change('')}>Clear jurisdiction preference</button></div>
    <p>Optional browsing preference, not residency verification or voting eligibility. No signup or device location needed.</p>
    <p role="status" aria-live="polite">{preference.notice} {preference.value ? `Showing ${preference.value} decision scope only; overlapping governments are not included.` : 'Showing All jurisdictions, including regional or unmapped scopes.'} {count === null ? 'Loading proposals…' : `${count} applicable proposals.`}</p>
  </section>;
}

// Explicit fictional fixture mapping, never inferred from a generic City/County label.
// METRO's regional scenario intentionally remains in All jurisdictions only.
export const SAMPLE_JURISDICTIONS: Readonly<Record<string, Jurisdiction>> = {
  'demo-housing': 'Houston', 'demo-childcare': 'United States',
  'demo-flood': 'Harris County', 'demo-health': 'United States',
  'demo-streets': 'Houston', 'demo-food': 'Harris County',
  'demo-mental-health': 'Texas', 'demo-permits': 'Houston',
  'demo-insurance': 'Texas', 'demo-shade': 'Houston', 'demo-budget': 'Harris County',
};
export function sampleMatchesJurisdiction(id: string, jurisdiction: Jurisdiction) {
  return !jurisdiction || SAMPLE_JURISDICTIONS[id] === jurisdiction;
}

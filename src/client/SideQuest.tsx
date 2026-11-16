import { useRef, useState } from 'react';
import type { DemoItem } from '../engine/demo';
import './side-quest.css';

// Fixed editorial associations; no ballots, activity counts, profiles or model output.
export const SIDE_QUESTS: Readonly<Record<string, { title: string; reason: string; publisher: string; url: string; scope: string }>> = {
  'demo-housing': { title: 'Investigate development standards and housing variety', reason: 'This sample concerns housing rules. The planning department describes development standards and links to housing variety resources.', publisher: 'City of Houston Planning and Development Department', url: 'https://www.houstontx.gov/planning/', scope: 'Department background; does not verify the fictional cottage clause or its effects.' },
  'demo-food': { title: 'Compare ways to measure food access', reason: 'This sample concerns grocery access. The Atlas offers different measures of distance and retailer access to investigate.', publisher: 'USDA Economic Research Service', url: 'https://www.ers.usda.gov/data-products/food-access-research-atlas', scope: 'Food access indicators; does not establish that the fictional mobile grocery pilot works.' },
  'demo-health': { title: 'Read hospital price transparency background', reason: 'This sample concerns medical prices. CMS provides background on hospital price transparency to compare with the sample draft.', publisher: 'Centers for Medicare & Medicaid Services', url: 'https://www.cms.gov/priorities/key-initiatives/hospital-price-transparency', scope: 'Hospital transparency background; does not verify the fictional combined-estimate clause.' },
};
const KEY = 'civic_optional_reads_v1';
type Preferences = { off: boolean; dismissed: string[] };
function readPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (typeof value?.off === 'boolean' && Array.isArray(value.dismissed) && value.dismissed.every((id: unknown) => typeof id === 'string')) return value;
  } catch {}
  return { off: false, dismissed: [] };
}
export function SideQuest({ item, loading = false, failed = false }: { item?: Pick<DemoItem, 'id'>; loading?: boolean; failed?: boolean }) {
  const [preferences, setPreferences] = useState(readPreferences);
  const [storageFailed, setStorageFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const quest = item ? SIDE_QUESTS[item.id] : undefined;
  function save(next: Preferences) {
    setPreferences(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); setStorageFailed(false); }
    catch { setStorageFailed(true); }
    heading.current?.focus();
  }
  return <section className="panel side-quest" aria-label="Optional related reading">
    <h2 ref={heading} tabIndex={-1}>One optional detour</h2>
    <p>Explore if useful. No reward, deadline or next-task queue. Suggestions use only the sample you are viewing, never your vote or posting activity.</p>
    {preferences.off ? <><p role="status">Related reading is turned off in this browser.</p><button className="outline" onClick={() => save({ ...preferences, off: false })}>Turn related reading on</button></> : <>
      {failed ? <p role="status">Related reading is unavailable while proposals cannot be refreshed. Use the proposal retry control.</p> : loading ? <p role="status">Loading related reading…</p> : !quest ? <p>No reviewed related reading for this sample yet.</p> : preferences.dismissed.includes(item!.id) ? <p role="status">Suggestion dismissed. No replacement will be queued.</p> : <>
        <h3>{quest.title}</h3><p><strong>Why this suggestion:</strong> {quest.reason}</p>
        <p>{quest.publisher} · Source page reviewed November 14, 2026 for this limited reading suggestion.</p>
        <p>{quest.scope} Sample proposals are fictional; this read contains no advisory counts or model results.</p>
        <div className="side-quest-actions"><a href={quest.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Read the source (opens a new tab)</a><button className="outline" onClick={() => save({ ...preferences, dismissed: [...preferences.dismissed, item!.id] })}>Dismiss this suggestion</button></div>
      </>}
      <button className="outline" onClick={() => save({ ...preferences, off: true })}>Turn off related reading</button>
    </>}
    {storageFailed && <p role="status">Browser storage is unavailable. This preference lasts only while this page is open.</p>}
  </section>;
}

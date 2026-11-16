import { useState } from 'react';
import { distributionMarker, DISTRIBUTION_TTL, type Distribution } from '../shared/distribution';
let active: Distribution | null = null;
let completed = false;
export function distributionHeaders(): Record<string, string> {
  const marker = distributionMarker(active);
  return marker && !completed ? { 'x-distribution': JSON.stringify(marker) } : {};
}
export function distributionCompleted(response: Response) {
  if (response.headers.get('x-distribution-recorded') === '1') completed = true;
}
export function DistributionConsent() {
  const [pending, setPending] = useState(() => {
    const url = new URL(window.location.href);
    const source = url.searchParams.get('cs_source'), campaign = url.searchParams.get('cs_campaign');
    if (!source && !campaign) return null;
    url.searchParams.delete('cs_source'); url.searchParams.delete('cs_campaign');
    window.history.replaceState(window.history.state, '', url);
    return distributionMarker({source, campaign, landing: url.pathname, expires: Date.now() + DISTRIBUTION_TTL});
  });
  const [enabled, setEnabled] = useState(false);
  if (!pending && !enabled) return null;
  return <aside aria-label="Optional launch measurement" style={{padding: '1rem'}}><p>Optional launch measurement: count this link’s source category, campaign and landing route, and your first accepted real journal publication or civic sandbox vote. Counts are approximate activity, not proof of usefulness or understanding. No identity is attached. Permission lasts up to 30 minutes on this page and ends on reload. <a href="/privacy">Privacy details</a></p>{enabled ? <button onClick={() => { active = null; setEnabled(false); }}>Stop launch measurement</button> : <><button onClick={() => {
    active = pending; completed = false; setPending(null); setEnabled(true);
    void fetch('/api/page-view', {method: 'POST', credentials: 'omit', headers: {'content-type':'application/json'}, body: JSON.stringify({path: pending!.landing, distribution: pending})}).catch(() => {});
  }}>Allow launch measurement</button> <button onClick={() => setPending(null)}>No thanks</button></>}</aside>;
}

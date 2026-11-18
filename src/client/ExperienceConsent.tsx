import { useEffect, useState } from 'react';
import { qualityAllowed, setQualityConsent } from './experience-quality';
export function ExperienceConsent() {
  const [enabled, setEnabled] = useState(() => qualityAllowed());
  useEffect(() => {
    const sync = () => setEnabled(qualityAllowed());
    window.addEventListener('storage', sync); window.addEventListener('quality-consent', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('quality-consent', sync); };
  }, []);
  return <details className="civic-shell" data-experience-consent hidden><summary>Experience metrics &amp; privacy</summary><p>Optional first-party counts help us improve transitions, demo completion, comparison and model recovery. Only coarse browser capabilities and latency buckets are retained for 30 days. No opinions, journal text, location, visitor IDs or cross-site tracking. Off by default; turning off stops future sends. Do Not Track and Global Privacy Control take priority. Previously combined counts cannot identify you for deletion.</p><label><input type="checkbox" checked={enabled} onChange={e => setQualityConsent(e.target.checked)} /> Allow optional experience metrics</label></details>;
}

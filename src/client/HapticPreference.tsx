import { useEffect, useState } from 'react';
import { hapticsEnabled, setHapticsEnabled } from './haptics';

export function HapticPreference() {
  const [enabled, setEnabled] = useState(hapticsEnabled);
  useEffect(() => {
    const update = () => setEnabled(hapticsEnabled());
    window.addEventListener('haptics-preference', update);
    return () => window.removeEventListener('haptics-preference', update);
  }, []);
  return <label><input type="checkbox" checked={enabled} onChange={e => {
    setHapticsEnabled(e.target.checked); setEnabled(e.target.checked);
  }} /> Optional haptics · supported devices only (off by default; paused for reduced motion)</label>;
}

import { useState } from 'react';

export const MAP_TIMEOUT_MS = 10_000;
type MapStatus = 'loading' | 'ready' | 'unavailable';

// Never log raw MapLibre errors: they may contain credential-bearing URLs.
export function mapAttempt(onStatus: (status: MapStatus) => void, timeout = MAP_TIMEOUT_MS) {
  let stopped = false;
  const timer = setTimeout(() => fail('timeout'), timeout);
  const fail = (reason: 'timeout' | 'resource' | 'initialization') => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    console.warn(`[map] Visualization unavailable (${reason}); check map provider configuration, connectivity and browser policy.`);
    onStatus('unavailable');
  };
  return {
    fail,
    ready() { if (!stopped) { clearTimeout(timer); onStatus('ready'); } },
    get active() { return !stopped; },
    dispose() { stopped = true; clearTimeout(timer); },
  };
}

export function useMapAvailability(styleUrl?: string) {
  const [status, setStatus] = useState<MapStatus>(styleUrl ? 'loading' : 'unavailable');
  const [attempt, setAttempt] = useState(0);
  return { status, setStatus, attempt, retry: () => { setStatus('loading'); setAttempt(n => n + 1); } };
}

export function MapAvailability({ status, retry, configured }: { status: MapStatus; retry: () => void; configured: boolean }) {
  return <div className="optional-map-status">
    <p role="status" className="muted s">{status === 'loading' ? 'Map visualization loading; explore needs below.' : status === 'unavailable' ? 'Map visualization unavailable; explore needs below.' : 'Map visualization available. Needs and jurisdiction summaries are also listed as text.'}</p>
    {configured && <button type="button" className="ghost" disabled={status !== 'unavailable'} onClick={retry}>Retry map visualization</button>}
  </div>;
}

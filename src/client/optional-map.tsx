import { StateFeedback } from './StateFeedback';
import { useEffect, useState } from 'react';

export const MAP_TIMEOUT_MS = 10_000;
type MapStatus = 'loading' | 'ready' | 'unavailable';

// Browser-generated request ID identifies one local dependency attempt, not a server trace.
export function logMapFailure(reason: 'configuration' | 'timeout' | 'resource' | 'initialization' | 'geographic-data', requestId = crypto.randomUUID()) {
  console.warn(`[map] requestId=${requestId} reason=${reason}; check map provider configuration, connectivity and browser policy.`);
  return requestId;
}

// Never log raw MapLibre errors: they may contain credential-bearing URLs.
export function mapAttempt(onStatus: (status: MapStatus) => void, timeout = MAP_TIMEOUT_MS) {
  const requestId = crypto.randomUUID();
  let stopped = false;
  const timer = setTimeout(() => fail('timeout'), timeout);
  const fail = (reason: 'timeout' | 'resource' | 'initialization') => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    logMapFailure(reason, requestId);
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
  useEffect(() => { if (!styleUrl) logMapFailure('configuration'); }, [styleUrl]);
  const [attempt, setAttempt] = useState(0);
  return { status, setStatus, attempt, retry: () => { setStatus('loading'); setAttempt(n => n + 1); } };
}

export function MapAvailability({ status, retry, configured }: { status: MapStatus; retry: () => void; configured: boolean }) {
  return <div className="optional-map-status">
    <p role="status" className="muted s"><StateFeedback state={status === 'loading' ? 'syncing' : status === 'unavailable' ? 'unavailable' : 'updated'}>{status === 'loading' ? 'Map visualization loading; explore needs below.' : status === 'unavailable' ? 'Map visualization unavailable; explore needs below.' : 'Map visualization available. Needs and jurisdiction summaries are also listed as text.'}</StateFeedback></p>
    {status === 'unavailable' && <p className="muted s">{configured ? 'Maps are temporarily disabled after a loading failure.' : 'Maps are disabled because no map provider is configured.'} Use the text lists below; geographic evidence retains the same selected need, coordinates, source and counts when available.</p>}
    {configured && <button type="button" className="ghost" disabled={status !== 'unavailable'} onClick={retry}>Retry map visualization</button>}
  </div>;
}

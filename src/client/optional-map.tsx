import { StateFeedback } from './StateFeedback';
import { useState } from 'react';

export const MAP_TIMEOUT_MS = 10_000;
export type MapFailure = 'timeout' | 'resource' | 'initialization';
type MapStatus = 'loading' | 'ready' | 'unavailable';

// Never log raw MapLibre errors: they may contain credential-bearing URLs.
export function mapAttempt(onStatus: (status: MapStatus, reason?: MapFailure) => void, timeout = MAP_TIMEOUT_MS) {
  let stopped = false;
  const timer = setTimeout(() => fail('timeout'), timeout);
  const fail = (reason: MapFailure) => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    console.warn(`[map] Visualization unavailable (${reason}); check map provider configuration, connectivity and browser policy.`);
    onStatus('unavailable', reason);
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
  const [reason, setReason] = useState<MapFailure>();
  const [lastSuccess, setLastSuccess] = useState<{ styleUrl: string | undefined; at: string }>();
  const [attempt, setAttempt] = useState(0);
  return { status, reason, lastSuccess: lastSuccess?.styleUrl === styleUrl ? lastSuccess?.at : undefined, setStatus: (next: MapStatus, failure?: MapFailure) => { setStatus(next); setReason(failure); if (next === 'ready') setLastSuccess({ styleUrl, at: new Date().toISOString() }); }, attempt, retry: () => { setStatus('loading'); setAttempt(n => n + 1); } };
}

export function MapAvailability({ status, retry, configured, reason, lastSuccess }: { reason?: MapFailure; lastSuccess?: string; status: MapStatus; retry: () => void; configured: boolean }) {
  return <div className="optional-map-status">
    <p role="status" className="muted s"><StateFeedback state={status === 'loading' ? 'syncing' : status === 'unavailable' ? 'unavailable' : 'updated'}>{status === 'loading' ? 'Map visualization loading; explore needs below.' : status === 'unavailable' ? 'Map visualization unavailable; explore needs below.' : 'Map visualization available. Needs and jurisdiction summaries are also listed as text.'}</StateFeedback></p>
    <p className="muted s">Last successful map render in this view: {lastSuccess ?? 'Never observed'}. { !configured ? 'Map provider is not configured.' : reason === 'initialization' ? 'Local map initialization failed; provider health is unknown.' : reason === 'resource' ? 'Map resource loading failed; provider outage, connectivity and browser policy cannot be distinguished here.' : reason === 'timeout' ? 'Map timed out; provider and local rendering health are unknown.' : 'Provider availability is inferred only from this browser render, not independently verified.'}</p>
    {configured && <button type="button" className="ghost" disabled={status !== 'unavailable'} onClick={retry}>Retry map visualization</button>}
  </div>;
}

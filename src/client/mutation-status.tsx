import { StateFeedback } from './StateFeedback';
/** Retry-After supports delta seconds and HTTP dates. Missing/invalid values use a
 * conservative local cooldown, never automatic resubmission. */
export function retryDeadline(header: string | null, now = Date.now()): number {
  const value = header?.trim() ?? '';
  const delay = /^\d+$/.test(value) ? Number(value) * 1000 : NaN;
  if (Number.isFinite(delay) && Number.isSafeInteger(delay) && Number.isSafeInteger(now + delay) && now + delay <= 8640000000000000) return now + delay;
  const date = /^[A-Za-z]{3},/.test(value) ? Date.parse(value) : NaN;
  return Number.isFinite(date) ? Math.max(now, date) : now + 60000;
}
export class MutationError extends Error {
  constructor(message: string, public status: number, public retryAfter: string | null) {
    super(status === 429 ? `Too many requests. Try again after ${new Date(retryDeadline(retryAfter)).toLocaleTimeString()}. Your input remains on this page; nothing will be retried automatically.` : message);
  }
}
export type MutationState = { phase: 'idle' | 'submitting' | 'confirmed' | 'failed'; message: string };
export function MutationStatus({ state, retry, disabled = false }: { state: MutationState; retry?: () => void; disabled?: boolean }) {
  if (state.phase === 'idle') return null;
  return <div className="workflow-status" role={state.phase === 'failed' ? 'alert' : 'status'} aria-live="polite">
    <StateFeedback state={state.phase === 'failed' ? 'error' : state.phase === 'submitting' ? 'syncing' : 'saved'}>{state.message}</StateFeedback> {state.phase === 'failed' && retry && <button disabled={disabled} onClick={retry}>Retry exact advisory choice</button>}
  </div>;
}

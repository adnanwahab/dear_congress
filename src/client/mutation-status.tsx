export class MutationError extends Error {
  constructor(message: string, public status: number, public retryAfter: string | null) { super(message); }
}
export type MutationState = { phase: 'idle' | 'submitting' | 'confirmed' | 'failed'; message: string };
export function MutationStatus({ state, retry, disabled = false }: { state: MutationState; retry?: () => void; disabled?: boolean }) {
  if (state.phase === 'idle') return null;
  return <div className="workflow-status" role={state.phase === 'failed' ? 'alert' : 'status'} aria-live="polite">
    {state.message} {state.phase === 'failed' && retry && <button disabled={disabled} onClick={retry}>Retry exact advisory choice</button>}
  </div>;
}

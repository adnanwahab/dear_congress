import { computeSynthesis, type SynthesisJob } from './synthesis-compute';

let active = 0;
const MAX_ACTIVE = 2;
/** Bounded, disposable workers. No unbounded queue or blocking fallback on failure. */
export function runSynthesis(job: SynthesisJob, signal?: AbortSignal): Promise<ReturnType<typeof computeSynthesis>> {
  if (signal?.aborted) return Promise.reject(new Error('Synthesis cancelled'));
  // Reversible operator rollback; never configured through a public request.
  if (process.env.SYNTHESIS_EXECUTION === 'inline') return Promise.resolve(computeSynthesis(job));
  if (active >= MAX_ACTIVE) return Promise.reject(new Error('Synthesis busy. Please retry.'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./synthesis-worker.ts', import.meta.url).href);
    active++;
    let finished = false;
    const finish = (error?: Error, result?: ReturnType<typeof computeSynthesis>) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      active--;
      if (error) reject(error); else resolve(result!);
    };
    const abort = () => finish(new Error('Synthesis cancelled'));
    const timer = setTimeout(() => finish(new Error('Synthesis timed out. Please retry.')), 30_000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = event => {
      if (event.data.error) finish(new Error(event.data.error));
      else finish(undefined, event.data.result);
    };
    worker.onerror = event => { event.preventDefault(); finish(new Error(event.message || 'Synthesis worker failed')); };
    try { worker.postMessage(job); } catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
  });
}

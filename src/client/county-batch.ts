import { countyVote, requirements } from './county-simulation';
export type BatchResult = { plan: number[]; votes: ReturnType<typeof countyVote>[] };
/** Bounded chunks give fallback browsers a task boundary for input and cancellation. */
export async function evaluateCountyBatch(ids: string[], plan: number[], progress: (done: number) => void, cancelled: () => boolean): Promise<BatchResult | null> {
  const targets = [0, 0, 0, 0];
  for (let start = 0; start < ids.length; start += 128) {
    if (cancelled()) return null;
    for (const id of ids.slice(start, start + 128)) requirements(id).forEach((need, i) => { targets[i] = Math.max(targets[i]!, need); });
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const next = plan.map((value, i) => Math.min(targets[i]!, value + 9));
  const votes: BatchResult['votes'] = [];
  for (let start = 0; start < ids.length; start += 128) {
    if (cancelled()) return null;
    votes.push(...ids.slice(start, start + 128).map(id => countyVote(id, next)));
    if (votes.length % 1024 === 0 || votes.length === ids.length) progress(votes.length);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return cancelled() ? null : { plan: next, votes };
}
export function startCountyBatch(ids: string[], plan: number[], useWorker: boolean, progress: (done: number) => void, complete: (result: BatchResult) => void): () => void {
  let cancelled = false;
  let worker: Worker | undefined;
  let fallbackStarted = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const fallback = () => {
    if (fallbackStarted || cancelled) return;
    fallbackStarted = true;
    clearTimeout(watchdog);
    worker?.terminate();
    void evaluateCountyBatch(ids, plan, done => { if (!cancelled) progress(done); }, () => cancelled).then(result => { if (result && !cancelled) complete(result); });
  };
  if (useWorker && typeof Worker !== 'undefined') {
    try {
      watchdog = setTimeout(fallback, 5000);
      worker = new Worker('/county-worker.js', { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ done: number; result?: BatchResult }>) => {
        if (cancelled || fallbackStarted) return;
        clearTimeout(watchdog);
        watchdog = setTimeout(fallback, 5000);
        progress(event.data.done);
        if (event.data.result) { clearTimeout(watchdog); worker?.terminate(); complete(event.data.result); }
      };
      worker.onerror = event => { event.preventDefault(); fallback(); };
      worker.onmessageerror = fallback;
      worker.postMessage({ ids, plan });
    } catch { fallback(); }
  } else fallback();
  return () => { cancelled = true; clearTimeout(watchdog); worker?.terminate(); };
}

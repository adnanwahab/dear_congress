import { evaluateCountyBatch } from './county-batch';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent<{ ids: string[]; plan: number[] }>) => void; postMessage: (data: unknown) => void };
scope.onmessage = async ({ data }) => {
  const result = await evaluateCountyBatch(data.ids, data.plan, done => scope.postMessage({ done }), () => false);
  if (result) scope.postMessage({ done: data.ids.length, result });
};

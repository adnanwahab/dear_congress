import { advisorySnapshot } from '../src/client/advisory-snapshot';

// Deterministic local reliability probe: deliver the newer response first.
// The baseline mirrors WorkflowScreen's former unconditional .then(setData).
async function probe(guarded: boolean) {
  let regressions = 0;
  for (let trial = 0; trial < 100; trial++) {
    const resolvers: Array<(value: number) => void> = [];
    const read = () => new Promise<number>(resolve => resolvers.push(resolve));
    let rendered = 0;
    const apply = (value: number) => { rendered = value; };
    const reader = advisorySnapshot(read, apply, () => {});
    const refresh = guarded ? () => reader.refresh() : () => read().then(apply);
    const old = refresh(), latest = refresh();
    resolvers[1]!(2); await latest;
    resolvers[0]!(1); await old;
    if (rendered !== 2) regressions++;
  }
  return regressions;
}
console.log(JSON.stringify({ trials: 100, staleResponseRegressionsBefore: await probe(false), staleResponseRegressionsAfter: await probe(true), networkRequests: 0 }));

import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDB } from "../engine/engine";
import { createPolicyComparison } from "../server/policy-comparison";
import { ComparisonDetails, InputDifferences, PolicyComparisonPanel } from "./PolicyComparison";

test("comparison pilot renders native labels, semantic input table, unknown outcomes and replay provenance", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", { configurable: true, value: { origin: "http://localhost" } });
  try {
    const controls = renderToStaticMarkup(<PolicyComparisonPanel />);
    for (const text of ['aria-label="Policy comparison pilot"', '<legend>Choose comparison inputs</legend>', '<label>World A', '<label>World B', '<label>Shared seed', 'role="status"', 'Simulation, not forecast']) expect(controls).toContain(text);
    const comparison = createPolicyComparison(emptyDB(), { a: "A", b: "A", seed: 0 });
    const details = renderToStaticMarkup(<ComparisonDetails comparison={comparison} />);
    expect(details).toContain('<caption>Frozen package inputs');
    expect(details).toContain('Illustrative national USD billions');
    expect(details.match(/scope="col"/g)).toHaveLength(4);
    expect(details.match(/scope="row"/g)).toHaveLength(2);
    expect(details).toContain(`http://localhost/synth?comparison=${comparison.id}`);
    expect(details).toContain('unknown');
    expect(details).toContain('not a result hash');
    expect(details).toContain('No WebGPU required');
    expect(details).toContain(`href="/api/policy-comparisons/${comparison.id}"`);
  } finally {
    if (previous) Object.defineProperty(globalThis, "location", previous);
    else Reflect.deleteProperty(globalThis, "location");
  }
});

 test("edited settings expose exact differences while pending packages remain unknown", () => {
  const comparison = createPolicyComparison(emptyDB(), { a: "A", b: "B" });
  const chosen = { weights: { support: .4, welfare: .25, fairness: .15, feasibility: .1, reversibility: .1, evidence: .1 }, lambda: .5, budget: 55, packages: [], pending: true };
  const markup = renderToStaticMarkup(<InputDifferences chosen={chosen} comparison={comparison} />);
  expect(markup).toContain("Chosen synthesis settings versus default demo");
  expect(markup).toContain("<td>0.4</td><td>0.3</td><td>0.1</td>");
  expect(markup).toContain("<td>55</td><td>40</td><td>15</td>");
  expect(markup).toContain("Previous packages do not represent these inputs");
  expect(markup).toContain("Unavailable until current calculation completes");
  expect(markup).toContain("Model execution is unavailable");
  const complete = renderToStaticMarkup(<InputDifferences chosen={{ ...chosen, packages: comparison.content.worlds as any, pending: false }} comparison={comparison} />);
  expect(complete).toContain("Chosen only: None. Frozen only: None");
 });

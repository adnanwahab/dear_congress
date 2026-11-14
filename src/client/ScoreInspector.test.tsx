import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { buildContext, DEFAULT_WEIGHTS, emptyDB, synthesize } from "../engine/engine";
import { ScoreInspector } from "./ScoreInspector";

test("inspector exposes every score through native keyboard disclosures and exact inputs", () => {
  const pkg = synthesize(buildContext(emptyDB(), [], { now: 0 }), DEFAULT_WEIGHTS, 0.25, 0)[0]!;
  const before = JSON.stringify(pkg);
  const html = renderToStaticMarkup(<ScoreInspector pkg={pkg} />);
  expect(html).toContain('<summary>Why this plan?</summary>');
  expect(html).toContain('Exact arithmetic inputs (JSON)');
  expect(html).toContain('not verified predictions');
  expect(html).toContain('Measured impact: unavailable');
  expect(html).toContain('Rounding adjustment:');
  expect(html).not.toContain('NaN');
  expect(html).not.toContain('<input');
  expect(html.match(/<summary>/g)).toHaveLength(pkg.scoreAudit.proposals.length + 2);
  for (const row of pkg.scoreAudit.proposals) expect(html).toContain(row.id);
  expect(JSON.stringify(pkg)).toBe(before);
});

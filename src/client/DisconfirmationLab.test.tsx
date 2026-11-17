import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DisconfirmationLab, proposedTestReceipt, type TestPlan } from './DisconfirmationLab';
const context = { lawId: 83, implementationStrength: .5, seed: 42, population: 24 as const, revision: 1, modelVersion: 'test-v1' };
const plan: TestPlan = { hypothesis: 'Transit lowers travel time', falsifier: 'At minute 720, edited minus baseline travel minutes >= 0', source: 'Paired synthetic checkpoints', sourceDetails: 'Same-seed paired receipt; final checkpoint; missing data inconclusive', threshold: '0' };
test('proposed receipts reproduce exactly and retain scenario/review isolation', () => {
  const before = JSON.stringify(context);
  const receipt = proposedTestReceipt(context, plan);
  expect(JSON.parse(JSON.stringify(receipt))).toEqual(proposedTestReceipt(context, plan));
  expect(receipt.status).toBe('proposed test—awaiting review');
  expect(receipt.scenario.seed).toBe(42);
  expect(receipt.scenario.horizon).toBe(720);
  expect(receipt.test.failureThreshold).toBe(0);
  expect(proposedTestReceipt({ ...context, revision: 2 }, plan)).not.toEqual(receipt);
  expect(JSON.stringify(context)).toBe(before);
});
test('rejects unknown sources, unsupported scenarios and unbounded/empty inputs', () => {
  for (const threshold of ['', 'Infinity', 'NaN', '1000000001']) expect(() => proposedTestReceipt(context, { ...plan, threshold })).toThrow();
  expect(() => proposedTestReceipt(context, { ...plan, source: 'private journal' as any })).toThrow();
  expect(() => proposedTestReceipt(context, { ...plan, falsifier: ' ' })).toThrow();
  expect(() => proposedTestReceipt({ ...context, lawId: 99 }, plan)).toThrow();
});
test('planner uses labeled native controls, explicit provenance and no implied verification', () => {
  const html = renderToStaticMarkup(<DisconfirmationLab context={context} />);
  for (const phrase of ['Source data mode', 'Seed 42', 'test-v1', '720', 'Major uncertainty', 'Measurable falsifier', 'Evidence source type', 'Numeric failure threshold', 'never executed as law']) expect(html).toContain(phrase);
  expect(html).toContain('<form');
  expect(html).not.toContain('autofocus');
});
test('mounted planner supports input, repeat receipt, invalidation and reset privately', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-disconfirmation-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS planning');
});

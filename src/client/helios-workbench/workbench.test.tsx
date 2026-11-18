import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { counts, verifySnapshot } from './contract';
import { HeliosWorkbench, RoundSummary, TextRedline } from './HeliosWorkbench';
import { fixture, selection } from './fixtures';

test('exact source verification fails closed on hash and scope mismatch', async () => {
  const data = await fixture();
  expect((await verifySnapshot(selection, data)).objections.map(o => o.id)).toEqual(['public']);
  await expect(verifySnapshot({ ...selection, revision: 'stale' }, data)).rejects.toThrow();
  await expect(verifySnapshot(selection, { ...data, source: { ...data.source, text: 'tampered' } })).rejects.toThrow();
  await expect(verifySnapshot(selection, { ...data, amendments: [{ ...data.amendments[0]!, textHash: 'wrong' }] })).rejects.toThrow();
  await expect(verifySnapshot(selection, { ...data, amendments: [{ ...data.amendments[0]!, parentRevision: 'other' }] })).rejects.toThrow();
  await expect(verifySnapshot(selection, { ...data, amendments: [{ ...data.amendments[0]!, round: data.round }] })).rejects.toThrow();
});
test('independent denominators, zero and all unsure never imply consensus', async () => {
  const data = await fixture();
  const empty = renderToStaticMarkup(<RoundSummary round={data.round} />);
  expect(empty).toContain('No responses'); expect(empty).toContain('undefined');
  const unsure = renderToStaticMarkup(<RoundSummary round={data.amendments[0]!.round} />);
  expect(unsure).toContain('Participation denominator: 3'); expect(unsure).toContain('Decisive denominator: 0');
  expect(unsure).toContain('consensus are not established');
  expect(counts({ ...data.round!, support: -1 })).toBeNull();
  expect(counts({ ...data.round!, support: Number.NaN })).toBeNull();
  expect(counts(data.round!)!.total).toBe(0);
});
test('redlines preserve all text safely and give non-color labels', () => {
  const html = renderToStaticMarkup(<TextRedline before={'<script>bad()</script>\nlast'} after={'<img src=x onerror=bad()>\nfinal'} />);
  expect(html).not.toContain('<script>'); expect(html).not.toContain('<img');
  expect(html).toContain('Removed text'); expect(html).toContain('Added text');
  expect(html).toContain('last'); expect(html).toContain('final');
  expect(renderToStaticMarkup(<TextRedline before="same" after="same" />)).toContain('No textual change');
});
test('loading is accessible and does not disclose unverified source', () => {
  const html = renderToStaticMarkup(<HeliosWorkbench selection={selection} adapter={{ load: async () => fixture(), submit: async () => ({ receipt: 'x' }) }} />);
  expect(html).toContain('role="status"'); expect(html).toContain('Verifying full source');
  expect(html).not.toContain('Publish objection');
});
test('isolated DOM walkthrough: consent, retry, revision reset and privacy', async () => {
  const child = Bun.spawn([process.execPath, 'src/client/helios-workbench/walkthrough.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr, stdout }).toEqual({ code: 0, stderr: '', stdout: 'PASS workbench walkthrough\n' });
});

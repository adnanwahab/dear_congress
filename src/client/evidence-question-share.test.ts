import { expect, test } from 'bun:test';
import { citationLinks, evidenceQuestionShare, sharedQuestion } from './evidence-question-share';

test('question share allowlists proposal identity and citations, excluding response and private fields', () => {
  const proposal = { id: 'citizen/one', title: 'Night buses', supportingInfo: 'Report https://example.org/report. Unsafe https://user:pass@example.org/private javascript:alert(1)', ownVote: 'oppose', countTotal: 987654, comments: [{ text: 'PRIVATE_COMMENT' }], sourceEntryId: 'PRIVATE_JOURNAL' };
  const text = evidenceQuestionShare(proposal, 'What is the overnight operating cost?', 'https://civic.example/feed?tracking=bad');
  expect(text).toContain('Night buses');
  expect(text).toContain('https://example.org/report');
  expect(text).toContain('citizen proposal');
  for (const secret of ['oppose', '987654', 'PRIVATE_', 'user:pass', 'tracking=bad']) expect(text).not.toContain(secret);
  const url = new URL(text.split('Read the question and evidence: ')[1]!);
  expect(url.pathname).toBe('/proposals/citizen%2Fone');
  expect(url.hash).toBe('#evidence');
  expect(sharedQuestion(url.search)).toBe('What is the overnight operating cost?');
});

test('missing citations, malformed links and empty/oversized questions remain explicit', () => {
  expect(citationLinks('https://example.org/a https://example.org/a http://insecure.org https://user:pass@example.org')).toEqual(['https://example.org/a']);
  expect(evidenceQuestionShare({ id: 'p', title: 'Proposal' }, 'What is unknown?', 'https://example.org')).toContain('no safe HTTPS citation links supplied');
  for (const question of ['', ' ', 'x'.repeat(401)]) expect(() => evidenceQuestionShare({ id: 'p', title: 'P' }, question, 'https://example.org')).toThrow();
  expect(sharedQuestion('?evidenceQuestion=' + 'x'.repeat(401))).toHaveLength(400);
});

test('actual detail route opens evidence, previews question, handles denied clipboard without writes', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-evidence-question-share.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  expect({ out, err, code }).toMatchObject({ code: 0 });
});

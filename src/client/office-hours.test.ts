import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { OfficeHours } from './OfficeHours';
import { updateQueue, SAMPLE_EXPERT, type OfficeQueue } from './office-hours';
const source = { repository: 'adnanwahab/dear_congress' as const, kind: 'sample' as const, id: 'a', revision: 'draft v1' };
const empty = (): OfficeQueue => ({ source, questions: [] });
const apply = (q: OfficeQueue, action: Parameters<typeof updateQueue>[2]) => updateQueue(q, source, action, SAMPLE_EXPERT, '2026-11-14T12:01:00Z');
const ask = () => apply(empty(), { type: 'ask', text: 'What evidence is missing?', consent: true });
const answer = { type: 'answer' as const, id: 1, text: 'A baseline is needed.', citation: 'No evidence supplied; methodological opinion only.', reason: '' };
test('consent, moderation and verification gate answers without modifying the prior queue', () => {
  expect(() => apply(empty(), { type: 'ask', text: 'x', consent: false })).toThrow('consent');
  expect(() => apply(empty(), { type: 'ask', text: ' ', consent: true })).toThrow();
  const pending = ask(); expect(() => apply(pending, answer)).toThrow('approved');
  const approved = apply(pending, { type: 'moderate', id: 1, approve: true, reason: 'On topic' });
  expect(pending.questions[0]!.status).toBe('pending');
  expect(() => updateQueue(approved, source, answer, { ...SAMPLE_EXPERT, verification: 'unverified' })).toThrow('Verification');
  expect(() => updateQueue(approved, source, answer, { ...SAMPLE_EXPERT, conflicts: '' })).toThrow('Verification');
  expect(() => apply(apply(pending, { type: 'moderate', id: 1, approve: false, reason: 'Off topic' }), answer)).toThrow('approved');
  expect(() => apply(approved, { type: 'moderate', id: 1, approve: false, reason: 'Again' })).toThrow('already');
});
test('corrections append; withdrawal retains timestamped history and prevents revival', () => {
  const approved = apply(ask(), { type: 'moderate', id: 1, approve: true, reason: 'Relevant' });
  expect(() => apply(approved, { ...answer, type: 'correction', reason: 'fix' })).toThrow();
  const answered = apply(approved, answer);
  expect(() => apply(answered, answer)).toThrow('correction');
  const corrected = apply(answered, { ...answer, type: 'correction', text: 'Baseline and comparison needed.', reason: 'Incomplete answer' });
  const withdrawn = apply(corrected, { ...answer, type: 'withdrawal', reason: 'Outside expertise' });
  expect(withdrawn.questions[0]!.answers.map(a => a.kind)).toEqual(['answer','correction','withdrawal']);
  expect(answered.questions[0]!.answers).toHaveLength(1);
  expect(withdrawn.questions[0]!.answers.every(a => a.at === '2026-11-14T12:01:00Z')).toBe(true);
  expect(() => apply(withdrawn, { ...answer, type: 'correction', reason: 'revive' })).toThrow('withdrawn');
});
test('draft identity and revision mismatches fail closed', () => {
  for (const change of [{ id: 'b' }, { revision: 'draft v2' }, { kind: 'citizen' }]) {
    expect(() => updateQueue(ask(), { ...source, ...change } as typeof source, answer, SAMPLE_EXPERT)).toThrow('revision');
  }
  expect(() => apply(ask(), { ...answer, id: 999 })).toThrow('unavailable');
});
test('visible trust and consent notices exist before any interaction', () => {
  const html = renderToStaticMarkup(createElement(OfficeHours, { source }));
  for (const text of ['No real expert verified', 'Verification: simulated verified', 'Conflicts:', 'official decisions', 'No questions yet', 'Live office hours are unavailable', 'page memory', 'no publication or contact permission']) expect(html).toContain(text);
});
test('isolated DOM walkthrough', () => {
  const result = Bun.spawnSync([process.execPath, 'scripts/verify-office-hours-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode) throw new Error(new TextDecoder().decode(result.stderr));
  expect(new TextDecoder().decode(result.stdout)).toContain('PASS office hours');
});

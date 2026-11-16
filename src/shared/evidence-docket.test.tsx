import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Window } from 'happy-dom';
import { EvidenceDocket } from '../client/EvidenceDocket';
import { docketText, EVIDENCE_CASES, prepareChallenge } from './evidence-docket';

test('sourced, conflicting and missing cases retain source revisions and review limits in export', () => {
  expect(EVIDENCE_CASES.map(r => r.status)).toEqual(['correction accepted', 'conflicting evidence', 'source required']);
  const text = docketText(EVIDENCE_CASES);
  for (const r of EVIDENCE_CASES) {
    for (const value of [r.claim.id, r.claim.revision, r.claim.locator, r.claim.date, r.claim.limitations, r.correction, r.appeal]) expect(text).toContain(value);
  }
  expect(text).toContain('demonstration only');
  expect(text).toContain('Missing source');
});

test('draft validation pins exact claim and never modifies source or marks human acceptance', () => {
  const original = JSON.stringify(EVIDENCE_CASES);
  for (const evidence of ['', ' ', 'x'.repeat(4001)]) expect(() => prepareChallenge(EVIDENCE_CASES[0]!.claim, evidence, 'correction')).toThrow();
  expect(() => prepareChallenge(EVIDENCE_CASES[0]!.claim, 'source', '')).toThrow();
  const draft = prepareChallenge(EVIDENCE_CASES[0]!.claim, 'new source, version, date', 'correct interpretation');
  expect(draft.status).toBe('awaiting human review');
  expect(draft.history[0]!.humanReview).toBe('pending');
  expect(draft.claim).not.toBe(EVIDENCE_CASES[0]!.claim);
  expect(JSON.stringify(EVIDENCE_CASES)).toBe(original);
});

test('offline static rendering includes native labeled controls, limits, and print export', () => {
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = renderToStaticMarkup(<EvidenceDocket />);
  expect(document.querySelectorAll('article')).toHaveLength(3);
  for (const field of document.querySelectorAll('select, textarea')) expect(field.closest('label')).not.toBeNull();
  for (const field of document.querySelectorAll('textarea')) {
    expect(field.hasAttribute('required')).toBe(true);
    expect(field.getAttribute('maxlength')).toBe('4000');
  }
  expect(document.querySelector('[role=status]')).not.toBeNull();
  expect(document.querySelector('.docket-print')!.textContent).toBe(docketText(EVIDENCE_CASES));
  expect(document.body.textContent).toContain('remain readable offline');
  expect(document.body.textContent).toContain('Primary source');
  expect(document.body.textContent).toContain('No live moderation');
  window.happyDOM.abort();
});

test('local draft and download failure fallback work without a network service', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-evidence-docket.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
});

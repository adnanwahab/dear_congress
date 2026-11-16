import { expect, test } from 'bun:test';
import { PUBLIC_GUIDE } from './public-guide';
test('public guide makes workshop consent, permission, evidence and vote boundaries explicit', () => {
  for (const phrase of ['same-device workshop', 'research, cost, fairness and implementation', 'separate browser-local draft', 'different editor reviews', 'political votes and popularity do not count', 'not authenticated access control', 'Sources and reviews remain unverified', 'everyone’s consent before exporting', 'Nothing is remotely shared or published', 'No approved Spanish translation']) expect(PUBLIC_GUIDE).toContain(phrase);
});
test('sample links explain selection and non-destructive unavailable fallback', () => {
  expect(PUBLIC_GUIDE).toContain('keeps that proposal selected even when browsing filters exclude it');
  expect(PUBLIC_GUIDE).toContain('Unknown links offer a choice of samples without changing a vote');
  expect(PUBLIC_GUIDE).toContain('Opening a link never casts a vote');
});

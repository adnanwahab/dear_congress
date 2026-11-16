import { expect, test } from 'bun:test';
import { PUBLIC_GUIDE } from './public-guide';
test('public guide makes workshop consent, permission, evidence and vote boundaries explicit', () => {
  for (const phrase of ['same-device workshop', 'research, cost, fairness and implementation', 'separate browser-local draft', 'different editor reviews', 'political votes and popularity do not count', 'not authenticated access control', 'Sources and reviews remain unverified', 'everyone’s consent before exporting', 'Nothing is remotely shared or published', 'No approved Spanish translation']) expect(PUBLIC_GUIDE).toContain(phrase);
});

test("public guide explains private-data exclusion and copy recovery", () => {
  for (const phrase of ["links exclude your saved vote, personal journal text", "If copying is blocked", "does not verify delivery or participation"]) expect(PUBLIC_GUIDE).toContain(phrase);
});

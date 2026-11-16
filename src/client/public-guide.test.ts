import { expect, test } from 'bun:test';
import { PUBLIC_GUIDE } from './public-guide';
test('public guide makes workshop consent, permission, evidence and vote boundaries explicit', () => {
  for (const phrase of ['same-device workshop', 'research, cost, fairness and implementation', 'separate browser-local draft', 'different editor reviews', 'political votes and popularity do not count', 'not authenticated access control', 'Sources and reviews remain unverified', 'everyone’s consent before exporting', 'Nothing is remotely shared or published', 'No approved Spanish translation']) expect(PUBLIC_GUIDE).toContain(phrase);
});
test('public guide explains optional distribution expiry and measurement limits', () => {
  for (const phrase of ['asks permission', '30 minutes', 'Stop launch measurement', 'activity, not understanding']) expect(PUBLIC_GUIDE).toContain(phrase);
});

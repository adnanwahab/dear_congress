import { expect, test } from 'bun:test';
import { PUBLIC_GUIDE } from './public-guide';
test('public guide makes workshop consent, permission, evidence and vote boundaries explicit', () => {
  for (const phrase of ['same-device workshop', 'research, cost, fairness and implementation', 'separate browser-local draft', 'different editor reviews', 'political votes and popularity do not count', 'not authenticated access control', 'Sources and reviews remain unverified', 'everyone’s consent before exporting', 'Nothing is remotely shared or published', 'No approved Spanish translation']) expect(PUBLIC_GUIDE).toContain(phrase);
});
test('public guide explains optional discussion invitation and comprehension limits', () => {
  for (const phrase of ['Compare this proposal with someone', 'device share or copy', 'No contacts, automatic messages, stance rewards or referral tracking', 'Sharing does not establish comprehension or participation']) expect(PUBLIC_GUIDE).toContain(phrase);
});

import { expect, test } from 'bun:test';
import { discussionInvitation } from './DiscussionInvitation';
test('invitation only accepts curated sample identity', () => {
  expect(() => discussionInvitation('private-journal', 'https://example.test')).toThrow('Sample unavailable');
});
test('invitation consent, transport, cancellation, fallback and selection isolation', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-discussion-invitation.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('Invitation interactions passed');
});

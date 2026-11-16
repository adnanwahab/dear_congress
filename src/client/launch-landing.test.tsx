import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { isLaunchLanding, LaunchLanding, LAUNCH_LINK } from './LaunchLanding';

test('launch mode accepts only one exact public audience value on home', () => {
  expect(isLaunchLanding('/', '?audience=launch')).toBe(true);
  expect(isLaunchLanding('/', '?audience=launch&demo=1&email=private&next=https://evil.example')).toBe(true);
  for (const search of ['', '?audience=journalist', '?audience=Launch', '?audience=launch&audience=launch', '?audience=%3Cscript%3E']) {
    expect(isLaunchLanding('/', search)).toBe(false);
  }
  expect(isLaunchLanding('/votes', '?audience=launch')).toBe(false);
});

test('overview keeps methodology, limitations, fixed tour and clean share link ahead of interaction', () => {
  const html = renderToStaticMarkup(<LaunchLanding />);
  for (const copy of ['30-second explanation', 'independently operated, non-binding beta', 'response counts are illustrative', 'no governmental authority', 'not verify identity', 'missing, stale or conflicting', 'Sharing alone does not demonstrate meaningful participation']) expect(html).toContain(copy);
  expect(html.indexOf('Inspect source methodology')).toBeLessThan(html.indexOf('A short product tour'));
  expect(html).toContain(`href="${LAUNCH_LINK}"`);
  expect(html).toContain('href="/documentation#provenance-explorer"');
  for (const stage of ['published', 'draft', 'outcomes']) expect(html).toContain(`href="/${stage}?proposal=demo-transit"`);
  expect(html).not.toContain('<form');
});

import { expect, test } from 'bun:test';
import { decisionCard, SHARE_NOTICE } from './advisory-share';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdvisoryShare } from './AdvisoryShare';
import { RESPONSIBLE_SHARING } from './responsible-sharing';
import { PUBLIC_GUIDE } from './public-guide';

test('exports only public sample content, version and source limitations; stance is opt-in', async () => {
  const card = await decisionCard('demo-housing');
  expect(card.text).toContain(SHARE_NOTICE);
  expect(card.svg).toContain(SHARE_NOTICE);
  expect(card.svg).toContain('<desc');
  expect(card.text).toContain('Source not available / not checked');
  expect(card.text).toContain('Background only');
  expect(card.version).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(card.text).not.toContain('chosen stance');
  expect(card.text).not.toContain('1284');
  for (const [stance, name] of [[1, 'Support'], [-1, 'Oppose'], [0, 'Not sure']] as const) {
    const chosen = await decisionCard('demo-housing', stance);
    expect(chosen.version).toBe(card.version);
    expect(chosen.text).toContain(`Optional chosen stance: ${name}`);
    expect(chosen.text).toContain('not proof of a saved vote');
  }
  expect((await decisionCard('demo-transit')).version).not.toBe(card.version);
  expect((await decisionCard('demo-housing', 99)).text).not.toContain('chosen stance');
  await expect(decisionCard('private-journal')).rejects.toThrow('unavailable');
});

test('no export or stance on initial render', () => {
  const html = renderToStaticMarkup(<AdvisoryShare id="demo-housing" choice={1} />);
  expect(html).toContain('aria-expanded="false"');
  expect(html).not.toContain('download=');
  expect(html).not.toContain('Support');
});

test('share interaction regression', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-advisory-share.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({code, stderr}).toEqual({code: 0, stderr: ''});
  expect(stdout).toContain('Share preview passed');
});

test('responsible sharing is optional, concise and consistent with the linked guide', () => {
  expect(RESPONSIBLE_SHARING.split(/\s+/).length).toBeLessThan(120);
  for (const phrase of ['independently operated', 'Advisory', 'not official', 'synthetic', 'not verified', 'original source, date, exact version', 'Do not claim endorsement', 'keep reading without sharing']) expect(RESPONSIBLE_SHARING).toContain(phrase);
  const html = renderToStaticMarkup(<AdvisoryShare id="demo-housing" />);
  expect(html).toContain('<summary>How to share responsibly</summary>');
  expect(html).toContain(RESPONSIBLE_SHARING);
  expect(html).toContain('href="/documentation#how-to-share-responsibly"');
  expect(html).not.toContain('<details class="responsible-sharing" open');
  expect(html).not.toContain('disabled');
  expect(PUBLIC_GUIDE).toContain('## How to share responsibly');
  expect(PUBLIC_GUIDE).toContain(RESPONSIBLE_SHARING);
});

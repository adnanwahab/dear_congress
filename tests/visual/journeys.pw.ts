import { test, expect, sample, proposal, activate, capture } from './fixtures';
import { CIVIC_STAGES, STAGES } from '../../src/shared/civic-stages';

// Six source-preserving stage journeys plus four motion/state journeys below.
for (const stage of CIVIC_STAGES) test(`stage ribbon: ${stage.title}`, async ({ page }, info) => {
  await page.goto(`${stage.route}?proposal=${proposal.id}&motion=normal`);
  await expect(page.locator('main h1')).toHaveText(stage.title);
  await expect(page.locator('.demo-context')).toContainText('Demo activity date');
  await expect(page.locator('.demo-context')).toContainText('Fictional proposals');
  await capture(page, info, 'before', page.locator('.workflow-heading'));
  const next = page.locator('.workflow-next');
  await expect(next).toHaveAttribute('href', new RegExp(`proposal=${proposal.id}`));
  await activate(page, next, info);
  await expect(page).toHaveURL(url => url.pathname === `/${stage.next}` && url.searchParams.get('proposal') === proposal.id);
  await expect(page.locator('main h1')).toHaveText(STAGES[stage.next].title);
  await capture(page, info, 'after', page.locator('.workflow-heading'));
  await page.goBack();
  await expect(page).toHaveURL(url => url.pathname === stage.route && url.searchParams.get('proposal') === proposal.id);
});

test('redline playback retains text and settles', async ({ page }, info) => {
  await page.goto(`/draft?proposal=${proposal.id}&motion=normal`);
  const patch = page.locator('.patch-change');
  await expect(patch.locator('.patch-final').last()).toContainText(proposal.proposedText);
  await capture(page, info, 'redline-before', patch);
  await page.clock.install({ time: new Date('2026-11-13T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-13T12:00:01Z'));
  await activate(page, page.getByRole('button', { name: 'Play the change' }), info);
  const reduced = info.project.use.reducedMotion === 'reduce';
  if (reduced) {
    await expect(patch.locator('.is-playing')).toHaveCount(0);
    await expect(patch.locator('.patch-visual')).toHaveCount(0);
  } else {
    await expect(patch.locator('.is-playing')).toHaveCount(1);
    // Pin the actual CSS animation timeline rather than sleeping for a lucky frame.
    await patch.evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => { animation.pause(); animation.currentTime = 900; }));
    await info.attach('redline-midpoint.png', { body: await patch.screenshot({ animations: 'allow' }), contentType: 'image/png' });
    await expect.soft(patch).toHaveScreenshot('redline-midpoint.png', { animations: 'allow', maxDiffPixels: 0 });
    await page.clock.runFor(2601);
    await expect(patch.locator('.is-playing')).toHaveCount(0);
  }
  await expect(patch.locator('.patch-final').last()).toContainText(proposal.proposedText);
  await capture(page, info, 'redline-after', patch);
});

test('map local revision and zoom preserve synthetic identity', async ({ page }, info) => {
  await page.goto('/map?motion=normal');
  const map = page.locator('.county-svg');
  await expect(map).toHaveAttribute('aria-label', /plan revision 1/);
  await activate(page, page.getByRole('button', { name: 'Zoom in', exact: true }), info);
  await expect(map).toHaveAttribute('style', /150%/);
  await activate(page, page.getByRole('button', { name: 'Improve one revision', exact: true }), info);
  await expect(map).toHaveAttribute('aria-label', /plan revision 2/);
  if (info.project.use.reducedMotion === 'reduce') {
    expect(await page.locator('.county-shape').first().evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  }
  await capture(page, info, 'map-revision', page.locator('.county-atlas'));
  await activate(page, page.getByRole('button', { name: 'Restart', exact: true }), info);
  await expect(map).toHaveAttribute('aria-label', /plan revision 1/);
});

test('loading, error, retry and empty fixtures', async ({ page }, info) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/demo', async route => { await gate; await route.fulfill({ status: 503, json: { error: 'Fixture unavailable' } }); });
  await page.goto('/draft?motion=normal');
  await expect(page.getByRole('region', { name: 'Proposal context' })).toHaveAttribute('aria-busy', 'true');
  await capture(page, info, 'loading', page.getByRole('region', { name: 'Proposal context' }));
  release();
  await expect(page.getByRole('alert')).toContainText('Could not load sample proposals');
  await capture(page, info, 'error', page.getByRole('alert'));
  await page.route('**/api/demo', route => route.fulfill({ json: { ...sample, items: [], browserCounts: {} } }));
  await activate(page, page.getByRole('button', { name: 'Retry loading proposals' }), info);
  await expect(page.getByRole('heading', { name: 'No sample proposals available' })).toBeVisible();
  await capture(page, info, 'empty', page.getByRole('region', { name: 'Proposal context' }));
});

test('proposal selection uses typed motion and world handoff stays external', async ({ page }, info) => {
  await page.goto(`/draft?proposal=${proposal.id}&motion=normal`);
  await expect(page.locator('.patch-change')).toBeVisible();
  await page.getByLabel('Proposal', { exact: true }).selectOption(sample.items[1]!.id);
  await expect(page).toHaveURL(new RegExp(`proposal=${sample.items[1]!.id}`));
  await expect(page.locator('.patch-final').last()).toContainText(sample.items[1]!.proposedText);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.motionType ?? '')).toBe('');
  await capture(page, info, 'selected-proposal', page.locator('.patch-change'));
  const world = page.getByRole('link', { name: 'HBL — HappyBearLandia (opens in a new tab)' });
  await expect(world).toHaveAttribute('href', 'https://happybearlandia.fly.dev/world');
  await expect(world).toHaveAttribute('rel', 'noopener noreferrer');
  // Never navigate to or simulate ownership of the other repository's renderer.
});

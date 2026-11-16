import { expect, test } from '@playwright/test';

// Run against disposable local data only. The journey never submits participation.
test('home choice stays bound to the displayed proposal through completion and Back', async ({ page }) => {
  const writes: string[] = [];
  await page.route('**/*', route => {
    if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
    writes.push(route.request().url());
    return route.abort();
  });
  await page.goto('/votes?proposal=demo-transit');
  await expect(page.getByRole('combobox', { name: 'Proposal', exact: true })).toHaveValue('demo-transit');
  await page.goto('/');
  const start = page.getByRole('region', { name: 'Where would you like to start?' });
  const explore = start.getByRole('link', { name: 'Explore a proposal & advisory vote' });
  await expect(explore).toHaveAttribute('href', /\/votes\?proposal=.+/);
  const href = (await explore.getAttribute('href'))!;
  const id = new URL(href, page.url()).searchParams.get('proposal')!;
  await explore.click();
  await expect(page.getByRole('combobox', { name: 'Proposal', exact: true })).toHaveValue(id);
  await expect(page.getByRole('heading', { name: 'Unverified browser votes — advisory', exact: true })).toBeVisible();
  for (const [label, path] of [['Draft', '/draft'], ['Sponsors', '/sponsors'], ['Outcomes', '/outcomes']]) {
    await page.getByRole('link', { name: `Next: ${label} →`, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}\\?proposal=${id}$`));
    await expect(page.locator('main h1')).toHaveText(label!);
  }
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/sponsors\\?proposal=${id}$`));
  await page.goto('/feed');
  const search = page.getByRole('searchbox', { name: 'Search sample proposals' });
  await search.fill('housing');
  const next = page.getByRole('link', { name: 'Next: Votes →', exact: true });
  await next.click();
  await expect(page.locator('main h1')).toHaveText('Votes');
  await page.goBack();
  await expect(search).toHaveValue('housing');
  await page.goto('/');
  await start.getByRole('link', { name: 'Tell us what needs fixing' }).click();
  await expect(page.locator('main h1')).toHaveText('A journal that connects to change.');
  const api = page.getByRole('tab', { name: 'Connect your app · API docs', exact: true });
  await api.click();
  await expect(page.locator('#journal-api')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('tab', { name: 'Write & explore', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('link', { name: 'Propose a change · private guided draft', exact: true }).click();
  await expect(page).toHaveURL(/\/proposals\/new\?guided=1$/);
  await expect(page.locator('main h1')).toBeVisible();
  expect(writes).toEqual([]);
});

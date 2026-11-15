import { expect, test } from '@playwright/test';

test('native back/forward restores an empty filtered journey without civic writes', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
  await page.goto('/feed');
  const search = page.getByRole('searchbox', { name: 'Search sample proposals' });
  await search.fill('no-matching-proposal-391');
  await expect(page.getByText('No proposals match your search and topic. Try a broader term or reset filters.')).toBeVisible();
  const next = page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('link', { name: 'Votes', exact: true });
  await next.focus();
  await next.press('Enter');
  await expect(page).toHaveURL(/\/votes/);
  await page.goBack();
  await expect(search).toHaveValue('no-matching-proposal-391');
  await expect(next).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/votes/);
  await expect(page.getByRole('heading', { name: 'Votes', exact: true })).toBeVisible();
  await expect(page.getByText('Add your voice to a proposal.', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

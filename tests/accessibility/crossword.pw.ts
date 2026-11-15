import { test, expect } from '@playwright/test';

test('crossword keyboard-only full playthrough', async ({ page }) => {
  await page.goto('/bills');
  const launch = page.getByRole('button', { name: 'Play Civic Chronicle crossword' });
  for (let i=0; i<40 && !await launch.evaluate(el => el === document.activeElement); i++) await page.keyboard.press('Tab');
  await expect(launch).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('S');
  for (const letter of 'ENATE') { await page.keyboard.press('ArrowRight'); await page.keyboard.type(letter); }
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown'); await page.keyboard.type('C');
  await page.keyboard.press('ArrowDown'); await page.keyboard.type('T');
  await page.keyboard.press('ArrowRight'); await page.keyboard.type('A');
  await page.keyboard.press('ArrowRight'); await page.keyboard.type('X');
  await expect(page.getByRole('status')).toContainText('Puzzle complete');
  await page.keyboard.press('Escape');
  await expect(launch).toBeFocused();
});

test('crossword touch playthrough offline, explanations and reset', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ hasTouch:true, viewport:{width:390,height:844} });
  const page = await context.newPage();
  let writes = 0;
  page.on('request', r => { if (r.method() !== 'GET') writes++; });
  await page.goto(`${baseURL}/bills`);
  await page.getByRole('button', { name:'Play Civic Chronicle crossword' }).tap();
  await context.setOffline(true);
  for (const id of ['1-across','2-down','3-across']) {
    const count = id === '1-across' ? 6 : id === '2-down' ? 2 : 2;
    for(let i=0;i<count;i++) await page.getByRole('button',{name:`Hint ${id}`,exact:true}).tap();
  }
  await expect(page.getByRole('status')).toContainText('Puzzle complete');
  await page.getByText('Complete-text explanation and answers', {exact:true}).tap();
  await expect(page.getByRole('heading',{name:'1-across: SENATE'})).toBeVisible();
  await page.getByRole('button',{name:'Restart',exact:true}).tap();
  await expect(page.getByLabel('Row 1, column 1',{exact:true})).toHaveValue('');
  await page.getByRole('button',{name:'Skip',exact:true}).tap();
  await expect(page.getByRole('button',{name:'Play Civic Chronicle crossword'})).toBeFocused();
  expect(writes).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});

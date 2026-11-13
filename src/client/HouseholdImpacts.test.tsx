import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { HouseholdImpacts } from './HouseholdImpacts';

test('initial total view discloses missing models without inventing impacts or samples', () => {
  const html = renderToStaticMarkup(<HouseholdImpacts />);
  for (const metric of ['Rent', 'Travel time', 'Flooding', 'Taxes', 'Services']) expect(html).toContain(`scope="row">${metric}`);
  expect(html.match(/<td>Unavailable<\/td>/g)).toHaveLength(5);
  expect(html).toContain('no runs were performed');
  expect(html).toContain('not a forecast or official advice');
  expect(html).toContain('aria-describedby=');
  expect(html).toContain('role="status"');
  expect(html).not.toContain('<a ');
});

test('household interaction stays voluntary, resettable and private', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-household-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS opt-in');
});

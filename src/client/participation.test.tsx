import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import AccountScreen from './AccountScreen';
import { ParticipationNotice } from './ParticipationNotice';
import { renderPage } from '../server/pages';

test('account route explains all tracks without collecting identity or implying ballot secrecy', async () => {
  const html = renderToStaticMarkup(<AccountScreen />);
  for (const label of ['Verified eligible participants — advisory', 'Unverified browser votes — advisory', 'Synthetic demo data — illustrative', 'Not available.', 'Continue anonymously', 'stored with a browser identifier']) expect(html).toContain(label);
  expect(html).toContain('href="/votes"');
  expect(html).toContain('href="/privacy"');
  expect(html).not.toContain('<input');
  expect(html).toContain('Your private civic journey');
  expect(html).toContain('not evidence of verified civic eligibility');
  expect(html).not.toContain('type="file"');
  expect(html).not.toContain('type="password"');
  expect(renderToStaticMarkup(<ParticipationNotice />)).toContain('No verified participant count is reported');
  const response = renderPage('<title>App</title><div id="root"></div>', '/account', []);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('Participation &amp; privacy');
});

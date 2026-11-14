import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Window } from 'happy-dom';
import Documentation from './Documentation';
import { renderPage } from '../server/pages';

test('Documentation replaces only the three-app embed with an accessible linked loop', () => {
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = renderToStaticMarkup(<Documentation />);
  const diagram = document.querySelector('.three-app-loop svg')!;
  expect(diagram).not.toBeNull();
  expect(diagram.getAttribute('role')).toBe('group');
  const description = document.getElementById(diagram.getAttribute('aria-describedby')!)!;
  expect(description.textContent).toContain('The diff comes back to Civic Synthesis');
  const links = Array.from(diagram.querySelectorAll('a'));
  expect(links.map(link => link.getAttribute('href'))).toEqual([
    'https://digital-pensieve.fly.dev/', '/', 'https://happybearlandia.fly.dev/world',
  ]);
  for (const link of [links[0]!, links[2]!]) {
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('aria-label')).toContain('opens in a new tab');
    expect(link.textContent).toContain('opens in a new tab');
  }
  const placeholders = document.querySelectorAll('.document-embed');
  expect(placeholders.length).toBe(1);
  expect(placeholders[0]!.textContent).toContain('[embed: node/51ba441f-40e5]');
  expect(document.querySelectorAll('details h3').length).toBe(6);
  window.happyDOM.abort();
});


test('public guide explains trust limits and keeps historical planning collapsed', async () => {
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = renderToStaticMarkup(<Documentation />);
  const appendix = document.querySelector('details')!;
  expect(appendix.hasAttribute('open')).toBe(false);
  expect(appendix.querySelector('summary')!.textContent).toContain('November 12, 2026');
  appendix.innerHTML = '<summary>Historical appendix</summary>';
  const guide = document.querySelector('article')!;
  for (const text of ['not a government service', 'Will my journal be public?', 'Does my vote count?', 'What happens next?', 'no guaranteed deletion schedule', 'Human-reviewed Spanish']) expect(guide.textContent).toContain(text);
  for (const text of ['50 days', 'Jan 1', '9:00 AM', 'electorate is undefined']) expect(guide.textContent).not.toContain(text);
  for (const link of Array.from(document.querySelectorAll('a[href^="#"]'))) expect(document.getElementById(link.getAttribute('href')!.slice(1))).not.toBeNull();
  for (const link of Array.from(guide.querySelectorAll('a[href^="/"]'))) {
    const path = new URL(link.getAttribute('href')!, 'https://civic-synthesis.fly.dev').pathname;
    if (['/version', '/healthz'].includes(path)) continue; // Dedicated HTTP handlers, outside renderPage.
    expect(renderPage('<title>Test</title><div id="root"></div>', path, []).status).toBe(200);
  }
  const missing = renderPage('<title>Test</title><div id="root"></div>', '/missing-guide-page', []);
  expect(missing.status).toBe(404);
  expect(await missing.text()).toContain('Page not found');
  window.happyDOM.abort();
});

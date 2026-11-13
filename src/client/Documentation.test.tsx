import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Window } from 'happy-dom';
import Documentation from './Documentation';

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
  expect(document.querySelectorAll('.documentation-article h3').length).toBe(6);
  window.happyDOM.abort();
});

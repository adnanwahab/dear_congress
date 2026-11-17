import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { installDirection, setDirection } from './motion';
import { swipeDestination } from './stage-swipe';
import { ProposalProvenance } from './ProposalProvenance';
import { DEMO_ITEMS } from '../engine/demo';

const fixtures = [
  { text: 'السكن H.R. 123 § 4 (2026)', direction: 'rtl' },
  { text: 'דיור 42 U.S.C. § 1983', direction: 'rtl' },
  { text: 'Housing § 4 (2026)', direction: 'ltr' },
] as const;
for (const fixture of fixtures) test(`layout and source isolation: ${fixture.text}`, async () => {
  const win = new Window({ url: `https://example.test/account?layout=${fixture.direction}` });
  const target = win as unknown as globalThis.Window;
  installDirection(target);
  expect(win.document.documentElement.dir).toBe(fixture.direction);
  expect(win.document.documentElement.lang).toBe(''); // no translation claim
  win.happyDOM.setURL('https://example.test/votes');
  installDirection(target);
  expect(win.document.documentElement.dir).toBe(fixture.direction);
  const item = { ...DEMO_ITEMS[0]!, jurisdiction: fixture.text };
  const html = renderToStaticMarkup(<ProposalProvenance item={item} />);
  expect(html).toContain(`<bdi dir="auto">${fixture.text}</bdi>`);
  expect(html).toContain(item.sourceUrl.replaceAll('&', '&amp;'));
  expect(item.jurisdiction).toBe(fixture.text);
  setDirection(target, 'ltr');
  expect(win.document.documentElement.dir).toBe('ltr');
  await win.happyDOM.close();
});
test('blocked storage retains explicit RTL and allows page-only fallback', async () => {
  const win = new Window({ url: 'https://example.test/?layout=rtl' });
  Object.defineProperty(win, 'sessionStorage', { get() { throw Error('blocked'); } });
  const target = win as unknown as globalThis.Window;
  installDirection(target);
  expect(win.document.documentElement.dir).toBe('rtl');
  setDirection(target, 'ltr');
  expect(win.document.documentElement.dir).toBe('ltr');
  await win.happyDOM.close();
});
test('RTL touch direction mirrors stage travel with the same proposal binding', () => {
  expect(swipeDestination('/votes', 100, 0, 'proposal-123', 'rtl')).toBe(swipeDestination('/votes', -100, 0, 'proposal-123', 'ltr'));
  expect(swipeDestination('/votes', -100, 0, 'proposal-123', 'rtl')).toBe(swipeDestination('/votes', 100, 0, 'proposal-123', 'ltr'));
  expect(swipeDestination('/votes', 10, 100, null, 'rtl')).toBeNull();
});

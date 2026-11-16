import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEMO_ITEMS } from '../engine/demo';
import { PolicyActions } from './PolicyActions';

test('every sample has neutral external official channels without completion authority', () => {
  for (const item of DEMO_ITEMS) {
    const html = renderToStaticMarkup(<PolicyActions item={item} />);
    expect(html).toContain(`data-proposal-id="${item.id}"`);
    expect(html).toContain('Read an agenda');
    expect(html).toContain('Explore attending a hearing');
    expect(html).toContain('Find an office to contact');
    expect(html.match(/target="_blank" rel="noopener noreferrer"/g)?.length).toBe(3);
    expect(html).toContain('External site, opens in new tab');
    expect(html).toContain('not verified civic participation');
    expect(html).toContain('does not record contact, attendance, or completion');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('action=');
  }
});
test('unknown jurisdiction fails closed without trusting a source URL or guessing a location', () => {
  const html = renderToStaticMarkup(<PolicyActions item={{id:'unknown', title:'Unknown <policy>', jurisdiction:'Elsewhere'}} />);
  expect(html).toContain('Official action channels unavailable');
  expect(html).not.toContain('href=');
  expect(html).toContain('Unknown &lt;policy&gt;');
});

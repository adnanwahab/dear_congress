import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Window } from 'happy-dom';
import { GovernancePrism } from './GovernancePrism';
import { DEMO_ITEMS } from '../engine/demo';
import { readFileSync } from 'node:fs';

test('empty selection, stale sources and unsupported lenses are explicit', () => {
  const previous = globalThis.window;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new Window({ url: 'http://localhost/?lens=0' }) });
  try {
    expect(renderToStaticMarkup(<GovernancePrism />)).toContain('No proposal selected');
    const sample = { ...DEMO_ITEMS[0]!, background: { ...DEMO_ITEMS[0]!.background!, checkedAt: '2020-01-01' } };
    for (let lens = 0; lens < 4; lens++) {
      window.history.replaceState(null, '', `/?proposal=${sample.id}&topic=housing&lens=${lens}&prism=static`);
      const html = renderToStaticMarkup(<GovernancePrism sample={sample} />);
      expect(html).toContain('Missing data.');
      expect(html).toContain('Source not available / not checked');
      expect(html).toContain(sample.sourceUrl);
      expect(html).toContain('data-static="true"');
      if (lens === 1 || lens === 3) expect(html).toContain('Hypothetical draft context, not evidence');
    }
  } finally { Object.defineProperty(globalThis, 'window', { configurable: true, value: previous }); }
});

test('reduced motion and low power remove rotation without hiding controls or panels', () => {
  const css = readFileSync(new URL('./governance-prism.css', import.meta.url), 'utf8');
  expect(css).toContain('@media(prefers-reduced-motion:reduce){.prism-shape{transition:none;transform:none!important}}');
  expect(css).toContain('[data-static=true] .prism-shape{display:none}');
});

import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Dashboard } from './Dashboard';
import WorkflowScreen from './WorkflowScreen';
import { BottomNavigation } from './Navigation';
import { CIVIC_STAGES } from '../shared/civic-stages';

test('home, navigation and stage headings use the same six labels before API loads', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { pathname: '/draft', search: '?proposal=sample%26one' } } });
  const request = async <T,>(): Promise<T> => { throw new Error('offline'); };
  try {
    const home = renderToStaticMarkup(<Dashboard request={request} />);
    const nav = renderToStaticMarkup(<BottomNavigation />);
    expect(home).toContain('Read a proposal &amp; vote');
    expect(home).toContain("Today&#x27;s question");
    expect(home).toContain('it is not an official government ballot.');
    expect(renderToStaticMarkup(<WorkflowScreen stage="votes" request={request} />)).toContain("Today&#x27;s question");
    expect(nav).toContain('href="/draft?proposal=sample%26one" aria-current="page"');
    for (const s of CIVIC_STAGES) {
      expect(home).toContain(`>${s.title}</a>`);
      expect(nav).toContain(`<span>${s.title}</span>`);
      const html = renderToStaticMarkup(<WorkflowScreen stage={s.route.slice(1) as any} request={request} />);
      expect(html).toContain(`<h1>${s.title}</h1>`);
      expect(html).toContain('Next: ');
      expect(html).toContain(`href="/${s.next}?proposal=sample%26one"`);
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

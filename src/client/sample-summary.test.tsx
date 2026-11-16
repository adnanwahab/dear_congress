import { test, expect } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEMO_ITEMS } from '../engine/demo';
import { SampleSummary } from './SampleSummary';

test('all twelve samples expose a short explanation, caveat and native details with original draft text', () => {
  expect(DEMO_ITEMS).toHaveLength(12);
  for (const item of DEMO_ITEMS) {
    expect(item.summary.match(/[.!?](?:\s|$)/g)).toHaveLength(2);
    expect(item.keyCaveat?.length).toBeGreaterThan(20);
    const html = renderToStaticMarkup(<SampleSummary item={item} />);
    expect(html).toContain('<details><summary>Full details:');
    expect(html).toContain(item.currentText);
    expect(html).toContain(item.proposedText);
    expect(html).toContain('Your advisory vote does not change the law');
    expect(html).toContain('not measurements or forecasts');
  }
});

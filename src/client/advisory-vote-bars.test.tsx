import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdvisoryVoteBars, FictionalResponseGraphic } from './AdvisoryVoteBars';
import { DEMO_ITEMS } from '../engine/demo';

for (const counts of [[60, 30, 10], [0, 0, 0], [1, 1, 1], [12345, 0, 0]]) {
  test(`advisory bars expose authoritative count and percentage: ${counts}`, () => {
    const [support, oppose, unsure] = counts as [number, number, number];
    const item = { ...DEMO_ITEMS[0]!, support, oppose, unsure };
    const html = renderToStaticMarkup(<AdvisoryVoteBars item={item} browserCounts={{support, oppose, unsure}} choice={-1} busy={false} confirmation={0} onVote={() => { throw Error('render must not vote'); }} />);
    const total = support + oppose + unsure;
    for (const n of counts) expect(html).toContain(`${n.toLocaleString()} browser choices, ${(total ? n / total * 100 : 0).toFixed(1)}%`);
    expect(html).toContain('Unverified browser choices');
    expect(html).toContain('Oppose, selected');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('vote-confirmed');
  });
}

test('fictional graphics have no vote controls and cannot enter browser tallies', () => {
  const item = DEMO_ITEMS[0]!;
  const props = { item, busy: false, confirmation: 0, onVote: () => { throw Error('unexpected vote'); } };
  const graphic = renderToStaticMarkup(<FictionalResponseGraphic item={item} />);
  expect(graphic).toContain('Fictional sample responses');
  expect(graphic).toContain('aria-describedby=');
  expect(graphic).not.toContain('<button');
  const browser = renderToStaticMarkup(<AdvisoryVoteBars {...props} browserCounts={{support: 2, oppose: 1, unsure: 0}} />);
  expect(browser).toContain('2 browser choices, 66.7%');
  expect(browser).not.toContain(`${item.support.toLocaleString()} browser choices`);
  const unavailable = renderToStaticMarkup(<AdvisoryVoteBars {...props} />);
  expect(unavailable).toContain('browser counts unavailable');
  expect(unavailable).not.toContain('0 browser choices');
  const live = renderToStaticMarkup(<AdvisoryVoteBars {...props} live />);
  expect(live).toContain(`${item.support.toLocaleString()} responses`);
});

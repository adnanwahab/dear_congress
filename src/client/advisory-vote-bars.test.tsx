import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdvisoryVoteBars } from './AdvisoryVoteBars';
import { DEMO_ITEMS } from '../engine/demo';

for (const counts of [[60, 30, 10], [0, 0, 0], [1, 1, 1], [12345, 0, 0]]) {
  test(`advisory bars expose authoritative count and percentage: ${counts}`, () => {
    const [support, oppose, unsure] = counts as [number, number, number];
    const item = { ...DEMO_ITEMS[0]!, support, oppose, unsure };
    const html = renderToStaticMarkup(<AdvisoryVoteBars item={item} choice={-1} busy={false} confirmation={0} onVote={() => { throw Error('render must not vote'); }} />);
    const total = support + oppose + unsure;
    for (const n of counts) expect(html).toContain(`${n.toLocaleString()} responses, ${(total ? n / total * 100 : 0).toFixed(1)}%`);
    expect(html).toContain('Illustrative responses, not a representative poll.');
    expect(html).toContain('Oppose, selected');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('vote-confirmed');
  });
}

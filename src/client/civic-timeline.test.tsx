import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CivicTimeline, orderMilestones, type CivicMilestone } from './CivicTimeline';

test('chronology uses source dates; invalid, unknown and fictional steps cannot become real anchors', () => {
  const points: CivicMilestone[] = [
    { id: 'delivery', label: 'Delivered', timestamp: '2026-11-14T02:00:00Z', evidence: 'recorded' },
    { id: 'unknown', label: 'Unknown', timestamp: 'bad date', evidence: 'recorded' },
    { id: 'fiction', label: 'Sample', timestamp: '2000-01-01', evidence: 'fictional' },
    { id: 'published', label: 'Published', timestamp: '2026-11-13T02:00:00Z', evidence: 'recorded' },
  ];
  expect(orderMilestones(points).map(p => p.id)).toEqual(['published', 'delivery', 'unknown', 'fiction']);
  const html = renderToStaticMarkup(<CivicTimeline points={points} />);
  expect(html.match(/<time /g)?.length).toBe(2);
  expect(html).toContain('Unknown · no recorded evidence');
  expect(html).toContain('Fictional sample');
  expect(html).toContain('--milestone-position:100%');
  expect(points[0]?.id).toBe('delivery');
});

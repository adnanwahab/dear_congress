import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import MapScreen from './MapScreen';
import { ActualTimeChart } from './LawBehaviorExplorer';
import { NeedsGeoMap } from './App';

test('all county states have distinct pattern definitions and textual keys before evaluation', () => {
  const html = renderToStaticMarkup(<MapScreen />);
  for (const status of ['agree', 'review', 'object', 'unevaluated']) {
    expect(html).toContain(`id="county-${status}"`);
    expect(html).toContain(`fill="url(#county-${status})"`);
  }
  expect(html).toContain('○ Solid');
  expect(html).toContain('△ Diagonal');
  expect(html).toContain('□ Crosshatch');
  expect(html).toContain('◇ Dots');
  expect(html.match(/class="county-shape"/g)).toHaveLength(3144);
  expect(html).toContain('Use the searchable county list');
});

test('time chart keeps every exact paired value and units in text with circle/square marks', () => {
  const frames = [0, 15, 30].map((time, i) => ({ time,
    baseline: { metrics: { meanCommuteMinutes: 17.12345 + i }, actors: [] },
    edited: { metrics: { meanCommuteMinutes: 12.54321 - i }, actors: [] },
  }));
  const before = JSON.stringify(frames);
  for (const index of [0, 1, 2]) {
    const html = renderToStaticMarkup(<ActualTimeChart frames={frames} metric="meanCommuteMinutes" index={index} />);
    expect(html).toContain('○ Solid line: World A');
    expect(html).toContain('□ Dashed line: World B');
    expect(html).toContain('minutes/trip');
    for (const f of frames) {
      expect(html).toContain(`<th scope="row">${f.time}</th>`);
      expect(html).toContain(`<td>${f.baseline.metrics.meanCommuteMinutes}</td>`);
      expect(html).toContain(`<td>${f.edited.metrics.meanCommuteMinutes}</td>`);
    }
    expect(html.match(/<circle /g)).toHaveLength(3);
    expect(html.match(/<rect /g)).toHaveLength(3);
  }
  expect(JSON.stringify(frames)).toBe(before);
});

test('incomplete paired chart does not invent missing values', () => {
  const html = renderToStaticMarkup(<ActualTimeChart frames={[
    {time: 0, baseline: {metrics:{trips:1}, actors:[]}, edited:{metrics:{trips:2}, actors:[]}},
    {time: 1, baseline: {metrics:{trips:3}, actors:[]}, edited:{metrics:{}, actors:[]}},
  ]} metric="trips" index={0} />);
  expect(html).toContain('No complete paired recorded series');
  expect(html).not.toContain('<table');
});

test('map-free grid table respects source mode, filter and zero count exclusions', () => {
  const cells = [{lat:29, lng:-95, real:{count:2,perNeed:[{needId:'food',count:2,demand:1}]}, simulated:{count:5,perNeed:[{needId:'housing',count:5,demand:1}]}}];
  const needs = [{id:'food', label:'Food'}, {id:'housing',label:'Housing'}] as any;
  const render = (mode:'real'|'simulated'|'both', needFilter='all') => renderToStaticMarkup(<NeedsGeoMap cells={cells} mode={mode} needFilter={needFilter} needs={needs} />);
  expect(render('real')).toContain('<td>Food</td><td>2</td>');
  expect(render('simulated')).toContain('<td>Housing</td><td>5</td>');
  expect(render('both')).toContain('<td>Housing</td><td>7</td>');
  expect(render('real','housing')).not.toContain('<td>2</td>');
  expect(cells[0]!.real.count).toBe(2);
});

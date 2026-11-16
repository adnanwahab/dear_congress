import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { responsibilityPaths } from '../shared/responsibility';
import { ResponsibilityExplorer } from './ResponsibilityExplorer';

test('every jurisdiction has four ordered, institutionally sourced roles and uncertainty', () => {
  expect(responsibilityPaths.length).toBeGreaterThan(1);
  for (const path of responsibilityPaths) {
    expect(path.steps.map(s => s.role)).toEqual(['Writes', 'Authorizes', 'Funds', 'Implements']);
    expect(path.uncertainty).toBeTruthy();
    for (const step of path.steps) {
      expect(new URL(step.source).protocol).toBe('https:');
      expect(step.publisher).toBeTruthy();
    }
  }
  const html = renderToStaticMarkup(<ResponsibilityExplorer />);
  expect(html).toContain('not verified authority');
  expect(html).toContain('Text-only outline');
  expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(4);
  expect(html).toContain('No vote is cast');
});
test('explorer interaction preserves sources and distinguishes unavailable context', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-responsibility-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS responsibility');
});

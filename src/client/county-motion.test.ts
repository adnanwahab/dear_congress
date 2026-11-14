import { expect, test } from 'bun:test';
import { pathCentroid, rippleDelays } from './county-motion';
import counties from './data/counties.json';
test('static polygon centroids produce finite bounded waves from the selected county', () => {
  expect(pathCentroid('M0,0L4,0L4,4L0,4Z')).toEqual([2, 2]);
  const centers = counties.map(c => pathCentroid(c.path));
  expect(centers.every(c => c.every(Number.isFinite))).toBe(true);
  for (const index of [0, 1600, 3143]) {
    const delays = rippleDelays(centers, centers[index]!);
    expect(delays[index]).toBe(0);
    expect(Math.max(...delays)).toBe(550);
    expect(Math.min(...delays)).toBe(0);
  }
});
test('motion lifecycle and static reduced-motion counters', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-county-motion-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS county motion:');
});

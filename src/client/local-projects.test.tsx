import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PUBLIC_GUIDE } from './public-guide';
import { LocalProjectCheckins } from './LocalProjectCheckins';
import { DEMO_PROJECTS, queueDemoCorrection, updateFreshness } from './local-projects';

test('real mode fails closed and examples require an explicit choice', () => {
  const html = renderToStaticMarkup(<LocalProjectCheckins />);
  expect(html).toContain('Real projects: unavailable');
  expect(html).toContain('No verified neighborhood project feed');
  expect(html).toContain('aria-expanded="false"');
  expect(html).not.toContain('<form');
  expect(PUBLIC_GUIDE).toContain('No verified neighborhood project feed is connected');
  expect(PUBLIC_GUIDE).toContain('nothing is sent to a real moderator');
});
test('corrections append pending revision-bound records without changing evidence', () => {
  const before = JSON.stringify(DEMO_PROJECTS);
  const project = DEMO_PROJECTS[0]!;
  const queue = queueDemoCorrection([], project.id, project.evidence[0]!.id, 'Example correction', 'https://example.org/document');
  const next = queueDemoCorrection(queue, project.id, project.evidence[1]!.id, 'Second correction', 'https://example.org/second');
  expect(queue).toHaveLength(1);
  expect(next).toHaveLength(2);
  expect(next[0]).toEqual(queue[0]);
  expect(next[0]).toMatchObject({ status: 'pending', origin: 'demo', projectRevision: '1', evidenceRevision: '1' });
  expect(JSON.stringify(DEMO_PROJECTS)).toBe(before);
  expect(() => queueDemoCorrection(queue, 'missing', project.evidence[0]!.id, 'text', 'https://example.org')).toThrow();
  expect(() => queueDemoCorrection(queue, DEMO_PROJECTS[1]!.id, project.evidence[0]!.id, 'text', 'https://example.org')).toThrow();
  for (const source of ['javascript:alert(1)', 'http://example.org', 'https://user:pass@example.org', 'invalid']) {
    expect(() => queueDemoCorrection(queue, project.id, project.evidence[0]!.id, 'text', source)).toThrow();
  }
  for (const text of [' ', 'x'.repeat(2001)]) expect(() => queueDemoCorrection(queue, project.id, project.evidence[0]!.id, text, 'https://example.org')).toThrow();
});
test('freshness uses observation date, never publication date or browser clock', () => {
  const evidence = DEMO_PROJECTS[0]!.evidence[2]!;
  expect(updateFreshness(evidence)).toBe('Recent example observation');
  expect(updateFreshness(evidence, '2026-12-11')).toBe('Recent example observation');
  expect(updateFreshness(evidence, '2026-12-12')).toContain('Old');
  expect(updateFreshness({ ...evidence, observedOn: null })).toBe('No observation recorded');
  expect(updateFreshness({ ...evidence, observedOn: 'invalid' })).toContain('unknown');
  expect(updateFreshness(evidence, '2026-11-01')).toContain('unknown');
});
test('project interactions and correction failure retain facts', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-local-projects-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS local projects');
});

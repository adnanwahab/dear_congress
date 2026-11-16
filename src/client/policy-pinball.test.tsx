import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PINBALL_RULES, PolicyPinball } from './PolicyPinball';
test('pinball starts opt-in and fixed rules cover all four interacting constraints', () => {
  const html = renderToStaticMarkup(<PolicyPinball />);
  expect(html).toContain('aria-expanded="false"');
  expect(html).not.toContain('<svg');
  expect(PINBALL_RULES.map(r => r.gate)).toEqual(['Budget', 'Jurisdiction', 'Evidence', 'Implementation']);
  expect(PINBALL_RULES.every(r => r.rule.startsWith('If ') && r.result.length > 20)).toBe(true);
});
test('local game lifecycle and complete rule text stay isolated', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-policy-pinball-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS pinball:');
});

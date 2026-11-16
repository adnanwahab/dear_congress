import { test, expect } from 'bun:test';
import { HALL_SCENES, TownHallGame } from './TownHallGame';
import { renderToStaticMarkup } from 'react-dom/server';
test('complete explanation contains every fictional queue, time budget, choice and feedback before opt-in', () => {
  const html = renderToStaticMarkup(<TownHallGame />);
  for (const scene of HALL_SCENES) {
    expect(html).toContain(scene.title);
    expect(html).toContain(scene.time);
    for (const q of scene.queue) expect(html).toContain(q);
    expect(scene.choices.filter(c => c[2])).toHaveLength(1);
    for (const [label, feedback] of scene.choices) {
      expect(html).toContain(label);
      expect(html).toContain(feedback);
    }
  }
  expect(html).toContain('Nothing here alters advisory participation');
  expect(html).not.toContain('Practice complete');
});
test('local decisions, skips, restart, exit and feedback work without requests or storage', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-town-hall-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS town hall');
});

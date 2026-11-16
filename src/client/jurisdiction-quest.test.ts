import { expect, test } from 'bun:test';
import { questCards, QUEST_CARDS, LEVELS } from './JurisdictionQuest';
import { JURISDICTIONS } from './JurisdictionPicker';
test('every supported browse scope leads while all four levels remain sourced', () => {
  for (const scope of JURISDICTIONS) {
    expect(questCards(scope)[0]!.scope).toBe(scope);
    expect(questCards(scope)).toHaveLength(4);
  }
  expect(new Set(QUEST_CARDS.map(c => c.level)).size).toBe(LEVELS.length);
  for (const card of QUEST_CARDS) expect(new URL(card.url).protocol).toBe('https:');
});
test('quest interaction keeps answers local and reveals qualified feedback', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-jurisdiction-quest.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS quest');
});

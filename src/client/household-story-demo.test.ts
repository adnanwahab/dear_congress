import { expect, test } from 'bun:test';
import { DEFAULT_STORY_HOUSEHOLD, STORY_HOUSEHOLDS, simulateHouseholdPair } from './household-story-demo';

test('paired runs replay with identical population and common inputs; every balance reconciles', () => {
  expect(DEFAULT_STORY_HOUSEHOLD).toBe('demo-household-003');
  for (const household of STORY_HOUSEHOLDS) {
    const pair = simulateHouseholdPair(household);
    expect(pair).toEqual(simulateHouseholdPair(household));
    expect(pair[0].assumptions).toEqual(pair[1].assumptions);
    expect(pair[0].initialBalance).toBe(pair[1].initialBalance);
    for (const run of pair) {
      let balance = run.initialBalance;
      expect(new Set(run.events.map(e => e.id)).size).toBe(run.events.length);
      for (const event of run.events) {
        balance += event.change;
        expect(event.balance).toBe(balance);
        expect(event.id).toContain(household);
      }
    }
    expect(pair[1].events.at(-1)!.balance - pair[0].events.at(-1)!.balance).toBe(450);
    expect(pair[0].events).toHaveLength(9);
    expect(pair[1].events).toHaveLength(12);
  }
  expect(() => simulateHouseholdPair('real-resident')).toThrow('Unknown synthetic household');
});

test('household story loading, failure/retry, selection, logged sources and close', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-household-story-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS household story');
});

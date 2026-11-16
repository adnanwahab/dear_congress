import { expect, test } from 'bun:test';
import { createJury, nextTurn, tickJury, consentedSummary } from './citizen-jury';
test('consent gates turns and every seat gets one equal turn per agenda', () => {
  let room = createJury();
  expect(nextTurn(room)).toBe(room);
  room = { ...room, seats: room.seats.map(s => ({ ...s, consent: true })) };
  const seats: number[] = [];
  for (let i = 0; i < 9; i++) { seats.push(room.turn % 3); room = nextTurn(room); expect(room.remaining).toBe(60); expect(room.paused).toBe(true); }
  expect(seats).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2]);
  expect(nextTurn(room)).toBe(room);
});
test('timer stops at expiry and reports block progress', () => {
  const room = { ...createJury(), paused: false, remaining: 1, seats: createJury().seats.map(s => ({ ...s, consent: true })) };
  expect(tickJury(room).remaining).toBe(0);
  expect(tickJury(room).paused).toBe(true);
  expect(tickJury({ ...room, reported: true }).remaining).toBe(1);
  expect(nextTurn({ ...room, reported: true }).turn).toBe(0);
});
test('summary requires complete turns, unanimous current consent, no reports', () => {
  const room = { ...createJury(), turn: 9, summary: 'Keep uncertainty visible.', seats: createJury().seats.map(s => ({ ...s, consent: true, summaryConsent: true })) };
  expect(consentedSummary(room)).toContain('3 opt-in rehearsal seats; non-representative');
  expect(consentedSummary({ ...room, turn: 8 })).toBeNull();
  expect(consentedSummary({ ...room, reported: true })).toBeNull();
  expect(consentedSummary({ ...room, seats: room.seats.map((s,i) => ({ ...s, summaryConsent: i !== 0 })) })).toBeNull();
});
test('jury controls enforce consent, report pause, summary revision and deletion', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-jury-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS jury:');
});

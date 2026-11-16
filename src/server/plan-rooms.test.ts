import { expect, test } from 'bun:test';
import { PlanRooms, roomHandler } from './plan-rooms';
const seed = { packageId: 'A', lane: 'real', budget: 40000, rows: [{ id: 'bus', title: 'Bus', jurisdiction: 'Houston', source: 'Illustrative catalog assumption', amount: 10000 }] };
function setup() {
  let time = 100;
  const rooms = new PlanRooms(() => time);
  const { invite } = rooms.run({ action: 'create', seed }) as { invite: string };
  const { member } = rooms.run({ action: 'join', invite }) as { member: string };
  return { rooms, invite, member, tick: (ms: number) => { time += ms; } };
}
test('invitation and membership are required, and expiry revokes both', () => {
  const { rooms, invite, member, tick } = setup();
  expect(invite).toMatch(/^[a-f0-9]{64}$/);
  expect(() => rooms.run({ action: 'join', invite: 'wrong' })).toThrow('unavailable');
  expect(() => rooms.run({ action: 'poll', invite, member: 'wrong' })).toThrow('Join');
  tick(3600000);
  expect(() => rooms.run({ action: 'poll', invite, member })).toThrow('expired');
});
test('friends share append-only attributed suggestions and presence, without changing baseline or caller data', () => {
  const { rooms, invite, member, tick } = setup();
  const original = JSON.stringify(seed);
  const friend = rooms.run({ action: 'join', invite }) as { member: string };
  rooms.run({ action: 'suggest', invite, member, itemId: 'bus', amount: 20000 });
  tick(46000);
  const snapshot = rooms.run({ action: 'poll', invite, member: friend.member }) as any;
  expect(snapshot.people).toEqual([{ alias: 'Guest 1', present: false }, { alias: 'Guest 2', present: true }]);
  expect(snapshot.history).toEqual([{ alias: 'Guest 1', at: 100, itemId: 'bus', amount: 20000 }]);
  expect(snapshot.seed.rows[0].amount).toBe(10000);
  expect(JSON.stringify(seed)).toBe(original);
  expect(JSON.stringify(snapshot)).not.toContain(member);
  snapshot.history.length = 0;
  expect((rooms.run({ action: 'poll', invite, member }) as any).history).toHaveLength(1);
});
test('rooms isolate membership; invalid items, amounts and capacity fail closed', () => {
  const { rooms, invite, member } = setup();
  const other = rooms.run({ action: 'create', seed }) as { invite: string };
  expect(() => rooms.run({ action: 'poll', invite: other.invite, member })).toThrow('Join');
  for (const amount of [-1, NaN, 40001, .5]) expect(() => rooms.run({ action: 'suggest', invite, member, itemId: 'bus', amount })).toThrow();
  expect(() => rooms.run({ action: 'suggest', invite, member, itemId: 'unknown', amount: 1 })).toThrow();
  for (let i = 0; i < 11; i++) rooms.run({ action: 'join', invite });
  expect(() => rooms.run({ action: 'join', invite })).toThrow('full');
  expect(() => rooms.run({ action: 'create', seed: { ...seed, rows: [...seed.rows, ...seed.rows] } })).toThrow();
});
test('HTTP enforces origin, bounded JSON and uncached errors', async () => {
  const handle = roomHandler(new PlanRooms());
  const request = (origin: string, body: string) => handle(new Request('https://example.test/api/plan-rooms', { method: 'POST', headers: { origin }, body }));
  expect((await request('https://attacker.test', '{}')).status).toBe(403);
  expect((await request('https://example.test', 'x'.repeat(32001))).status).toBe(413);
  const response = await request('https://example.test', JSON.stringify({ action: 'create', seed }));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('access-control-allow-origin')).toBeNull();
});

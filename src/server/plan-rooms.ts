import { randomBytes } from 'node:crypto';
import type { RoomSeed, RoomSnapshot } from '../shared/plan-room';
import { boundedJson, PublicInputError, securityHeaders } from './public-security';

/** Ephemeral, bounded store deliberately has no DB, vote or synthesis dependencies. */
export class PlanRooms {
  private rooms = new Map<string, { expiresAt: number; seed: RoomSeed; people: Map<string, { alias: string; seen: number }>; history: RoomSnapshot['history'] }>();
  constructor(private now = Date.now) {}
  run(body: Record<string, unknown>) {
    for (const [key, room] of this.rooms) if (room.expiresAt <= this.now()) this.rooms.delete(key);
    if (body.action === 'create') {
      if (this.rooms.size >= 200) throw new PublicInputError('Rooms are busy. Try later.', 503);
      const seed = body.seed as RoomSeed;
      if (!seed || typeof seed.packageId !== 'string' || seed.packageId.length > 80 || !['real', 'blended', 'synthetic'].includes(seed.lane) || !Number.isSafeInteger(seed.budget) || seed.budget < 0 || !Array.isArray(seed.rows) || seed.rows.length > 100 || seed.rows.some(r => !r || ['id','title','jurisdiction','source'].some(k => typeof r[k as keyof typeof r] !== 'string' || String(r[k as keyof typeof r]).length > 500) || !Number.isSafeInteger(r.amount) || r.amount < 0) || new Set(seed.rows.map(r => r.id)).size !== seed.rows.length || seed.rows.reduce((s,r) => s + r.amount, 0) > seed.budget) throw new PublicInputError('Invalid fiscal snapshot.');
      const invite = randomBytes(32).toString('hex');
      this.rooms.set(invite, { expiresAt: this.now() + 3600000, seed: { packageId: seed.packageId, lane: seed.lane, budget: seed.budget, rows: seed.rows.map(({ id, title, jurisdiction, source, amount }) => ({ id, title, jurisdiction, source, amount })) }, people: new Map(), history: [] });
      return { invite };
    }
    const room = typeof body.invite === 'string' ? this.rooms.get(body.invite) : undefined;
    if (!room) throw new PublicInputError('Invitation unavailable or expired.', 404);
    if (body.action === 'join') {
      if (room.people.size >= 12) throw new PublicInputError('Room is full.', 409);
      const member = randomBytes(32).toString('hex');
      room.people.set(member, { alias: `Guest ${room.people.size + 1}`, seen: this.now() });
      return { member, alias: room.people.get(member)!.alias };
    }
    const person = typeof body.member === 'string' ? room.people.get(body.member) : undefined;
    if (!person) throw new PublicInputError('Join with the invitation first.', 403);
    if (body.action === 'suggest') {
      if (room.history.length >= 200) throw new PublicInputError('History is full. Create another room.', 409);
      if (!room.seed.rows.some(r => r.id === body.itemId) || typeof body.amount !== 'number' || !Number.isSafeInteger(body.amount) || body.amount < 0 || body.amount > room.seed.budget) throw new PublicInputError('Choose an item and an allocation within the room budget.');
      room.history.push({ alias: person.alias, at: this.now(), itemId: body.itemId as string, amount: body.amount });
    } else if (body.action !== 'poll') throw new PublicInputError('Unknown room action.');
    person.seen = this.now();
    return structuredClone({ expiresAt: room.expiresAt, seed: room.seed, people: [...room.people.values()].map(p => ({ alias: p.alias, present: this.now() - p.seen < 45000 })), history: room.history } satisfies RoomSnapshot);
  }
}
export function roomHandler(rooms: PlanRooms, origin = (req: Request) => new URL(req.url).origin) {
  return async (req: Request) => {
    let response: Response;
    try {
      // Capabilities are sent in bounded POST bodies, never in server URLs or cookies.
      if (req.headers.get('origin') !== origin(req) || req.headers.get('sec-fetch-site') === 'cross-site') throw new PublicInputError('Use this site to open rooms.', 403);
      response = Response.json(rooms.run(await boundedJson(req, 32000)));
    } catch (e) { response = Response.json({ error: e instanceof PublicInputError ? e.message : 'Room unavailable.' }, { status: e instanceof PublicInputError ? e.status : 500 }); }
    response.headers.set('cache-control', 'no-store');
    return securityHeaders(response);
  };
}

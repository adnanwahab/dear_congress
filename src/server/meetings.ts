import { parseMeetings } from '../shared/meetings';
export async function meetingsResponse(path = process.env.MEETINGS_PATH ?? 'data/public-meetings.json') {
  const headers = { 'cache-control': 'no-store' };
  try {
    const file = Bun.file(path);
    // Missing configuration means no coverage; unreadable/corrupt snapshots fail closed.
    const meetings = await file.exists() ? parseMeetings(await file.json()) : [];
    return Response.json({ meetings }, { headers });
  } catch { return Response.json({ error: 'Public meeting sources unavailable' }, { status: 503, headers }); }
}

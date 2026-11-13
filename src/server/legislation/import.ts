import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BillMetadata, BillObservation } from '../../shared/legislation';

export function billIdentity(congress: number, type: string, number: number) {
  if (!Number.isSafeInteger(congress) || congress < 93 || congress > 999 || !['hr', 's'].includes(type) || !Number.isSafeInteger(number) || number < 1) throw new Error('Unsupported bill identity');
  return `congress-gov:${congress}:${type}:${number}`;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 20000) throw new Error('Invalid bill field');
  return value;
}
function day(value: unknown) {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || new Date(result).toISOString().slice(0, 10) !== result) throw new Error('Invalid action date');
  return result;
}
export function parseBill(raw: string, congress: number, type: string, number: number): BillMetadata {
  const id = billIdentity(congress, type, number);
  const b = JSON.parse(raw).bill;
  if (!b || b.congress !== congress || b.type?.toLowerCase() !== type || String(b.number) !== String(number) || b.originChamber !== (type === 'hr' ? 'House' : 'Senate')) throw new Error('Source identity mismatch');
  if (!Array.isArray(b.sponsors)) throw new Error('Missing sponsors collection');
  return { id, congress, type: type as 'hr' | 's', number, title: text(b.title), chamber: b.originChamber,
    sourceUrl: `https://www.congress.gov/bill/${congress}${congress % 100 >= 11 && congress % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[congress % 10] ?? 'th'}-congress/${type === 'hr' ? 'house' : 'senate'}-bill/${number}`,
    introducedDate: day(b.introducedDate), sponsors: b.sponsors.map((s: { fullName: unknown }) => text(s.fullName)),
    latestAction: { actionDate: day(b.latestAction?.actionDate), text: text(b.latestAction?.text) },
    upstreamUpdatedAt: typeof b.updateDate === 'string' ? b.updateDate : null };
}
const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');
interface Attempt { congress: number; type: string; number: number; checkedAt: string; sourceHash: string | null }
async function append(root: string, attempt: Attempt) {
  await mkdir(join(root, 'attempts'), { recursive: true });
  // Exclusive create: a retry or source correction cannot replace prior evidence.
  await writeFile(join(root, 'attempts', `${randomUUID()}.json`), JSON.stringify({ ...attempt, parserVersion: 'congress-detail-metadata.v1', sourceUrl: `https://api.congress.gov/v3/bill/${attempt.congress}/${attempt.type}/${attempt.number}?format=json` }), { flag: 'wx' });
}
export async function refreshBill(root: string, congress: number, type: string, number: number, apiKey: string,
  fetcher: (input: URL, init: RequestInit) => Promise<Response> = fetch, now = () => new Date()) {
  billIdentity(congress, type, number);
  const checkedAt = now().toISOString();
  try {
    if (!apiKey.trim()) throw new Error('API key required');
    const url = new URL(`https://api.congress.gov/v3/bill/${congress}/${type}/${number}`);
    url.searchParams.set('format', 'json'); url.searchParams.set('api_key', apiKey);
    const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Official source request failed');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Missing response body');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2_000_000) throw new Error('Oversized response');
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks));
    if (Buffer.byteLength(raw) > 2_000_000 || raw.includes(apiKey) || /api_key/i.test(raw)) throw new Error('Unsafe or oversized response');
    parseBill(raw, congress, type, number);
    const sourceHash = hash(raw);
    await mkdir(join(root, 'raw'), { recursive: true });
    try { await writeFile(join(root, 'raw', `${sourceHash}.json`), raw, { flag: 'wx' }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (await readFile(join(root, 'raw', `${sourceHash}.json`), 'utf8') !== raw) throw new Error('Archive integrity failure'); }
    await append(root, { congress, type, number, checkedAt, sourceHash });
  } catch {
    await append(root, { congress, type, number, checkedAt, sourceHash: null });
    throw new Error('Bill metadata refresh failed; last-good evidence retained');
  }
}
export async function readBills(root: string): Promise<BillObservation[]> {
  let files: string[];
  try { files = await readdir(join(root, 'attempts')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const groups = new Map<string, Attempt[]>();
  for (const file of files.filter(f => /^[\da-f-]+\.json$/.test(f))) {
    const attempt: Attempt = JSON.parse(await readFile(join(root, 'attempts', file), 'utf8'));
    const id = billIdentity(attempt.congress, attempt.type, attempt.number);
    if (!Number.isFinite(Date.parse(attempt.checkedAt)) || (attempt.sourceHash !== null && !/^[a-f0-9]{64}$/.test(attempt.sourceHash))) throw new Error('Invalid archive');
    groups.set(id, [...groups.get(id) ?? [], attempt]);
  }
  const bills: BillObservation[] = [];
  for (const attempts of groups.values()) {
    attempts.sort((a, b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt) || Number(a.sourceHash !== null) - Number(b.sourceHash !== null));
    const good = attempts.find(a => a.sourceHash !== null);
    if (!good) continue;
    const raw = await readFile(join(root, 'raw', `${good.sourceHash}.json`), 'utf8');
    if (hash(raw) !== good.sourceHash) throw new Error('Archive integrity failure');
    bills.push({ ...parseBill(raw, good.congress, good.type, good.number), checkedAt: good.checkedAt, sourceHash: good.sourceHash!, refreshFailed: attempts[0]!.sourceHash === null });
  }
  return bills.sort((a, b) => a.id.localeCompare(b.id));
}

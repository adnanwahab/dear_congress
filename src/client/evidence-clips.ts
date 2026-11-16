export interface ClipSource { kind: 'sample-proposal' | 'synthetic-outcome'; id: string; claim: string; citation: string; url: string; revision: string; }
export interface EvidenceClip { id: string; source: ClipSource; note: string; accessedAt: string; stale: boolean; }
export const CLIP_KEY = 'civic_evidence_clips_v1';
type Store = Pick<Storage, 'getItem' | 'setItem'>;
export const identity = (s: ClipSource) => JSON.stringify([s.kind, s.id]);
function validSource(s: any): s is ClipSource {
  if (!s || !['sample-proposal', 'synthetic-outcome'].includes(s.kind) || !['id','claim','citation','url','revision'].every(k => typeof s[k] === 'string')) return false;
  try { const u = new URL(s.url); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}
export function readClips(store: Store): EvidenceClip[] {
  const raw = store.getItem(CLIP_KEY); if (!raw) return [];
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.clips) || data.clips.length > 200 || !data.clips.every((c: any) => c && validSource(c.source) && typeof c.id === 'string' && typeof c.note === 'string' && typeof c.stale === 'boolean' && typeof c.accessedAt === 'string' && Number.isFinite(Date.parse(c.accessedAt)))) throw new Error('Notebook could not be read. Existing data has been kept.');
  return data.clips;
}
export function writeClips(store: Store, clips: EvidenceClip[]) { store.setItem(CLIP_KEY, JSON.stringify({version: 1, clips})); }
export function saveClip(store: Store, source: ClipSource, note: string, now = new Date().toISOString()) {
  const clips = readClips(store);
  if (!validSource(source)) throw new Error('Source is unavailable.');
  if (clips.length >= 200) throw new Error('Notebook is full (200 clips). Remove a clip first.');
  const clip: EvidenceClip = { id: crypto.randomUUID(), source: {...source}, note, accessedAt: now, stale: false };
  writeClips(store, [...clips, clip]); return clip;
}
export function observeClips(store: Store, source: ClipSource) {
  const clips = readClips(store); let changed = false;
  for (const c of clips) if (identity(c.source) === identity(source) && JSON.stringify(c.source) !== JSON.stringify(source) && !c.stale) { c.stale = true; changed = true; }
  if (changed) writeClips(store, clips);
}
const literal = (s: string) => s.replace(/[\\`*_{}\[\]<>#!|]/g, '\\$&');
export function clipsMarkdown(clips: EvidenceClip[]) {
  return '# Private evidence notebook\n\n' + clips.map(c => `## ${literal(c.source.claim)}\n\nType: ${c.source.kind}\n\nCitation: ${literal(c.source.citation)}\n\nSource URL: <${c.source.url.replace(/[<>\s]/g, ch => encodeURIComponent(ch))}>\n\nAccess date: ${c.accessedAt}\n\nRevision: ${literal(c.source.revision)}\n\nStatus: ${c.stale ? 'Stale — source record changed' : 'No change observed; external source not monitored'}\n\nNote:\n\n${literal(c.note)}\n`).join('\n');
}

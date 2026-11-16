import type { PublicPull } from '../shared/hbl-governance';
import { REPOSITORIES } from '../shared/repository-voting';

export const FEATURES = ['UI', 'Model', 'Data', 'Tests', 'Operations'] as const;
export type Feature = typeof FEATURES[number];
export type MicroscopeStatus = 'loading' | 'error' | 'stale' | 'unavailable' | 'blocked' | 'checks-pending' | 'review-ready' | 'pending';
export interface ChangeSummary {
  filename: string; feature: Feature; confidence: 'medium' | 'low';
  summary: string; caveat: string; lines: { label: string; url: string }[];
}
// Ordered, path-only heuristics. These describe likely file roles, never runtime effects.
export function classifyFile(path: string): { feature: Feature; confidence: 'medium' | 'low' } {
  const p = path.toLowerCase();
  const feature: Feature | undefined = /(^|\/)(__tests__|tests?|specs?)(\/|\.)|\.(test|spec)\./.test(p) ? 'Tests'
    : /(^|\/)(\.github|scripts|infra|ops)(\/|$)|(^|\/)(dockerfile|fly\.toml|package\.json|bun\.lockb?|.*config\.[^/]+)$/.test(p) ? 'Operations'
    : /(^|\/)(data|migrations|schema|seeds?)(\/|\.)|\.(sql|csv|json)$/.test(p) ? 'Data'
    : /(^|\/)(client|components|views|styles)(\/|$)|\.(tsx|css|html)$/.test(p) ? 'UI'
    : /(^|\/)(engine|model|models|domain|shared)(\/|$)/.test(p) ? 'Model' : undefined;
  return { feature: feature ?? 'Operations', confidence: feature ? 'medium' : 'low' };
}
export function microscopeStatus(pull: PublicPull, loading: boolean, error: boolean, stale = false): MicroscopeStatus {
  if (loading) return 'loading';
  if (error) return 'error';
  if (stale) return 'stale';
  if (pull.kind === 'issue' || !pull.files) return 'unavailable';
  if (pull.eligibility.state === 'blocked' || pull.state !== 'open') return 'blocked';
  if (pull.eligibility.state === 'waiting-for-checks') return 'checks-pending';
  if (!pull.draft && pull.evidence?.checks.length && pull.evidence.checks.every(c => c.sha === pull.headSha && c.status === 'completed' && c.conclusion === 'success')) return 'review-ready';
  return 'pending';
}
export function summarizeChanges(pull: PublicPull, repository: string): ChangeSummary[] {
  const allowed = Object.values(REPOSITORIES).some(r => r.repository === repository);
  // Do not turn contributor-provided URLs or a mismatched repository into receipts.
  if (!allowed || pull.kind === 'issue' || pull.url !== `https://github.com/${repository}/pull/${pull.number}` || !/^[a-f0-9]{40}$/i.test(pull.headSha)) return [];
  return (pull.files ?? []).map(file => {
    const role = classifyFile(file.filename);
    const lines: ChangeSummary['lines'] = [];
    const path = file.filename.split('/').map(encodeURIComponent).join('/');
    if (file.patch && file.status !== 'renamed') {
      let oldLine = 0, newLine = 0;
      for (const line of file.patch.split('\n')) {
        const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
        if (hunk) { oldLine = Number(hunk[1]); newLine = Number(hunk[2]); continue; }
        if (!oldLine && !newLine) continue;
        const removed = line.startsWith('-'), added = line.startsWith('+');
        // GitHub PR patches use the merge base, which need not equal evidence.baseSha.
        // Without that merge-base identity, do not invent before-line receipts.
        if (added) {
          const sha = pull.headSha;
          const n = removed ? oldLine : newLine;
          if (sha && /^[a-f0-9]{40}$/i.test(sha) && n > 0) lines.push({ label: `${removed ? 'Before' : 'After'} line ${n}`, url: `https://github.com/${repository}/blob/${sha}/${path}#L${n}` });
        }
        if (!added && !line.startsWith('\\')) oldLine++;
        if (!removed && !line.startsWith('\\')) newLine++;
      }
    }
    return { filename: file.filename, ...role,
      summary: `${file.status} · ${file.additions} lines added, ${file.deletions} removed. Likely ${role.feature.toLowerCase()} change.`,
      caveat: `${role.confidence === 'low' ? 'Low confidence: unrecognized path; grouped under operations. ' : 'Path-based interpretation; behavior is unverified. '}GitHub patches may be partial. Removed-line receipts are unavailable because the merge-base SHA is not provided.${!lines.length ? ' Changed-line evidence unavailable (missing patch, rename, or revision); inspect the official PR.' : ' Line receipts show changed source, not proof of feature behavior.'}`,
      lines,
    };
  });
}

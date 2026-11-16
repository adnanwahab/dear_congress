import type { OutcomesFile } from '../server/outcomes';

/** Read-only assessment of recorded metadata, never a live provider probe. */
export function sourceHealth(file: OutcomesFile | null, now = Date.now()) {
  return ['flooding', 'transit', 'streets'].map(needId => {
    const rows = file?.series.filter(row => row.needId === needId) ?? [];
    const latest = [...rows].sort((a, b) => b.year - a.year)[0];
    const errors = file?.errors?.filter(error => error.needId === needId) ?? [];
    const fetched = latest ? Date.parse(latest.fetchedAt) : NaN;
    const stale = !Number.isFinite(fetched) || fetched > now || now - fetched > 30 * 86400000;
    const conflict = !!latest && rows.some(row => row.year === latest.year && (row.value !== latest.value || row.unit !== latest.unit || row.source?.url !== latest.source?.url));
    return { needId, latest, errors, status: !latest || !latest.source?.name || !latest.source?.url ? 'Missing source' : conflict ? 'Conflicting records' : errors.length ? 'Fetch failed; retained data' : stale ? 'Stale or unverified date' : 'Recent recorded fetch',
      stale, conflict };
  });
}
export function healthReport(file: OutcomesFile | null, now = Date.now()) {
  return JSON.stringify({ format: 'source-health-v1', assessedAt: new Date(now).toISOString(),
    limitation: 'Recorded metadata only; starter fixtures are not verified measurements. Schema monitoring and human review are not recorded.',
    sources: sourceHealth(file, now) }, null, 2);
}

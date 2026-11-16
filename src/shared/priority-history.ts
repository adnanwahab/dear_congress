/** Recorded model rankings, never reconstructed from today's inputs. */
export interface PrioritySample {
  recordedAt: string;
  source: 'dear-congress/shared-needs-v1';
  journals: number;
  sampleJournals: number;
  realJournals: number;
  simulatedPrior: number;
  allocations: number;
  measuredOutcomes: boolean;
  ranks: { id: string; label: string; rank: number; demand: number }[];
}

export function validPrioritySamples(value: unknown): value is PrioritySample[] {
  return Array.isArray(value) && value.length <= 365 && value.every((s, i) =>
    s && s.source === 'dear-congress/shared-needs-v1' && Number.isFinite(Date.parse(s.recordedAt)) &&
    (i === 0 || s.recordedAt >= value[i - 1].recordedAt) &&
    ['journals', 'realJournals', 'sampleJournals', 'simulatedPrior', 'allocations'].every(k => Number.isInteger(s[k]) && s[k] >= 0) &&
    s.journals === s.realJournals + s.sampleJournals && typeof s.measuredOutcomes === 'boolean' &&
    Array.isArray(s.ranks) && s.ranks.length > 0 && new Set(s.ranks.map((r: { id: string }) => r.id)).size === s.ranks.length &&
    s.ranks.every((r: PrioritySample['ranks'][number], j: number) => typeof r.id === 'string' && typeof r.label === 'string' && r.rank === j + 1 && Number.isFinite(r.demand) && r.demand >= 0 && r.demand <= 1));
}

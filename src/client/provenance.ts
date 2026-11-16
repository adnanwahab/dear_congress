import { assessMetric, SYNTHETIC_METRICS } from '../shared/policy-measurements';

export type ProvenanceFlag = 'Synthetic' | 'Stale' | 'Missing' | 'Disputed';
export interface ProvenanceLayer { kind: 'Claim' | 'Source document' | 'Extracted measurement' | 'Transformation' | 'UI'; text: string; href?: string }
export interface ProvenanceClaim { id: string; title: string; flags: ProvenanceFlag[]; layers: ProvenanceLayer[] }
export const PROVENANCE_AS_OF = '2026-11-14';
export const PROVENANCE_LIMIT = 'Synthetic examples only. No verified implemented policy is registered. Source versions identify invented fixtures, not archived public documents. No journal, vote or private input is loaded or exported.';
export function provenanceClaims(asOf = PROVENANCE_AS_OF): ProvenanceClaim[] {
  return SYNTHETIC_METRICS.map(metric => {
    const result = assessMetric(metric, asOf);
    const { baseline, latest } = result;
    return {
      id: metric.id, title: `${metric.label}: ${result.movement}`,
      flags: ['Synthetic', ...(result.freshness === 'Outdated measurement' ? ['Stale' as const] : []), ...(!latest ? ['Missing' as const] : [])],
      layers: [
        { kind: 'Claim', text: `${result.movement}. ${result.target}. ${result.attribution}.` },
        { kind: 'Source document', text: `Source repository: adnanwahab/dear_congress. src/shared/policy-measurements.ts · ${baseline?.sourceVersion ?? 'Missing baseline source'} → ${latest?.sourceVersion ?? 'Missing current source'}. These are synthetic fixture identities; no original provider document is available.`, href: 'https://github.com/adnanwahab/dear_congress/blob/main/src/shared/policy-measurements.ts' },
        { kind: 'Extracted measurement', text: `Pinned baseline ${metric.baselineRevision}: ${baseline?.value ?? 'missing'} ${baseline?.unit ?? ''} (${baseline?.period ?? 'unknown'}). Current ${metric.latestRevision ?? 'missing'}: ${latest?.value ?? 'missing'} ${latest?.unit ?? ''} (${latest?.period ?? 'unknown'}). Population: ${baseline?.population ?? 'unknown'}. Invented values, not extracted observations.` },
        { kind: 'Transformation', text: `assessMetric: require finite values, source versions, matching units and population. Compare current minus pinned baseline; ${metric.direction} is better. Target ${metric.target} by ${metric.targetDate}. Stale after ${metric.nextUpdate}; missing values block comparison. ${metric.caveat}` },
        { kind: 'UI', text: `Outcomes → Policy measurements → ${metric.label}. Reading date ${asOf}. ${result.freshness}. No synthesis input or policy-effect attribution.`, href: '/outcomes#policy-measurements' },
      ],
    };
  });
}
export function exportMethodology(claims: readonly ProvenanceClaim[], asOf: string) {
  return [`# Civic Synthesis provenance methodology`, `As of ${asOf}`, PROVENANCE_LIMIT,
    'Reading path: Published → Feed → Votes → Draft → Sponsors → Outcomes. Navigation is not proof of enactment or evidence continuity.',
    'Disputed means an explicitly recorded disagreement; these fixtures contain no dispute records. Absence of a dispute record is not verification.',
    ...claims.flatMap(claim => [`## ${claim.title}`, `Identity: ${claim.id}. Flags: ${claim.flags.join(', ')}`, ...claim.layers.map(layer => `### ${layer.kind}\n${layer.text}${layer.href ? `\nSource link: ${layer.href}` : ''}`)]),
  ].join('\n\n');
}

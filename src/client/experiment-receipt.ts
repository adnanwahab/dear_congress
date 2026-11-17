import type { LawBehaviorReceipt } from './LawBehaviorExplorer';
import { civicLawQuery, parseCivicLawContext, type CivicLawContext } from './civic-law-context';

export const UNCERTAINTY = 'Synthetic model assumptions are uncalibrated; differences are not causal evidence or forecasts.';
const METRICS = ['trips','completedTrips','meanCommuteMinutes','meanExperiencedTravelMinutes','deniedBoardings','meanHousingBurden','employmentRate','modeledUtility','transitCrowding','housingUnits','availableUnits','entitledCapacity','meanRent','meanRentBurden','meanSavings','completedProjects','jobs','balance'] as const;
// Fixed key order, explicit projection: no actor IDs, labels, coordinates or free text.
export function experimentManifest(receipt: LawBehaviorReceipt, context: CivicLawContext) {
  const m = receipt.manifest;
  if (receipt.status !== 'completed' || !m || !m.modelVersion || m.seed !== context.seed || m.population !== 24 ||
      receipt.law.number !== context.lawId || m.implementationStrength !== context.implementationStrength ||
      m.modelVersion !== context.modelVersion) throw Error('Receipt does not match replay inputs.');
  const replay = civicLawQuery(context).toString();
  const horizon = context.lawId === 83 ? 720 : 12;
  const unit = context.lawId === 83 ? 'minute' : 'month';
  if (receipt.unit !== unit || !Number.isFinite(m.start) || !Number.isFinite(m.end) || m.start < 0 || m.start > m.end || m.end > horizon || !receipt.frames.length || receipt.frames.length > 100) throw Error('Unsupported replay horizon.');
  const metrics = (values: Record<string, number>) => Object.fromEntries(METRICS.filter(key => typeof values[key] === 'number' && Number.isFinite(values[key])).map(key => [key, values[key]!]));
  return { schemaVersion: 'civic-experiment.v1', sourceRepository: 'adnanwahab/dear_congress', provider: 'HappyBearLandia /api/law-behavior',
    sourceDataMode: 'synthetic', label: 'Simulated, not a forecast; no legal enactment', uncertainty: UNCERTAINTY,
    configuration: { lawId: context.lawId, implementationStrength: context.implementationStrength, seed: m.seed, population: 24, modelVersion: m.modelVersion, revision: context.revision },
    horizon: { start: m.start, end: m.end, unit }, eventReferences: null,
    redaction: 'Actor records, private inputs, proposal identifiers and provider free text omitted. Event IDs unavailable in provider v1.',
    replay: '/synth?' + replay.replace(/&proposalId=[^&]*/g, ''),
    checkpoints: receipt.frames.map(frame => ({ time: frame.time, baseline: metrics(frame.baseline.metrics), edited: metrics(frame.edited.metrics) })) };
}
export async function hashManifest(manifest: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(manifest));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function experimentBundle(receipt: LawBehaviorReceipt, context: CivicLawContext) {
  const manifest = experimentManifest(receipt, context);
  return { manifest, sha256: await hashManifest(manifest), instructions: 'Run bun scripts/validate-experiment.ts receipt.json. Open manifest.replay on the same reviewed Civic build, run explicitly, and export again. Compare hashes. A different model version must fail; hashes prove integrity, not authenticity or scientific validity.' };
}

export async function validateExperimentBundle(value: unknown) {
  const bundle = value as {manifest: ReturnType<typeof experimentManifest>; sha256: string};
  const m = bundle?.manifest;
  const context = m && typeof m.replay === 'string' && m.replay.startsWith('/synth?') ? parseCivicLawContext(m.replay.slice(7)) : null;
  if (!context?.modelVersion || !m || !Array.isArray(m.checkpoints) || !m.horizon || !m.configuration) throw Error('Invalid replay contract.');
  const frames = m.checkpoints.map(row => ({time: row.time, baseline: {metrics: row.baseline, actors: []}, edited: {metrics: row.edited, actors: []}}));
  if (frames.some((row, i) => !Number.isFinite(row.time) || row.time < m.horizon.start || row.time > m.horizon.end || i > 0 && row.time <= frames[i-1]!.time || [row.baseline.metrics,row.edited.metrics].some(metrics => !metrics || Object.values(metrics).some(v => !Number.isFinite(v))))) throw Error('Invalid checkpoints.');
  const expected = experimentManifest({schemaVersion:'hbl-law-behavior-receipt.v1', status:'completed', law:{id:'',number:context.lawId,title:''}, unit:m.horizon.unit as 'minute'|'month', manifest:{...m.configuration,pairedInitialState:true,start:m.horizon.start,end:m.horizon.end,recordedCheckpoints:frames.length,scope:''},frames}, context);
  if (JSON.stringify(expected) !== JSON.stringify(m) || await hashManifest(expected) !== bundle.sha256) throw Error('Invalid manifest or hash.');
  return expected;
}

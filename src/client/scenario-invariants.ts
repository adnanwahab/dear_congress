/** Bounded consumer contract; no legal prose or household inference is executable. */
export type SimulatorInput = {
  lawId: 21 | 22 | 23 | 83;
  implementationStrength: number;
  seed: number;
  population: 24;
  units: 'fraction of reviewed implementation' | 'discrete rule';
  horizon: 12 | 720;
  clock: 'minute' | 'month';
};
export type ScenarioFailure = {control: 'law' | 'strength' | 'seed'; message: string};
export function checkScenario(value: unknown): ScenarioFailure[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [{control:'law',message:'Choose a reviewed mechanism.'}];
  const v = value as Record<string, unknown>;
  const failures: ScenarioFailure[] = [];
  if (Object.keys(v).some(key => !['lawId','implementationStrength','seed','population','units','horizon','clock'].includes(key)))
    failures.push({control:'law',message:'Extra inputs have no reviewed mechanism. Use only the allowed controls; legal text cannot be executed.'});
  if (![21,22,23,83].includes(v.lawId as number)) failures.push({control:'law',message:'Choose transit, construction cost, permit capacity or fixed upzoning; other mechanisms are unavailable.'});
  if (![0,.25,.5,.75,1].includes(v.implementationStrength as number)) failures.push({control:'strength',message:'Implementation strength must be 0%, 25%, 50%, 75% or 100%.'});
  if (v.lawId === 21 && v.implementationStrength !== 1) failures.push({control:'strength',message:'Fixed upzoning requires 100%; partial implementation has no reviewed mechanism.'});
  if (!Number.isInteger(v.seed) || (v.seed as number) < 0 || (v.seed as number) > 4294967295) failures.push({control:'seed',message:'Seed must be an integer from 0 to 4294967295.'});
  if (v.population !== 24 || v.units !== (v.lawId === 21 ? 'discrete rule' : 'fraction of reviewed implementation') || v.clock !== (v.lawId === 83 ? 'minute' : 'month') || v.horizon !== (v.lawId === 83 ? 720 : 12))
    failures.push({control:'law',message:'Use the selected mechanism’s units and fixed horizon: 24 synthetic actors, 720 minutes for transit or 12 months for housing.'});
  return failures;
}

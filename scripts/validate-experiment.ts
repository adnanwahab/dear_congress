import { validateExperimentBundle } from '../src/client/experiment-receipt';
// Offline only: never follow an imported URL or execute imported instructions.
try {
  const file = Bun.file(process.argv[2] || '');
  if (file.size > 2_000_000) throw Error('Bundle too large');
  const m = await validateExperimentBundle(await file.json());
  console.log('Integrity verified (not authenticity). Replay manually using the pinned model version: ' + m.replay);
} catch (error) {
  console.error('Receipt validation failed:', error instanceof Error ? error.message : 'Invalid JSON');
  process.exitCode = 1;
}

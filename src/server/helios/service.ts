import { HELIOS_PROMPT, type HeliosResult, type HeliosRequest } from '../../shared/helios-contract';
import { fixture, readLimited, SYSTEM_PROMPT } from './provider';
import { hash, HeliosError, validateOutput, validateRequest } from './validation';
export { HeliosError } from './validation';
export type HeliosEnvironment = Record<string, string | undefined>;

function limit(env: HeliosEnvironment, key: string, fallback: number, maximum: number): number {
  const value = env[key] === undefined ? fallback : Number(env[key]);
  if (!Number.isFinite(value) || value <= 0 || value > maximum) throw new HeliosError('DISABLED');
  return value;
}
/** Instantiate ONCE per worker. The mounting owner must authenticate/CSRF-check the
 * human invocation, resolve scope and consent from trusted records, and recheck
 * consent/current revisions before publishing. No browser consent assertion is authority.
 * This service has no database, journal reader, vote writer or execution capability.
 */
export function createHeliosService(env: HeliosEnvironment = process.env, transport: (input: string, init: RequestInit) => Promise<Response> = fetch) {
  env = { ...env };
  const enabled = env.HELIOS_ENABLED === 'true';
  const testFixture = env.HELIOS_PROVIDER === 'fixture' && env.NODE_ENV === 'test';
  const model = testFixture ? 'deterministic-fixture/v1' : env.HELIOS_MODEL;
  const timeout = limit(env, 'HELIOS_TIMEOUT_MS', 10000, 30000);
  const maxCalls = Math.floor(limit(env, 'HELIOS_REQUESTS_PER_HOUR', 20, 100));
  const budget = limit(env, 'HELIOS_BUDGET_USD_PER_HOUR', 1, 20);
  // Provider/operator must supply conservative USD per million token ceilings.
  const inputPrice = testFixture ? 0 : limit(env, 'HELIOS_INPUT_USD_PER_MILLION', 10, 1000);
  const outputPrice = testFixture ? 0 : limit(env, 'HELIOS_OUTPUT_USD_PER_MILLION', 30, 1000);
  const endpoint = env.HELIOS_ENDPOINT;
  const apiKey = env.HELIOS_API_KEY;
  let windowStart = Date.now(), calls = 0, reserved = 0, active = false;
  return {
    async generate(input: unknown): Promise<HeliosResult> {
      if (!enabled) throw new HeliosError('DISABLED');
      if (!testFixture && (env.HELIOS_PROVIDER !== 'json-http' || !model || !endpoint || !apiKey)) throw new HeliosError('MODEL_UNAVAILABLE');
      if (!testFixture) {
        let url: URL; try { url = new URL(endpoint!); } catch { throw new HeliosError('DISABLED'); }
        if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new HeliosError('DISABLED');
      }
      const request = validateRequest(input, !testFixture);
      // Never forward arbitrary caller fields, ownership hashes or host credentials.
      const prompt = JSON.stringify({ scope: request.scope, sources: request.sources.map(({ id, kind, text, revisionHash }) => ({ id, kind, text, revisionHash })), responseShape: fixture(request) });
      // One token per UTF-8 byte is a conservative reservation; no refunds on failures.
      const estimatedCost = ((new TextEncoder().encode(SYSTEM_PROMPT + prompt).length * inputPrice) + 4096 * outputPrice) / 1e6;
      const now = Date.now();
      if (now - windowStart >= 3600000 && !active) { windowStart = now; calls = 0; reserved = 0; }
      if (active || calls >= maxCalls) throw new HeliosError('RATE_LIMIT');
      if (reserved + estimatedCost > budget) throw new HeliosError('BUDGET_LIMIT');
      calls++; reserved += estimatedCost; active = true;
      const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const work = async () => {
          if (testFixture) return fixture(request);
          const response = await transport(endpoint!, {
            method: 'POST', redirect: 'error', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model, temperature: 0, max_output_tokens: 4096, store: false,
              messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }] }),
          });
          // Adapter contract: the configured gateway returns the versioned JSON object directly.
          return readLimited(response, controller.signal);
        };
        const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new HeliosError('TIMEOUT')); }, timeout); });
        const output = validateOutput(await Promise.race([work(), deadline]), request.sources);
        return {
          ...output, status: 'human-review-required', binding: false, scope: request.scope,
          provenance: {
            model: model!, promptVersion: HELIOS_PROMPT, generatedAt: new Date().toISOString(), fixture: testFixture,
            sourceRevisionHash: hash({ scope: request.scope, sources: request.sources }),
            sources: request.sources.map(s => ({ id: s.id, kind: s.kind, revisionHash: s.revisionHash, consent: s.consent! })),
          },
          unresolvedObjections: request.sources.filter(s => s.kind === 'objection').map(s => ({ sourceId: s.id, text: s.text, severity: s.objection!.severity, responses: s.objection!.responses })),
        };
      } catch (error) {
        if (error instanceof HeliosError) throw error;
        // Provider messages may contain private source text or credentials: never expose them.
        throw new HeliosError('MODEL_UNAVAILABLE');
      } finally { clearTimeout(timer); controller.abort(); active = false; }
    },
  };
}
/** Narrow adapter for the existing immutable SHE-307 public objection projection. */
export function objectionSource(objection: NonNullable<HeliosRequest['sources'][number]['objection']>, consent: HeliosRequest['sources'][number]['consent']): HeliosRequest['sources'][number] {
  const { id, text, severity, constituency, createdAt, responses } = objection;
  return { id, kind: 'objection', text, revisionHash: hash(text), consent,
    objection: { id, text, severity, constituency, createdAt, responses: responses.map(({ status, reason, createdAt, actor }) => ({ status, reason, createdAt, actor })) } };
}

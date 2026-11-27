import {POLICY_DEMOS, policyDemo, demoVersions, type PolicyDemoId} from '../shared/policy-demo-catalog';
import {canonical, digest} from './policy-preview';

/** Process-local capability issued by trusted server creation, never HTTP input.
 * The integration owner must bind this to authorized saved records and explicit
 * public transfer consent. It is not publication approval or a persistent grant. */
export function createPolicyDemoAuthority() {
  const grants = new WeakMap<object, PolicyDemoId>();
  return {
    create(id: string) {
      const demo = policyDemo(id);
      if (!demo) throw new Error('Unknown policy demonstration');
      const grant = Object.freeze({});
      grants.set(grant, demo.id);
      return {grant, versions: demoVersions(demo)};
    },
    prepare(grant: object, saved: unknown, confirmedPublicTransfer: boolean) {
      const id = grants.get(grant), demo = id && policyDemo(id);
      if (!demo) throw new Error('Server-created demonstration authority required');
      if (confirmedPublicTransfer !== true) throw new Error('Explicit public transfer review required');
      if (canonical(saved) !== canonical(demoVersions(demo))) throw new Error('Edited or private content is not eligible for the frozen mapping');
      if (digest(canonical(demo.input.legal)) !== demo.legalHash || digest(canonical(demo.input)) !== demo.inputHash) throw new Error('Catalog identity mismatch');
      if (demo.id === 'unsupported') return {status: 'unsupported' as const, legal: structuredClone(demo.input.legal), message: 'Not Modeled'};
      return {status: 'candidate' as const, payload: structuredClone(demo.input), modelVersion: demo.modelVersion,
        mappingVersion: demo.mappingVersion, message: 'Human acceptance and route integration remain required; this does not create a preview.'};
    },
  };
}

// Validate the software catalog at server import; no heuristics or network calls.
for (const demo of POLICY_DEMOS) {
  if (digest(canonical(demo.input.legal)) !== demo.legalHash || demo.legalHash !== demo.input.source.contentHash) throw new Error('Invalid frozen legal hash');
}

import {test, expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {POLICY_DEMOS, POLICY_DEMO_SOURCE, demoVersions} from '../shared/policy-demo-catalog';
import {canonical, digest} from './policy-preview';
import {createPolicyDemoAuthority} from './policy-demo-catalog';

test('candidate source bytes, every exact payload/hash/model and seed identity match HBL', () => {
  const raw = readFileSync(new URL('./fixtures/policy-demo-hbl-handoff.json', import.meta.url), 'utf8');
  expect(digest(raw)).toBe(POLICY_DEMO_SOURCE.handoffSha256);
  const source = JSON.parse(raw);
  for (const demo of POLICY_DEMOS) {
    const upstream = source.demos.find((row: {id:string}) => row.id === demo.id);
    for (const key of Object.keys(demo)) expect(demo[key as keyof typeof demo]).toEqual(upstream[key]);
    expect(digest(canonical(demo.input))).toBe(demo.inputHash);
    expect(digest(canonical(demo.input.legal))).toBe(demo.legalHash);
    expect(upstream.pairSeeds).toHaveLength(100);
    expect(upstream.pairOutputHashes).toHaveLength(100);
    expect(upstream.checkpointMonths).toEqual([0,12,24]);
    expect(demo.input.simulation).toEqual({seed:42,runs:100,months:24});
    expect(demo.modelVersion).toBe('city-systems.1.1.0/constitution-runtime.1.0.0/policy-preview-mappings.1.0.0');
  }
  expect(Object.isFrozen(POLICY_DEMOS[0].input.legal.clauses)).toBe(true);
});

test('only server-issued exact drafts can prepare allowlisted inputs; unsupported never transfers', () => {
  const authority = createPolicyDemoAuthority();
  for (const demo of POLICY_DEMOS) {
    const draft = authority.create(demo.id);
    expect(() => authority.prepare({},draft.versions,true)).toThrow('authority');
    expect(() => authority.prepare(JSON.parse(JSON.stringify(draft.grant)),draft.versions,true)).toThrow('authority');
    expect(() => authority.prepare(draft.grant,draft.versions,false)).toThrow('review');
    const result = authority.prepare(draft.grant,draft.versions,true);
    expect(result.status).toBe(demo.id === 'unsupported' ? 'unsupported' : 'candidate');
    if ('payload' in result) expect(canonical(result.payload)).toBe(canonical(demo.input));
    else expect(result).not.toHaveProperty('payload');
    for (const mutate of [
      (v: ReturnType<typeof demoVersions>) => {v.proposal.title += ' edited';},
      (v: ReturnType<typeof demoVersions>) => {v.proposal.clauses[0]!.text += ' edited';},
      (v: ReturnType<typeof demoVersions>) => {v.baseline.versionId = 'forged' as typeof v.baseline.versionId;},
      (v: ReturnType<typeof demoVersions>) => {Object.assign(v.proposal,{type:'private-journal'});},
      (v: ReturnType<typeof demoVersions>) => {Object.assign(v,{journal:'private text',confirmedPublic:true});},
    ]) {
      const edited = structuredClone(draft.versions); mutate(edited);
      expect(() => authority.prepare(draft.grant,edited,true)).toThrow('not eligible');
    }
    expect(() => createPolicyDemoAuthority().prepare(draft.grant,draft.versions,true)).toThrow('authority');
  }
  expect(() => authority.create('citizen title h_lots')).toThrow('Unknown');
});

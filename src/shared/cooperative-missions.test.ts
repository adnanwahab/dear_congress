import { expect, test } from 'bun:test';
import { applyMission, exportMission, missionKey, missionProgress, newMission, readMission, type Mission, type MissionAction, type MissionSource } from './cooperative-missions';
const source: MissionSource = { kind: 'citizen', id: 'one', title: 'Transit', text: 'Original proposed policy' };
const update = (m: Mission, action: MissionAction, actor = 'Facilitator') => applyMission(m, { actor, at: '2026-11-14T12:00:00Z', action });
const add = (m: Mission, name = 'Researcher', permission: 'editor' | 'observer' = 'editor') => update(m, { type: 'member', member: { name, permission, role: 'research' } });
const note = { member: 'Researcher', role: 'research' as const, finding: 'Bus service gap', citation: 'https://example.org/report', reasoning: 'Service hours exclude night shifts', limitation: 'Does not measure weekend demand' };
test('progress needs a different editor’s reasoned evidence review and can be revoked; volume earns nothing', () => {
  let m = add(newMission(source));
  for (let i = 0; i < 3; i++) m = update(m, { type: 'contribution', contribution: note }, 'Researcher');
  expect(missionProgress(m)).toEqual([]);
  expect(() => update(m, { type: 'review', contribution: 0, ready: true, reason: 'Reviewed source and scope' }, 'Researcher')).toThrow();
  m = update(m, { type: 'review', contribution: 0, ready: true, reason: 'Source supports weekday gap; weekend limit retained' });
  expect(missionProgress(m)).toEqual(['research']);
  m = update(m, { type: 'review', contribution: 1, ready: true, reason: 'Same perspective verified' });
  expect(missionProgress(m)).toEqual(['research']);
  for (const contribution of [0, 1]) m = update(m, { type: 'review', contribution, ready: false, reason: 'Need a current source' });
  expect(missionProgress(m)).toEqual([]);
  expect(m.source).toEqual(source);
});
test('permissions, role bounds, attribution and citation schemes fail closed', () => {
  let m = add(newMission(source), 'Observer', 'observer');
  for (const action of [{ type: 'draft', text: 'Changed' }, { type: 'question', text: 'Why?' }] as MissionAction[]) expect(() => update(m, action, 'Observer')).toThrow('editors');
  expect(() => update(m, { type: 'draft', text: 'Changed' }, 'Absent')).toThrow();
  m = add(m);
  expect(() => update(m, { type: 'member', member: { name: 'Another', permission: 'editor', role: '' } }, 'Researcher')).toThrow('facilitator');
  for (const citation of ['javascript:alert(1)', 'ftp://example.org', 'https://user:password@example.org', 'bad']) expect(() => update(m, { type: 'contribution', contribution: { ...note, citation } }, 'Researcher')).toThrow();
  expect(() => update(m, { type: 'contribution', contribution: note })).toThrow();
  for (const name of ['A', 'B', 'C']) m = add(m, name);
  expect(() => add(m, 'D')).toThrow('six');
});
test('replay/export retains source, revisions, questions and reviews without trusting derived state', () => {
  let m = add(newMission(source));
  m = update(m, { type: 'draft', text: '<script>Draft text is plain text</script>' });
  m = update(m, { type: 'question', text: 'How much?' });
  m = update(m, { type: 'resolve', question: 0, reason: 'Estimate documented; uncertainty remains' });
  expect(() => update(m, { type: 'resolve', question: 0, reason: 'Replace record' })).toThrow();
  const exported = exportMission(m);
  const replay = readMission(exported, source);
  expect(replay).toEqual(m);
  expect(readMission(JSON.stringify({ ...m, draft: 'Forged derived text', members: [] }), source)).toEqual(m);
  expect(JSON.parse(exported).log[1].action.text).toContain('<script>');
  expect(source.text).toBe('Original proposed policy');
});
test('kind, ID, exact revision, schema and corrupt logs remain isolated', () => {
  const raw = exportMission(newMission(source));
  for (const other of [{ ...source, kind: 'sample' as const }, { ...source, id: 'two' }, { ...source, text: 'New revision' }]) {
    expect(() => readMission(raw, other)).toThrow('not been overwritten');
  }
  expect(missionKey(source)).not.toBe(missionKey({ ...source, kind: 'sample' }));
  for (const value of ['{', 'null', '{"version":2}', JSON.stringify({ ...newMission(source), log: [null] })]) expect(() => readMission(value, source)).toThrow();
  expect(readMission(null, source).log).toEqual([]);
});

test('draft revisions invalidate readiness until reviewed again without erasing earlier reviews', () => {
  let m = add(newMission(source));
  m = update(m, { type: 'contribution', contribution: note }, 'Researcher');
  m = update(m, { type: 'review', contribution: 0, ready: true, reason: 'Relevant source, reasoning and limitation' });
  expect(missionProgress(m)).toEqual(['research']);
  m = update(m, { type: 'draft', text: 'Different policy mechanism' });
  expect(missionProgress(m)).toEqual([]);
  expect(m.log.filter(e => e.action.type === 'review')).toHaveLength(1);
  m = update(m, { type: 'review', contribution: 0, ready: true, reason: 'Evidence still relevant to this revision' });
  expect(missionProgress(m)).toEqual(['research']);
});

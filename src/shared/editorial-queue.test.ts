import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { editorialQueue, reviewedEditorialQuestion } from './editorial-queue';
import { dailyQuestion } from './daily-question';
import { demoPayload } from '../engine/demo';

test('seven consecutive dated candidates retain content-addressed archive revisions', () => {
  expect(editorialQueue.schedule).toHaveLength(7);
  expect(new Set(editorialQueue.revisions.map(r => r.revisionId)).size).toBe(7);
  editorialQueue.schedule.forEach((entry, index) => {
    expect(entry.date).toBe(`2026-11-${16 + index}`);
    const revision = editorialQueue.revisions.find(r => r.revisionId === entry.revisionId)!;
    expect(revision.revisionId).toBe('sha256:' + createHash('sha256').update(JSON.stringify(revision.content)).digest('hex'));
    expect(entry.approval).toBeNull();
  });
});

test('pending dates fail closed; reviewed assignments support rollback without archive edits', () => {
  const now = new Date('2026-11-16T18:00:00Z');
  expect(dailyQuestion(demoPayload({}, 'test', now), now)).toBeUndefined();
  const approval = { reviewer: 'test human', reviewedAt: '2026-11-15T18:00:00Z' };
  const assignment = { date: '2026-11-16', revisionId: editorialQueue.revisions[0]!.revisionId, approval };
  expect(reviewedEditorialQuestion(now, [assignment])?.revisionId).toBe(assignment.revisionId);
  const rollback = { ...assignment, revisionId: editorialQueue.revisions[1]!.revisionId };
  expect(reviewedEditorialQuestion(now, [rollback])?.revisionId).toBe(rollback.revisionId);
  expect(reviewedEditorialQuestion(now, [assignment, rollback])).toBeUndefined();
  expect(reviewedEditorialQuestion(now, [{ ...assignment, revisionId: 'unknown' }])).toBeUndefined();
  expect(reviewedEditorialQuestion(now, [{ ...assignment, approval: { ...approval, reviewedAt: 'invalid' } }])).toBeUndefined();
  expect(reviewedEditorialQuestion(new Date('2026-11-16T05:59:59Z'), [assignment])).toBeUndefined();
});

test('reviewed selection preserves proposal identity and rejects changed copy and expired windows', () => {
  const now = new Date('2026-11-16T18:00:00Z');
  const assignment = editorialQueue.schedule[0]!;
  const saved = { ...assignment };
  const data = demoPayload({}, 'test', now);
  const id = editorialQueue.revisions[0]!.content.proposalId;
  data.votes[id] = -1;
  try {
    Object.assign(assignment, { approval: { reviewer: 'test fixture only', reviewedAt: '2026-11-15T18:00:00Z' } });
    expect(dailyQuestion(data, now)?.id).toBe(id);
    expect(data.votes[id]).toBe(-1);
    expect(dailyQuestion({ ...data, items: data.items.map(item => item.id === id ? { ...item, summary: 'changed' } : item) }, now)).toBeUndefined();
    expect(dailyQuestion({ ...data, closesAt: now.toISOString() }, now)).toBeUndefined();
  } finally { Object.assign(assignment, saved); }
});

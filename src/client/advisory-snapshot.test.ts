import { expect, test } from 'bun:test';
import { advisorySnapshot } from './advisory-snapshot';
import { demoPayload } from '../engine/demo';
import { readProposalSnapshot, saveProposalSnapshot } from './proposal-motion';
import { PUBLIC_GUIDE } from './public-guide';

test('public guide explains refresh, stale recovery and sample separation', () => {
  for (const wording of ['every 30 seconds', 'Refresh advisory counts', 'Snapshot may be stale',
    'saved-choice highlight is hidden', 'Fictional sample tallies remain separate']) {
    expect(PUBLIC_GUIDE).toContain(wording);
  }
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('concurrent reads and a save fence cannot restore a pre-save choice or tally', async () => {
  const reads = [deferred<number>(), deferred<number>(), deferred<number>()];
  let i = 0, value = 0, stale = false;
  const reader = advisorySnapshot(() => reads[i++]!.promise, next => { value = next; stale = false; }, () => { stale = true; });
  const beforeSave = reader.refresh();
  reader.invalidate();
  const afterSave = reader.refresh();
  reads[1]!.resolve(2); await afterSave;
  reads[0]!.resolve(1); await beforeSave;
  expect(value).toBe(2); expect(stale).toBe(false);
  const pending = reader.refresh();
  reader.invalidate(); // An ambiguous write also makes any in-flight read obsolete.
  reads[2]!.resolve(3); await pending;
  expect(value).toBe(2); expect(stale).toBe(true);
});

test('failed refresh stays stale and next fetch repairs; disposed reads cannot apply', async () => {
  let fail = true, value = 1, stale = false;
  const reader = advisorySnapshot(async () => { if (fail) throw Error('offline'); return 2; }, next => { value = next; stale = false; }, () => { stale = true; });
  await expect(reader.refresh()).rejects.toThrow('offline');
  expect(value).toBe(1); expect(stale).toBe(true);
  fail = false; await reader.refresh();
  expect(value).toBe(2); expect(stale).toBe(false);
  const pending = reader.refresh(); reader.dispose(); await pending;
  expect(stale).toBe(true);
});

test('legacy and new motion caches retain sample identity without browser choices or counts', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const payload = demoPayload({ browser: { 'demo-housing': { stance: 1 } } }, 'browser');
  let raw = JSON.stringify(payload);
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } } });
  try {
    expect(readProposalSnapshot()?.votes).toEqual({});
    expect(readProposalSnapshot()?.browserCounts).toEqual({});
    saveProposalSnapshot(payload);
    expect(JSON.parse(raw).votes).toEqual({});
    expect(JSON.parse(raw).browserCounts).toEqual({});
    expect(readProposalSnapshot()?.items).toEqual(payload.items);
    expect(payload.votes).toEqual({ 'demo-housing': 1 });
  } finally {
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});

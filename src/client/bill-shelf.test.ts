import { expect, test } from 'bun:test';
import { readShelf, resolveShelf, SHELF_KEY } from './bill-shelf';
import { billCollection } from '../shared/bill-catalog';
test('shelf validates bounded catalog identities and immutable revisions', () => {
  const bill = billCollection.bills[0]!;
  const entry = { id: bill.id, revision: bill.revision };
  expect(readShelf(JSON.stringify([entry]))).toEqual([entry]);
  for (const raw of ['broken', '{}', JSON.stringify([entry, entry]), JSON.stringify(Array(5).fill(entry)), JSON.stringify([{ ...entry, id: 'demo-1' }])]) expect(readShelf(raw)).toEqual([]);
  expect(resolveShelf(entry, [])).toBeUndefined();
  expect(resolveShelf({ ...entry, revision: '0'.repeat(64) }, billCollection.bills)).toBeUndefined();
  expect(resolveShelf(entry, billCollection.bills)).toEqual(bill);
  expect(SHELF_KEY).toContain('adnanwahab/dear_congress:curated-draft');
});

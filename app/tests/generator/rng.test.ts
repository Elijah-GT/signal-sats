import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../scripts/lib/rng.ts';

describe('createRng', () => {
  test('the same seed gives the same sequence', () => {
    const a = createRng('2026-11-16:PROBE');
    const b = createRng('2026-11-16:PROBE');
    assert.deepEqual(
      Array.from({ length: 5 }, () => a.next()),
      Array.from({ length: 5 }, () => b.next())
    );
  });

  test('different seeds give different sequences', () => {
    assert.notEqual(createRng('a').next(), createRng('b').next());
  });

  test('int stays within its inclusive bounds and reaches both ends', () => {
    const rng = createRng('bounds');
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const n = rng.int(2, 5);
      assert.ok(n >= 2 && n <= 5, `${n} is out of range`);
      seen.add(n);
    }
    assert.deepEqual([...seen].sort(), [2, 3, 4, 5]);
  });

  test('pick returns an item from the list and rejects an empty list', () => {
    const rng = createRng('pick');
    assert.ok(['x', 'y', 'z'].includes(rng.pick(['x', 'y', 'z'])));
    assert.throws(() => rng.pick([]), /empty list/);
  });

  test('shuffle keeps every item exactly once', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const shuffled = createRng('shuffle').shuffle(items);
    assert.deepEqual([...shuffled].sort(), items);
    assert.deepEqual(items, [1, 2, 3, 4, 5, 6]);
  });
});

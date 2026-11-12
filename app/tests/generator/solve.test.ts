import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { encode } from '../../src/shared/engine/cipher.ts';
import type { Board } from '../../src/shared/engine/types.ts';
import {
  allSettings,
  fewestTaps,
  solve,
  tapsBetween,
} from '../../scripts/lib/solve.ts';

// Source at the top of column 0, Earth along the whole bottom edge.
//   ↓
//   R . T
//   . . .
//   ═════
const board: Board = {
  width: 3,
  height: 3,
  source: { side: 'top', index: 0 },
  receiver: { side: 'bottom', from: 0, to: 2 },
  satellites: [
    { id: 'R', x: 0, y: 0, op: { kind: 'rotate' } },
    { id: 'T', x: 2, y: 0, op: { kind: 'reverse' } },
  ],
  debris: [],
};

describe('allSettings', () => {
  test('lists all 2^n distinct settings', () => {
    const list = allSettings(board);
    assert.equal(list.length, 4);
    assert.equal(new Set(list.map((s) => JSON.stringify(s))).size, 4);
  });

  test('a board with no satellites has exactly one (empty) setting', () => {
    assert.deepEqual(allSettings({ ...board, satellites: [] }), [{}]);
  });
});

describe('taps', () => {
  test('tapsBetween counts the satellites that differ', () => {
    assert.equal(tapsBetween({ R: '/', T: '/' }, { R: '/', T: '/' }), 0);
    assert.equal(tapsBetween({ R: '/', T: '/' }, { R: '\\', T: '\\' }), 2);
  });

  test('fewestTaps picks the closest target', () => {
    const from = { R: '/', T: '/' } as const;
    assert.equal(
      fewestTaps(from, [
        { R: '\\', T: '\\' },
        { R: '/', T: '\\' },
      ]),
      1
    );
  });
});

describe('solve', () => {
  const ciphertext = encode('ORBIT', [{ kind: 'rotate' }, { kind: 'reverse' }]);
  const report = solve(board, ciphertext, (w) => w === 'ORBIT');

  test('finds the answer and the only setting that produces it', () => {
    assert.deepEqual([...report.words.keys()], ['ORBIT']);
    assert.deepEqual(report.words.get('ORBIT'), [{ R: '\\', T: '\\' }]);
  });

  test('counts settings and distinct routes that reach Earth', () => {
    assert.equal(report.total, 4);
    // R '\' sends the beam right: T '\' turns it down to Earth, T '/' sends
    // it off the top. R '/' sends it off the left edge whatever T does.
    assert.equal(report.reaching, 1);
    assert.equal(report.routes, 1);
  });

  test('collects every text a player could see', () => {
    assert.ok(report.texts.has(ciphertext));
    assert.ok(report.texts.has('ORBIT'));
  });
});

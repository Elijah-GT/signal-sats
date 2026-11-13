import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOp } from '../../src/shared/engine/cipher.ts';
import {
  opsAlong,
  toOp,
  toPuzzle,
  type Design,
} from '../../scripts/lib/trayDesign.ts';
import { solveTray } from '../../scripts/lib/traySolve.ts';

const design: Design = {
  id: 'd',
  band: 'mon',
  width: 4,
  height: 4,
  source: { side: 'top', index: 1 },
  debris: [],
  storms: [{ id: 'S', x: 2, y: 2, op: 'reverse' }],
  fixed: [],
  pieces: [
    { id: 'A', swap: [4, 5] },
    { id: 'B', swap: [3, 5] },
    { id: 'C', swap: [1, 2] },
  ],
  decoys: ['C'],
  answer: 'PROBE',
  intended: ['A', 'S', 'B'],
};

describe('tray designs', () => {
  test('ops are written 1-based for swaps, or by name', () => {
    assert.deepEqual(toOp({ swap: [2, 5] }), { kind: 'trade', a: 1, b: 4 });
    assert.deepEqual(toOp({ op: 'rotate' }), { kind: 'rotate' });
  });

  test('the signal decodes along the intended order', () => {
    const puzzle = toPuzzle(design);
    const text = opsAlong(design, design.intended).reduce(
      (t, op) => applyOp(t, op),
      puzzle.ciphertext
    );
    assert.equal(text, 'PROBE');
    assert.equal(puzzle.storms[0]?.op.kind, 'reverse');
  });

  test('an unknown id in the order is an error', () => {
    assert.throws(() => opsAlong(design, ['Z']), /unknown satellite "Z"/);
  });

  test('the solver routes the beam through the storm, never needing the decoy', () => {
    const report = solveTray(toPuzzle(design));
    assert.deepEqual(report.orders, ['A>S>B']);
    assert.deepEqual(report.unusedPieces, ['C']);
  });

  test('with any text allowed, the solver lists every route', () => {
    const routes = solveTray(toPuzzle(design, []), () => true);
    assert.ok(routes.orders.length > 10);
    // Placing nothing works too: the beam falls straight into the dish.
    assert.ok(routes.orders.includes(''));
  });

  test('a puzzle with no way to the answer has par 0', () => {
    assert.equal(solveTray({ ...toPuzzle(design), answer: 'ZZZZZ' }).par, 0);
  });
});

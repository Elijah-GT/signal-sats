import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { traceBeam } from '../../src/shared/engine/beam.ts';
import type { Board } from '../../src/shared/engine/types.ts';
import {
  LAYOUT,
  beamPoints,
  boardSize,
  cellCentre,
  portPoint,
} from '../../src/shared/layout.ts';

const board: Board = {
  width: 3,
  height: 3,
  source: { side: 'top', index: 1 },
  receiver: { side: 'bottom', from: 0, to: 2 },
  satellites: [],
  debris: [],
};
const { cell, pad, top, bottom } = LAYOUT;

describe('layout', () => {
  test('boardSize leaves room for the signal above and Earth below', () => {
    assert.deepEqual(boardSize(board), {
      width: 3 * cell + 2 * pad,
      height: 3 * cell + top + bottom,
    });
  });

  test('cellCentre and portPoint line up with the grid', () => {
    const c = cellCentre({ x: 1, y: 0 });
    assert.deepEqual(portPoint(board, { side: 'top', index: 1 }, 10), {
      x: c.x,
      y: top - 10,
    });
    assert.deepEqual(portPoint(board, { side: 'bottom', index: 1 }, 10), {
      x: c.x,
      y: top + 3 * cell + 10,
    });
    const r = cellCentre({ x: 0, y: 2 });
    assert.deepEqual(portPoint(board, { side: 'left', index: 2 }, 5), {
      x: pad - 5,
      y: r.y,
    });
    assert.deepEqual(portPoint(board, { side: 'right', index: 2 }, 5), {
      x: pad + 3 * cell + 5,
      y: r.y,
    });
  });
});

describe('beamPoints', () => {
  test('a straight beam runs from above the grid down into Earth', () => {
    const points = beamPoints(board, traceBeam(board, {}));
    assert.equal(points.length, 5);
    assert.ok(points.every((p) => p.x === cellCentre({ x: 1, y: 0 }).x));
    assert.ok((points.at(-1)?.y ?? 0) > top + 3 * cell);
  });

  test('a beam lost in space ends just past the grid edge', () => {
    const withMirror: Board = {
      ...board,
      satellites: [{ id: 'S', x: 1, y: 1, op: { kind: 'reverse' } }],
    };
    const points = beamPoints(withMirror, traceBeam(withMirror, { S: '/' }));
    // '/' turns the downward beam left, off the left edge.
    assert.deepEqual(
      points.at(-1),
      portPoint(withMirror, { side: 'left', index: 1 }, pad)
    );
  });

  test('a blocked beam stops halfway into the debris cell', () => {
    const blocked: Board = { ...board, debris: [{ x: 1, y: 1 }] };
    const points = beamPoints(blocked, traceBeam(blocked, {}));
    const before = cellCentre({ x: 1, y: 0 });
    const debris = cellCentre({ x: 1, y: 1 });
    assert.deepEqual(points.at(-1), {
      x: before.x,
      y: (before.y + debris.y) / 2,
    });
  });

  test('debris on the entry cell stops the beam before the grid', () => {
    const blocked: Board = { ...board, debris: [{ x: 1, y: 0 }] };
    const points = beamPoints(blocked, traceBeam(blocked, {}));
    assert.equal(points.length, 2);
  });
});

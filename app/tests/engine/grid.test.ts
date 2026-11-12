import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  entryOf,
  exitPortOf,
  inBounds,
  portInRange,
  reachesReceiver,
  receiverInRange,
  reflect,
  samePort,
  step,
} from '../../src/shared/engine/grid.ts';

const SIZE = { width: 5, height: 6 };

describe('receiver', () => {
  const earth = { side: 'bottom', from: 0, to: 4 } as const;

  test('any point along the receiver span counts', () => {
    assert.equal(reachesReceiver({ side: 'bottom', index: 0 }, earth), true);
    assert.equal(reachesReceiver({ side: 'bottom', index: 4 }, earth), true);
  });

  test('points off the span or on another side miss', () => {
    const dish = { side: 'bottom', from: 2, to: 2 } as const;
    assert.equal(reachesReceiver({ side: 'bottom', index: 1 }, dish), false);
    assert.equal(reachesReceiver({ side: 'bottom', index: 3 }, dish), false);
    assert.equal(reachesReceiver({ side: 'left', index: 2 }, dish), false);
  });

  test('receiverInRange needs whole numbers, in order, on the grid', () => {
    assert.equal(receiverInRange(SIZE, earth), true);
    assert.equal(receiverInRange(SIZE, { side: 'left', from: 0, to: 5 }), true);
    assert.equal(
      receiverInRange(SIZE, { side: 'bottom', from: 0, to: 5 }),
      false
    );
    assert.equal(
      receiverInRange(SIZE, { side: 'bottom', from: 3, to: 2 }),
      false
    );
    assert.equal(
      receiverInRange(SIZE, { side: 'bottom', from: -1, to: 2 }),
      false
    );
    assert.equal(
      receiverInRange(SIZE, { side: 'bottom', from: 0.5, to: 2 }),
      false
    );
    assert.equal(
      receiverInRange(SIZE, { side: 'bottom', from: 0, to: 2.5 }),
      false
    );
  });
});

describe('reflect', () => {
  test('a / reflector turns right↔up and left↔down', () => {
    assert.equal(reflect('right', '/'), 'up');
    assert.equal(reflect('up', '/'), 'right');
    assert.equal(reflect('left', '/'), 'down');
    assert.equal(reflect('down', '/'), 'left');
  });

  test('a \\ reflector turns right↔down and left↔up', () => {
    assert.equal(reflect('right', '\\'), 'down');
    assert.equal(reflect('down', '\\'), 'right');
    assert.equal(reflect('left', '\\'), 'up');
    assert.equal(reflect('up', '\\'), 'left');
  });
});

describe('step and inBounds', () => {
  test('step moves one cell, with y growing downward', () => {
    assert.deepEqual(step({ x: 2, y: 2 }, 'up'), { x: 2, y: 1 });
    assert.deepEqual(step({ x: 2, y: 2 }, 'down'), { x: 2, y: 3 });
    assert.deepEqual(step({ x: 2, y: 2 }, 'left'), { x: 1, y: 2 });
    assert.deepEqual(step({ x: 2, y: 2 }, 'right'), { x: 3, y: 2 });
  });

  test('inBounds checks all four edges', () => {
    assert.equal(inBounds(SIZE, { x: 0, y: 0 }), true);
    assert.equal(inBounds(SIZE, { x: 4, y: 5 }), true);
    assert.equal(inBounds(SIZE, { x: -1, y: 0 }), false);
    assert.equal(inBounds(SIZE, { x: 5, y: 0 }), false);
    assert.equal(inBounds(SIZE, { x: 0, y: -1 }), false);
    assert.equal(inBounds(SIZE, { x: 0, y: 6 }), false);
  });
});

describe('ports', () => {
  test('entryOf gives the first cell and inward direction for each side', () => {
    assert.deepEqual(entryOf(SIZE, { side: 'top', index: 2 }), {
      cell: { x: 2, y: 0 },
      dir: 'down',
    });
    assert.deepEqual(entryOf(SIZE, { side: 'bottom', index: 2 }), {
      cell: { x: 2, y: 5 },
      dir: 'up',
    });
    assert.deepEqual(entryOf(SIZE, { side: 'left', index: 3 }), {
      cell: { x: 0, y: 3 },
      dir: 'right',
    });
    assert.deepEqual(entryOf(SIZE, { side: 'right', index: 3 }), {
      cell: { x: 4, y: 3 },
      dir: 'left',
    });
  });

  test('exitPortOf names the edge point a beam leaves through', () => {
    assert.deepEqual(exitPortOf({ x: 1, y: 0 }, 'up'), {
      side: 'top',
      index: 1,
    });
    assert.deepEqual(exitPortOf({ x: 1, y: 5 }, 'down'), {
      side: 'bottom',
      index: 1,
    });
    assert.deepEqual(exitPortOf({ x: 0, y: 4 }, 'left'), {
      side: 'left',
      index: 4,
    });
    assert.deepEqual(exitPortOf({ x: 4, y: 4 }, 'right'), {
      side: 'right',
      index: 4,
    });
  });

  test('samePort compares side and index', () => {
    assert.equal(
      samePort({ side: 'top', index: 1 }, { side: 'top', index: 1 }),
      true
    );
    assert.equal(
      samePort({ side: 'top', index: 1 }, { side: 'top', index: 2 }),
      false
    );
    assert.equal(
      samePort({ side: 'top', index: 1 }, { side: 'bottom', index: 1 }),
      false
    );
  });

  test('portInRange uses width for top/bottom and height for left/right', () => {
    assert.equal(portInRange(SIZE, { side: 'top', index: 4 }), true);
    assert.equal(portInRange(SIZE, { side: 'top', index: 5 }), false);
    assert.equal(portInRange(SIZE, { side: 'left', index: 5 }), true);
    assert.equal(portInRange(SIZE, { side: 'left', index: 6 }), false);
    assert.equal(portInRange(SIZE, { side: 'right', index: -1 }), false);
    assert.equal(portInRange(SIZE, { side: 'bottom', index: 1.5 }), false);
  });
});

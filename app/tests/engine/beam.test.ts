import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { traceBeam } from '../../src/shared/engine/beam.ts';
import type { Board } from '../../src/shared/engine/types.ts';
import { loopBoard, loopSettings } from './fixtures.ts';

const emptyBoard = (overrides: Partial<Board> = {}): Board => ({
  width: 3,
  height: 3,
  source: { side: 'top', index: 1 },
  receiver: { side: 'bottom', from: 1, to: 1 },
  satellites: [],
  debris: [],
  ...overrides,
});

describe('traceBeam', () => {
  test('a beam with nothing in its way goes straight to the receiver', () => {
    const trace = traceBeam(emptyBoard(), {});
    assert.deepEqual(trace.cells, [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ]);
    assert.deepEqual(trace.hits, []);
    assert.deepEqual(trace.end, {
      kind: 'received',
      port: { side: 'bottom', index: 1 },
    });
  });

  test('a reflector turns the beam toward or away from the receiver', () => {
    const board = emptyBoard({
      source: { side: 'left', index: 1 },
      satellites: [{ id: 'S', x: 1, y: 1, op: { kind: 'reverse' } }],
    });

    const toward = traceBeam(board, { S: '\\' });
    assert.deepEqual(toward.end, {
      kind: 'received',
      port: { side: 'bottom', index: 1 },
    });
    assert.deepEqual(
      toward.hits.map((s) => s.id),
      ['S']
    );

    const away = traceBeam(board, { S: '/' });
    assert.deepEqual(away.end, {
      kind: 'escaped',
      port: { side: 'top', index: 1 },
    });
  });

  test('debris stops the beam before the debris cell', () => {
    const trace = traceBeam(
      emptyBoard({
        source: { side: 'top', index: 0 },
        debris: [{ x: 0, y: 2 }],
      }),
      {}
    );
    assert.deepEqual(trace.cells, [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]);
    assert.deepEqual(trace.end, { kind: 'blocked', at: { x: 0, y: 2 } });
  });

  test('debris on the entry cell blocks the beam immediately', () => {
    const trace = traceBeam(emptyBoard({ debris: [{ x: 1, y: 0 }] }), {});
    assert.deepEqual(trace.cells, []);
    assert.deepEqual(trace.end, { kind: 'blocked', at: { x: 1, y: 0 } });
  });

  test('a beam can cross the same satellite twice, from different sides', () => {
    const trace = traceBeam(loopBoard, loopSettings);
    assert.deepEqual(
      trace.hits.map((s) => s.id),
      ['S', 'A', 'B', 'C', 'S']
    );
    assert.deepEqual(trace.cells, [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ]);
    assert.deepEqual(trace.end, {
      kind: 'received',
      port: { side: 'bottom', index: 1 },
    });
  });

  test('a beam that misses the receiver reports where it left the grid', () => {
    const board = emptyBoard({
      source: { side: 'left', index: 0 },
      satellites: [{ id: 'S', x: 0, y: 0, op: { kind: 'reverse' } }],
    });
    const trace = traceBeam(board, { S: '/' });
    assert.deepEqual(trace.end, {
      kind: 'escaped',
      port: { side: 'top', index: 0 },
    });
  });

  test('a satellite with no angle is a programming error', () => {
    const board = emptyBoard({
      satellites: [{ id: 'S', x: 1, y: 1, op: { kind: 'reverse' } }],
    });
    assert.throws(
      () => traceBeam(board, {}),
      /No reflector angle set for satellite "S"/
    );
  });
});

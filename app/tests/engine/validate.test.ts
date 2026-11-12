import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBoard,
  validateSettings,
} from '../../src/shared/engine/validate.ts';
import type { Board } from '../../src/shared/engine/types.ts';
import { loopBoard, loopSettings } from './fixtures.ts';

const withChanges = (changes: Partial<Board>): Board => ({
  ...loopBoard,
  ...changes,
});

describe('validateBoard', () => {
  test('a well-formed board has no errors', () => {
    assert.deepEqual(validateBoard(loopBoard), []);
  });

  test('rejects a grid without a positive whole-number size', () => {
    assert.deepEqual(validateBoard(withChanges({ width: 0 })), [
      'Width and height must be positive whole numbers',
    ]);
    assert.equal(validateBoard(withChanges({ height: 2.5 })).length, 1);
  });

  test('rejects a source or receiver off the grid', () => {
    assert.deepEqual(
      validateBoard(
        withChanges({
          source: { side: 'top', index: 9 },
          receiver: { side: 'bottom', from: 0, to: 9 },
        })
      ),
      ['Source is off the grid', 'Receiver is off the grid or runs backwards']
    );
  });

  test('rejects a source inside the receiver', () => {
    assert.deepEqual(
      validateBoard(
        withChanges({
          source: { side: 'top', index: 1 },
          receiver: { side: 'top', from: 0, to: 2 },
        })
      ),
      ['Source is inside the receiver']
    );
  });

  test('rejects satellites and debris that overlap or sit off the grid', () => {
    const errors = validateBoard(
      withChanges({
        satellites: [
          { id: 'S', x: 1, y: 1, op: { kind: 'reverse' } },
          { id: 'T', x: 1, y: 1, op: { kind: 'swap' } },
          { id: 'U', x: 3, y: 0, op: { kind: 'swap' } },
        ],
        debris: [
          { x: 1, y: 1 },
          { x: 0, y: 0.5 },
        ],
      })
    );
    assert.deepEqual(errors, [
      'Satellite "T" shares a cell with Satellite "S"',
      'Satellite "U" is off the grid',
      'Debris 1 shares a cell with Satellite "S"',
      'Debris 2 is off the grid',
    ]);
  });

  test('rejects empty or repeated satellite ids', () => {
    const errors = validateBoard(
      withChanges({
        satellites: [
          { id: '', x: 0, y: 0, op: { kind: 'reverse' } },
          { id: 'S', x: 1, y: 0, op: { kind: 'reverse' } },
          { id: 'S', x: 2, y: 0, op: { kind: 'reverse' } },
        ],
      })
    );
    assert.deepEqual(errors, [
      'A satellite has an empty id',
      'Satellite "S" id is used twice',
    ]);
  });

  test('rejects shift amounts outside 1–25', () => {
    for (const amount of [0, 26, 1.5]) {
      const errors = validateBoard(
        withChanges({
          satellites: [{ id: 'S', x: 0, y: 0, op: { kind: 'shift', amount } }],
        })
      );
      assert.deepEqual(errors, [
        'Satellite "S" has a shift amount outside 1–25',
      ]);
    }
  });
});

describe('validateSettings', () => {
  test('settings covering every satellite are valid', () => {
    assert.deepEqual(validateSettings(loopBoard, loopSettings), []);
  });

  test('reports missing and unknown satellites', () => {
    assert.deepEqual(
      validateSettings(loopBoard, { S: '/', A: '/', B: '\\', X: '/' }),
      ['Satellite "C" has no reflector angle', 'Unknown satellite "X"']
    );
  });

  test('reports angles that are not / or \\, as untrusted request JSON might contain', () => {
    const fromRequest: unknown = JSON.parse('{"S":"/","A":"/","B":"|","C":7}');
    assert.ok(fromRequest !== null && typeof fromRequest === 'object');
    assert.deepEqual(validateSettings(loopBoard, { ...fromRequest }), [
      'Satellite "B" has an invalid angle',
      'Satellite "C" has an invalid angle',
    ]);
  });
});

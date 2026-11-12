import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { encode } from '../../src/shared/engine/cipher.ts';
import { decode } from '../../src/shared/engine/decode.ts';
import type { Board } from '../../src/shared/engine/types.ts';
import { loopBoard, loopSettings } from './fixtures.ts';

// The source is at the top of column 0 and the receiver at the bottom of
// column 2. With both reflectors at '\', the beam turns right at R, then down
// at T, and reaches the receiver.
//
//   ↓
//   R . T
//   . . .
//   . . .
//       ↓
const board: Board = {
  width: 3,
  height: 3,
  source: { side: 'top', index: 0 },
  receiver: { side: 'bottom', from: 2, to: 2 },
  satellites: [
    { id: 'R', x: 0, y: 0, op: { kind: 'rotate' } },
    { id: 'T', x: 2, y: 0, op: { kind: 'reverse' } },
  ],
  debris: [],
};

const ciphertext = encode('ORBIT', [{ kind: 'rotate' }, { kind: 'reverse' }]);

describe('decode', () => {
  test('the right route turns the ciphertext into the answer', () => {
    const result = decode(board, { R: '\\', T: '\\' }, ciphertext);

    assert.equal(result.output, 'ORBIT');
    assert.deepEqual(
      result.steps.map((s) => s.satelliteId),
      ['R', 'T']
    );
    assert.equal(result.steps[0]?.before, ciphertext);
    assert.equal(result.steps.at(-1)?.after, 'ORBIT');
  });

  test('a wrong route still shows the steps but has no output', () => {
    // R at '/' turns the downward beam left, straight off the grid.
    const result = decode(board, { R: '/', T: '\\' }, ciphertext);

    assert.equal(result.output, null);
    assert.equal(result.trace.end.kind, 'escaped');
    assert.deepEqual(
      result.steps.map((s) => s.satelliteId),
      ['R']
    );
  });

  test('a satellite crossed twice applies its op twice', () => {
    const result = decode(loopBoard, loopSettings, 'ABCDE');
    assert.deepEqual(
      result.steps.map((s) => s.op.kind),
      ['rotate', 'swap', 'reverse', 'shift', 'rotate']
    );
    for (let i = 1; i < result.steps.length; i++) {
      assert.equal(result.steps[i]?.before, result.steps[i - 1]?.after);
    }
    assert.equal(result.output, result.steps.at(-1)?.after);
  });

  test('a beam that hits nothing delivers the ciphertext unchanged', () => {
    const straight: Board = {
      ...board,
      satellites: [],
      receiver: { side: 'bottom', from: 0, to: 0 },
    };
    const result = decode(straight, {}, 'NOISE');
    assert.equal(result.output, 'NOISE');
    assert.deepEqual(result.steps, []);
  });
});

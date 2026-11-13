import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { traceBeam } from '../../src/shared/engine/beam.ts';
import { applyOp, permute, unapplyOp } from '../../src/shared/engine/cipher.ts';
import { decode } from '../../src/shared/engine/decode.ts';
import { validateBoard } from '../../src/shared/engine/validate.ts';
import type { Board, CipherOp } from '../../src/shared/engine/types.ts';

const board = (overrides: Partial<Board> = {}): Board => ({
  width: 3,
  height: 3,
  source: { side: 'top', index: 1 },
  receiver: { side: 'bottom', from: 0, to: 2 },
  satellites: [],
  debris: [],
  ...overrides,
});

describe('storms', () => {
  test('the beam passes straight through a storm and it counts as a hit', () => {
    const storm = { id: 'S', x: 1, y: 1, op: { kind: 'reverse' } as const };
    const trace = traceBeam(board({ storms: [storm] }), {});
    assert.equal(trace.cells.length, 3);
    assert.deepEqual(trace.hits, [storm]);
    assert.equal(trace.end.kind, 'received');
  });

  test('a storm changes the text like a satellite does', () => {
    const result = decode(
      board({
        storms: [{ id: 'S', x: 1, y: 2, op: { kind: 'rotate' } }],
        satellites: [
          { id: 'A', x: 1, y: 0, op: { kind: 'trade', a: 0, b: 1 } },
          { id: 'B', x: 2, y: 0, op: { kind: 'reverse' } },
        ],
      }),
      { A: '\\', B: '\\' },
      'ABCDE'
    );
    // A turns the beam right into B, which turns it down column 2: no storm.
    assert.deepEqual(
      result.steps.map((s) => s.satelliteId),
      ['A', 'B']
    );
    assert.equal(result.output, 'EDCAB');
  });

  test('validation checks storms like satellites', () => {
    const errors = validateBoard(
      board({
        satellites: [{ id: 'A', x: 0, y: 0, op: { kind: 'reverse' } }],
        storms: [
          { id: 'A', x: 0, y: 0, op: { kind: 'reverse' } },
          { id: 'T', x: 5, y: 0, op: { kind: 'reverse' } },
          { id: 'U', x: 2, y: 2, op: { kind: 'trade', a: 2, b: 2 } },
        ],
      })
    );
    assert.deepEqual(errors, [
      'Storm "A" id is used twice',
      'Storm "A" shares a cell with Satellite "A"',
      'Storm "T" is off the grid',
      'Storm "U" must swap two different letter positions',
    ]);
    assert.deepEqual(
      validateBoard(
        board({ storms: [{ id: 'S', x: 1, y: 1, op: { kind: 'rotate' } }] })
      ),
      []
    );
  });
});

describe('permute', () => {
  const items = [0, 1, 2, 3, 4];
  const cases: [CipherOp, number[]][] = [
    [{ kind: 'reverse' }, [4, 3, 2, 1, 0]],
    [{ kind: 'rotate' }, [1, 2, 3, 4, 0]],
    [{ kind: 'swap' }, [1, 0, 3, 2, 4]],
    [{ kind: 'trade', a: 1, b: 3 }, [0, 3, 2, 1, 4]],
    [{ kind: 'trade', a: 1, b: 7 }, [0, 1, 2, 3, 4]],
    [{ kind: 'shift', amount: 3 }, [0, 1, 2, 3, 4]],
    [{ kind: 'mirror' }, [0, 1, 2, 3, 4]],
  ];
  for (const [op, expected] of cases) {
    test(`${JSON.stringify(op)} moves places the way it moves letters`, () => {
      assert.deepEqual(permute(items, op), expected);
      if (op.kind !== 'shift' && op.kind !== 'mirror') {
        assert.equal(
          applyOp('ABCDE', op),
          expected.map((i) => 'ABCDE'.charAt(i)).join('')
        );
      }
      assert.equal(unapplyOp(applyOp('ABCDE', op), op), 'ABCDE');
    });
  }

  test('rotate leaves a single item alone', () => {
    assert.deepEqual(permute(['A'], { kind: 'rotate' }), ['A']);
  });
});

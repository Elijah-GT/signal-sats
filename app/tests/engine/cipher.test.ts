import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOp,
  encode,
  opName,
  opSymbol,
  unapplyOp,
} from '../../src/shared/engine/cipher.ts';
import type { CipherOp } from '../../src/shared/engine/types.ts';

describe('op labels', () => {
  test('every op has a symbol and a name', () => {
    const ops: CipherOp[] = [
      { kind: 'reverse' },
      { kind: 'swap' },
      { kind: 'rotate' },
      { kind: 'shift', amount: 2 },
      { kind: 'mirror' },
      { kind: 'trade', a: 0, b: 3 },
    ];
    assert.deepEqual(
      ops.map((op) => `${opSymbol(op)} ${opName(op)}`),
      [
        '⇄ Reverse',
        '⤨ Swap pairs',
        '↻ Rotate',
        '+2 Shift +2',
        '◐ Mirror',
        '1⇄4 Swap letters 1 and 4',
      ]
    );
  });
});

const ALL_OPS: CipherOp[] = [
  { kind: 'reverse' },
  { kind: 'swap' },
  { kind: 'rotate' },
  { kind: 'shift', amount: 1 },
  { kind: 'shift', amount: 13 },
  { kind: 'shift', amount: 25 },
  { kind: 'mirror' },
];

const SAMPLES = ['ORBIT', 'SIGNAL', 'AB', 'A', ''];

describe('applyOp', () => {
  test('matches the design doc examples for ORBIT', () => {
    assert.equal(applyOp('ORBIT', { kind: 'reverse' }), 'TIBRO');
    assert.equal(applyOp('ORBIT', { kind: 'swap' }), 'ROIBT');
    assert.equal(applyOp('ORBIT', { kind: 'rotate' }), 'RBITO');
    assert.equal(applyOp('ORBIT', { kind: 'shift', amount: 1 }), 'PSCJU');
    assert.equal(applyOp('ORBIT', { kind: 'mirror' }), 'LIYRG');
  });

  test('swap swaps every pair in even-length text', () => {
    assert.equal(applyOp('ABCD', { kind: 'swap' }), 'BADC');
  });

  test('shift wraps from Z back to A', () => {
    assert.equal(applyOp('XYZ', { kind: 'shift', amount: 3 }), 'ABC');
  });

  test('shift and mirror leave non-letters alone', () => {
    assert.equal(applyOp('A-1 Z', { kind: 'shift', amount: 1 }), 'B-1 A');
    assert.equal(applyOp('A-Z', { kind: 'mirror' }), 'Z-A');
  });

  test('every op handles empty and one-letter text', () => {
    for (const op of ALL_OPS) {
      assert.equal(applyOp('', op), '');
    }
    assert.equal(applyOp('A', { kind: 'rotate' }), 'A');
    assert.equal(applyOp('A', { kind: 'swap' }), 'A');
  });
});

describe('unapplyOp', () => {
  test('undoes every op on every sample', () => {
    for (const op of ALL_OPS) {
      for (const text of SAMPLES) {
        assert.equal(
          unapplyOp(applyOp(text, op), op),
          text,
          `${op.kind} on "${text}"`
        );
      }
    }
  });

  test('rotate is undone by moving the last letter to the front', () => {
    assert.equal(unapplyOp('RBITO', { kind: 'rotate' }), 'ORBIT');
  });
});

describe('encode', () => {
  test('builds ciphertext that decodes back to the answer through the ops in order', () => {
    const ops: CipherOp[] = [
      { kind: 'rotate' },
      { kind: 'swap' },
      { kind: 'shift', amount: 4 },
      { kind: 'reverse' },
    ];
    const ciphertext = encode('ORBIT', ops);
    assert.notEqual(ciphertext, 'ORBIT');
    const decoded = ops.reduce((text, op) => applyOp(text, op), ciphertext);
    assert.equal(decoded, 'ORBIT');
  });

  test('order matters: swap then reverse differs from reverse then swap', () => {
    const a = encode('ORBIT', [{ kind: 'swap' }, { kind: 'reverse' }]);
    const b = encode('ORBIT', [{ kind: 'reverse' }, { kind: 'swap' }]);
    assert.notEqual(a, b);
  });

  test('no ops leaves the text unchanged', () => {
    assert.equal(encode('ORBIT', []), 'ORBIT');
  });
});

describe('trade', () => {
  const op: CipherOp = { kind: 'trade', a: 1, b: 3 };

  test('swaps the letters at two positions, and undoing it swaps them back', () => {
    assert.equal(applyOp('ABCDE', op), 'ADCBE');
    assert.equal(unapplyOp('ADCBE', op), 'ABCDE');
  });

  test('positions past the end leave the text alone', () => {
    assert.equal(applyOp('AB', op), 'AB');
    assert.equal(applyOp('ABCDE', { kind: 'trade', a: 2, b: 2 }), 'ABCDE');
  });

  test('is labelled with 1-based letter positions', () => {
    assert.equal(opSymbol(op), '2⇄4');
    assert.equal(opName(op), 'Swap letters 2 and 4');
  });

  test('order matters when two swaps share a letter', () => {
    const first: CipherOp = { kind: 'trade', a: 0, b: 1 };
    const second: CipherOp = { kind: 'trade', a: 1, b: 2 };
    assert.notEqual(
      applyOp(applyOp('ABC', first), second),
      applyOp(applyOp('ABC', second), first)
    );
    assert.equal(encode('PROBE', [first, second]), 'OPRBE');
    assert.equal(applyOp(applyOp('OPRBE', first), second), 'PROBE');
  });
});

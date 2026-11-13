import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANSWERS } from '../../src/shared/answers.ts';
import { validateBoard } from '../../src/shared/engine/validate.ts';
import {
  trayBoard,
  newTrayGame,
  type TrayPuzzle,
} from '../../src/shared/tray.ts';
import {
  DAILY,
  generateTray,
  PRACTICE,
  type TraySpec,
} from '../../src/shared/trayGen.ts';
import { solveTray } from '../../src/shared/traySolve.ts';

const check = (puzzle: TrayPuzzle, spec: TraySpec) => {
  const report = solveTray(puzzle);
  assert.ok(report.orders.length >= 1, 'it can be solved');
  assert.ok(report.orders.length <= spec.maxOrders, 'not too loose');
  assert.equal(report.par, puzzle.par);
  assert.ok(puzzle.par >= spec.pieces, 'no shortcut past needed pieces');
  assert.equal(puzzle.pieces.length, spec.pieces + spec.decoys);
  assert.equal(puzzle.storms.length, spec.storms);
  assert.equal(puzzle.fixed.length, spec.fixed);
  assert.equal(puzzle.debris.length, spec.debris);
  assert.notEqual(puzzle.ciphertext, puzzle.answer);
  assert.deepEqual(validateBoard(trayBoard(puzzle, newTrayGame()).board), []);
};

describe('generateTray', () => {
  for (const [name, spec] of Object.entries(PRACTICE)) {
    test(`builds ${name} practice puzzles to spec`, () => {
      for (const seed of ['a', 'b']) check(generateTray(spec, seed), spec);
    });
  }

  test('the same seed always gives the same puzzle', () => {
    assert.deepEqual(
      generateTray(PRACTICE.medium, 'same'),
      generateTray(PRACTICE.medium, 'same')
    );
  });

  test('uses the given word, id and day, or a word from the list', () => {
    const named = generateTray(PRACTICE.easy, 'x', {
      answer: 'COMET',
      id: 'mine',
      band: 'fri',
    });
    assert.equal(named.answer, 'COMET');
    assert.equal(named.id, 'mine');
    assert.equal(named.band, 'fri');
    assert.ok(ANSWERS.includes(generateTray(PRACTICE.easy, 'y').answer));
  });

  test('every puzzle has a Reverse or Rotate satellite and a storm', () => {
    for (const spec of Object.values(PRACTICE)) {
      const p = generateTray(spec, 'kinds');
      const kinds = [...p.pieces, ...p.fixed].map((s) => s.op.kind);
      assert.ok(kinds.some((k) => k === 'reverse' || k === 'rotate'));
      assert.ok(p.storms.length > 0);
    }
  });

  test('an odd number of route satellites is refused', () => {
    assert.throws(
      () => generateTray({ ...PRACTICE.easy, pieces: 3 }, 'odd'),
      /even number of satellites/
    );
  });

  test('gives up on a spec nothing can meet', () => {
    // No room on a 1-wide board for two satellites and a storm.
    assert.throws(
      () => generateTray({ ...PRACTICE.easy, width: 1, height: 2 }, 'tiny'),
      /No puzzle found/
    );
  });

  test('the answer list is all five-letter capitals', () => {
    for (const word of ANSWERS) assert.match(word, /^[A-Z]{5}$/);
  });
});

describe('the generated dailies', () => {
  test('match each day’s spec', () => {
    const week: TrayPuzzle[] = JSON.parse(
      readFileSync('content/tray/puzzles.json', 'utf8')
    );
    assert.equal(week.length, 7);
    for (const p of week) check(p, DAILY[p.band]);
  });
});

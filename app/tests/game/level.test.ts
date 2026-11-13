import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allCells,
  applyTool,
  compileLevel,
  emptyLevel,
  fromCode,
  rateLevel,
  resizeLevel,
  toCode,
  turnSat,
  type Level,
  type Tool,
} from '../../src/shared/level.ts';
import { generateTray, PRACTICE } from '../../src/shared/trayGen.ts';
import { solveTray } from '../../src/shared/traySolve.ts';

const swap = (a: number, b: number): Tool => ({
  kind: 'sat',
  op: { kind: 'trade', a, b },
  bolted: false,
});

/**
 * A 4×4 level: the signal comes down column 1, a satellite at (1,1) turned to
 * send it right, and one at (3,1) turned to send it back down.
 */
const built = (): Level => {
  let level: Level = { ...emptyLevel(), width: 4, height: 4, source: 1 };
  level = applyTool(level, { x: 1, y: 1 }, swap(0, 1));
  level = applyTool(
    level,
    { x: 3, y: 1 },
    {
      kind: 'sat',
      op: { kind: 'reverse' },
      bolted: false,
    }
  );
  for (const s of level.sats) level = turnSat(level, s.id);
  return { ...level, answer: 'probe' };
};

describe('editing a level', () => {
  test('tools place, replace and erase things', () => {
    let level = applyTool(emptyLevel(), { x: 0, y: 0 }, { kind: 'debris' });
    assert.equal(level.debris.length, 1);
    level = applyTool(
      level,
      { x: 0, y: 0 },
      {
        kind: 'storm',
        op: { kind: 'rotate' },
      }
    );
    assert.equal(level.debris.length, 0);
    assert.equal(level.storms.length, 1);
    level = applyTool(level, { x: 0, y: 0 }, swap(0, 2));
    assert.equal(level.storms.length, 0);
    assert.equal(level.sats[0]?.angle, '/');
    level = applyTool(level, { x: 0, y: 0 }, { kind: 'erase' });
    assert.equal(level.sats.length, 0);
    assert.equal(applyTool(level, { x: 9, y: 0 }, { kind: 'debris' }), level);
  });

  test('each new thing gets its own id', () => {
    let level = applyTool(emptyLevel(), { x: 0, y: 0 }, swap(0, 1));
    level = applyTool(level, { x: 1, y: 0 }, swap(0, 2));
    level = applyTool(
      level,
      { x: 2, y: 0 },
      {
        kind: 'storm',
        op: { kind: 'reverse' },
      }
    );
    const ids = [...level.sats, ...level.storms].map((s) => s.id);
    assert.equal(new Set(ids).size, 3);
  });

  test('turning a mirror flips it each time', () => {
    let level = applyTool(emptyLevel(), { x: 0, y: 0 }, swap(0, 1));
    const id = level.sats[0]?.id ?? '';
    level = turnSat(level, id);
    assert.equal(level.sats[0]?.angle, '\\');
    assert.equal(turnSat(level, id).sats[0]?.angle, '/');
  });

  test('shrinking the board drops what no longer fits', () => {
    let level = applyTool(emptyLevel(), { x: 4, y: 4 }, { kind: 'debris' });
    level = applyTool(level, { x: 4, y: 0 }, swap(0, 1));
    level = applyTool(
      level,
      { x: 0, y: 4 },
      {
        kind: 'storm',
        op: { kind: 'rotate' },
      }
    );
    level = { ...level, source: 4 };
    const small = resizeLevel(level, 3, 3);
    assert.deepEqual(
      [small.debris.length, small.sats.length, small.storms.length],
      [0, 0, 0]
    );
    assert.equal(small.source, 2);
    assert.equal(allCells(small).length, 9);
  });
});

describe('compiling a level', () => {
  test('a finished level becomes a puzzle its own solution solves', () => {
    const { puzzle, problems, texts } = compileLevel(built(), 'mine');
    assert.deepEqual(problems, []);
    assert.ok(puzzle);
    assert.equal(puzzle.answer, 'PROBE');
    assert.equal(texts.at(-1), 'PROBE');
    assert.deepEqual(
      puzzle.pieces.map((p) => p.id),
      ['A', 'B']
    );
    assert.ok(solveTray(puzzle).orders.includes('A>B'));
  });

  test('bolted satellites and storms keep their places, renamed for players', () => {
    let level = built();
    level = applyTool(
      level,
      { x: 0, y: 3 },
      {
        kind: 'sat',
        op: { kind: 'rotate' },
        bolted: true,
      }
    );
    level = applyTool(
      level,
      { x: 3, y: 3 },
      {
        kind: 'storm',
        op: { kind: 'reverse' },
      }
    );
    const { puzzle } = compileLevel(level);
    assert.deepEqual(
      puzzle?.fixed.map((f) => [f.id, f.x, f.y]),
      [['F1', 0, 3]]
    );
    assert.deepEqual(
      puzzle?.storms.map((s) => s.id),
      ['S1']
    );
  });

  test('lists everything stopping it being played', () => {
    const { problems, puzzle, ciphertext } = compileLevel(emptyLevel());
    assert.equal(puzzle, null);
    assert.equal(ciphertext, null);
    assert.deepEqual(problems, [
      'Type a five-letter word to hide.',
      'Put at least one movable satellite on the beam.',
    ]);
  });

  test('the beam has to reach the dish', () => {
    let level = built();
    level = turnSat(level, level.sats[1]?.id ?? '');
    assert.ok(
      compileLevel(level).problems.includes(
        'The beam has to come down into the dish.'
      )
    );
  });

  test('a signal that arrives already unscrambled is refused', () => {
    let level: Level = {
      ...emptyLevel(),
      answer: 'ABCDE',
      width: 3,
      height: 3,
      source: 0,
    };
    level = applyTool(level, { x: 0, y: 0 }, swap(0, 1));
    level = applyTool(level, { x: 1, y: 0 }, swap(0, 1));
    for (const s of level.sats) level = turnSat(level, s.id);
    assert.ok(
      compileLevel(level).problems.some((p) =>
        p.includes('already unscrambled')
      )
    );
  });

  test('too many movable satellites is refused', () => {
    let level = built();
    for (let x = 0; x < 4; x++) {
      level = applyTool(level, { x, y: 3 }, swap(1, 2));
    }
    assert.ok(
      compileLevel(level).problems.includes('Use at most 5 movable satellites.')
    );
  });
});

describe('rating and sharing', () => {
  test('rates a small level and gives par', () => {
    const { puzzle } = compileLevel(built());
    assert.ok(puzzle);
    const rating = rateLevel(puzzle);
    // The maker's build takes 4 moves (two placed, both turned); the solver
    // finds a cheaper one with both facing "/".
    assert.equal(rating.par, 2);
    assert.ok(rating.orders >= 1);
    assert.ok(rating.layouts >= rating.orders);
    assert.notEqual(rating.difficulty, 'Hard');
  });

  test('one way to win with three pieces rates Hard', () => {
    assert.equal(
      rateLevel(generateTray(PRACTICE.hard, 'rate')).difficulty,
      'Hard'
    );
  });

  test('one piece rates Easy', () => {
    const puzzle = generateTray(PRACTICE.easy, 'rate');
    const one = { ...puzzle, pieces: puzzle.pieces.slice(0, 1) };
    assert.equal(rateLevel(one).difficulty, 'Easy');
  });

  test('a share code reads back as the same puzzle', () => {
    const { puzzle } = compileLevel(built(), 'x');
    assert.ok(puzzle);
    const code = toCode({ ...puzzle, par: 4 });
    assert.match(code, /^[A-Za-z0-9_-]+$/);
    assert.deepEqual(fromCode(code), { ...puzzle, par: 4 });
  });

  test('bad codes are refused', () => {
    const { puzzle } = compileLevel(built());
    assert.ok(puzzle);
    const bad = (p: object) => toCode({ ...puzzle, ...p });
    for (const code of [
      'not base64!!',
      btoa('[1,2]'),
      bad({ width: 9 }),
      bad({ answer: 'no' }),
      bad({ pieces: [{ id: 'A', op: { kind: 'trade', a: 3, b: 1 } }] }),
      bad({ pieces: [{ id: 'A', op: { kind: 'shout' } }] }),
      bad({ pieces: [{ id: 'A', op: 'reverse' }] }),
      bad({
        debris: [
          { x: 1, y: 0 },
          { x: 1, y: 0 },
        ],
      }),
      bad({ source: { side: 'left', index: 0 } }),
    ]) {
      assert.equal(fromCode(code), null, code);
    }
    // A code without a usable id still loads.
    assert.equal(fromCode(toCode({ ...puzzle, par: 1 }))?.par, 1);
    assert.equal(fromCode(bad({ id: 7 }))?.id, 'shared');
  });
});

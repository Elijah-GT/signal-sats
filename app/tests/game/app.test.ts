import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ANSWERS } from '../../src/shared/answers.ts';
import {
  addDays,
  bandOf,
  currentStreak,
  dailyNumber,
  dailyPuzzle,
  dailyTitle,
  dailyWord,
  dayOf,
  extendStreak,
  FIRST_DAY,
  isDate,
} from '../../src/shared/daily.ts';
import { parsePuzzle, toCode, fromCode } from '../../src/shared/level.ts';
import {
  isValidLayout,
  toPublic,
  trayDecode,
  type TrayPuzzle,
} from '../../src/shared/tray.ts';
import { DAILY } from '../../src/shared/trayGen.ts';
import { solveTray } from '../../src/shared/traySolve.ts';

describe('daily dates', () => {
  test('days run on UTC', () => {
    assert.equal(dayOf(new Date('2026-11-13T23:59:59Z')), '2026-11-13');
    assert.equal(dayOf(new Date('2026-11-14T00:00:00Z')), '2026-11-14');
  });

  test('adding days crosses months and years', () => {
    assert.equal(addDays('2026-11-30', 1), '2026-12-01');
    assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  });

  test('only real dates count', () => {
    assert.equal(isDate('2026-11-13'), true);
    assert.equal(isDate('2026-02-30'), false);
    assert.equal(isDate('13/11/2026'), false);
  });

  test('the weekday sets the difficulty band', () => {
    assert.equal(bandOf('2026-11-13'), 'fri');
    assert.equal(bandOf('2026-11-15'), 'sun');
    assert.equal(bandOf('2026-11-16'), 'mon');
  });

  test('puzzles are numbered from the first day', () => {
    assert.equal(dailyNumber(FIRST_DAY), 1);
    assert.equal(dailyNumber('2026-11-13'), 13);
  });

  test('titles name the number and the day', () => {
    assert.equal(dailyTitle('2026-11-13'), 'Signal Sats #13 · Fri, Nov 13');
  });
});

describe('daily words and puzzles', () => {
  test('no word repeats until the whole list is used', () => {
    const words = Array.from({ length: ANSWERS.length }, (_, i) =>
      dailyWord(addDays(FIRST_DAY, i))
    );
    assert.equal(new Set(words).size, ANSWERS.length);
    // Dates before day 1 still get a word.
    assert.ok(ANSWERS.includes(dailyWord('2026-01-01')));
  });

  test('each day builds the same puzzle every time, to that day’s spec', () => {
    const date = '2026-11-18';
    const puzzle = dailyPuzzle(date);
    assert.deepEqual(dailyPuzzle(date), puzzle);
    assert.equal(puzzle.band, 'wed');
    assert.equal(puzzle.answer, dailyWord(date));
    const orders = solveTray(puzzle).orders.length;
    assert.ok(orders >= 1 && orders <= DAILY.wed.maxOrders);
  });

  test('a stored daily reads back with its day intact', () => {
    const puzzle = dailyPuzzle('2026-11-22');
    assert.deepEqual(parsePuzzle(JSON.parse(JSON.stringify(puzzle))), puzzle);
    assert.equal(fromCode(toCode(puzzle))?.band, 'sun');
  });
});

describe('streaks', () => {
  test('solving on consecutive days builds a streak', () => {
    let s = extendStreak(null, '2026-11-13');
    assert.deepEqual(s, { count: 1, last: '2026-11-13' });
    s = extendStreak(s, '2026-11-14');
    assert.equal(s.count, 2);
    assert.equal(extendStreak(s, '2026-11-14'), s);
  });

  test('missing a day starts it again', () => {
    const s = { count: 5, last: '2026-11-10' };
    assert.deepEqual(extendStreak(s, '2026-11-13'), {
      count: 1,
      last: '2026-11-13',
    });
  });

  test('a streak stays alive until a whole day is missed', () => {
    const s = { count: 3, last: '2026-11-12' };
    assert.equal(currentStreak(s, '2026-11-12'), 3);
    assert.equal(currentStreak(s, '2026-11-13'), 3);
    assert.equal(currentStreak(s, '2026-11-14'), 0);
    assert.equal(currentStreak(null, '2026-11-14'), 0);
  });
});

describe('what players get and send', () => {
  const puzzle: TrayPuzzle = dailyPuzzle('2026-11-16');

  test('players never get the answer', () => {
    const pub = toPublic(puzzle);
    assert.equal('answer' in pub, false);
    assert.equal(JSON.stringify(pub).includes(puzzle.answer), false);
    assert.equal(pub.ciphertext, puzzle.ciphertext);
  });

  test("the solver's layout passes the server check and decodes the word", () => {
    const solution = solveTray(puzzle).solutions[0];
    assert.ok(solution);
    assert.equal(isValidLayout(puzzle, solution.placements), true);
    const { output } = trayDecode(puzzle, {
      placed: solution.placements,
      selected: null,
      moves: 0,
    });
    assert.equal(output, puzzle.answer);
  });

  test('impossible layouts are refused', () => {
    const piece = puzzle.pieces[0]?.id ?? 'A';
    const other = puzzle.pieces[1]?.id ?? 'B';
    const debris = puzzle.debris[0];
    const storm = puzzle.storms[0];
    const bad: unknown[] = [
      null,
      [],
      { Z: { x: 0, y: 0, angle: '/' } },
      { [piece]: 'here' },
      { [piece]: { x: 9, y: 0, angle: '/' } },
      { [piece]: { x: -1, y: 0, angle: '/' } },
      { [piece]: { x: 0.5, y: 0, angle: '/' } },
      { [piece]: { x: 0, y: 0, angle: '|' } },
      {
        [piece]: { x: 0, y: 0, angle: '/' },
        [other]: { x: 0, y: 0, angle: '/' },
      },
      ...(storm ? [{ [piece]: { x: storm.x, y: storm.y, angle: '/' } }] : []),
      ...(debris
        ? [{ [piece]: { x: debris.x, y: debris.y, angle: '/' } }]
        : []),
    ];
    for (const layout of bad) {
      assert.equal(
        isValidLayout(puzzle, layout),
        false,
        JSON.stringify(layout)
      );
    }
    assert.equal(isValidLayout(puzzle, {}), true);
  });
});

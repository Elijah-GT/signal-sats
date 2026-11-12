import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { traceBeam } from '../../src/shared/engine/beam.ts';
import { decode } from '../../src/shared/engine/decode.ts';
import {
  validateBoard,
  validateSettings,
} from '../../src/shared/engine/validate.ts';
import type { DayBand } from '../../src/shared/puzzle.ts';
import { BANDS, addDays, bandForDate } from '../../scripts/lib/bands.ts';
import { generatePuzzle } from '../../scripts/lib/generate.ts';
import { fewestTaps, solve } from '../../scripts/lib/solve.ts';
import {
  createBlocklist,
  loadFiveLetterWords,
} from '../../scripts/lib/words.ts';

let isWord: (text: string) => boolean = () => false;
let isBlocked: (text: string) => boolean = () => false;

before(() => {
  const dictionary = loadFiveLetterWords();
  isWord = (text) => dictionary.has(text);
  isBlocked = createBlocklist();
});

const WEEK = ['PROBE', 'AWAKE', 'RADIO', 'ORBIT', 'LIGHT', 'VOICE', 'EARTH'];

describe('generatePuzzle', () => {
  test('builds a valid puzzle for every weekday that meets its band', () => {
    for (const [day, answer] of WEEK.entries()) {
      const date = addDays('2026-11-16', day);
      const band: DayBand = bandForDate(date);
      const spec = BANDS[band];
      const puzzle = generatePuzzle({
        answer,
        date,
        week: 'test',
        band,
        isWord,
        isBlocked,
      });
      const { board } = puzzle;

      assert.deepEqual(validateBoard(board), [], `${band}: board`);
      assert.deepEqual(
        validateSettings(board, puzzle.start),
        [],
        `${band}: start`
      );
      assert.deepEqual(
        validateSettings(board, puzzle.solution),
        [],
        `${band}: solution`
      );

      // The solution decodes to the answer through each satellite once.
      const result = decode(board, puzzle.solution, puzzle.ciphertext);
      assert.equal(result.output, answer, `${band}: solution output`);
      const hits = traceBeam(board, puzzle.solution).hits;
      const path = hits.map((s) => s.id);
      assert.equal(new Set(path).size, path.length, `${band}: no repeats`);
      assert.ok(
        (hits[0]?.y ?? board.height) < board.height / 2,
        `${band}: first turn in the upper half`
      );
      assert.ok(
        path.length >= spec.pathLength[0] && path.length <= spec.pathLength[1]
      );
      assert.ok(
        board.satellites.length - path.length >= spec.minDecoys,
        `${band}: decoys`
      );

      // The answer is the only real word, and the start needs work.
      const report = solve(board, puzzle.ciphertext, isWord);
      assert.deepEqual(
        [...report.words.keys()],
        [answer],
        `${band}: unique word`
      );
      assert.ok(report.routes >= spec.minRoutes, `${band}: routes`);
      const solving = report.words.get(answer) ?? [];
      assert.ok(
        fewestTaps(puzzle.start, solving) >= spec.minTaps,
        `${band}: taps`
      );
      assert.ok(![...report.texts].some(isBlocked), `${band}: clean text`);

      assert.equal(puzzle.week, 'test');
      assert.equal(puzzle.stats.routes, report.routes);
    }
  });

  test('is reproducible: the same date and answer give the same puzzle', () => {
    const input = {
      answer: 'ORBIT',
      date: '2026-11-19',
      week: 'w',
      band: 'thu',
      isWord,
      isBlocked,
    } as const;
    assert.deepEqual(generatePuzzle(input), generatePuzzle(input));
  });

  test('rejects an answer that is not 5 capital letters or not a word', () => {
    const base = {
      date: '2026-11-16',
      week: 'w',
      band: 'mon',
      isWord,
      isBlocked,
    } as const;
    assert.throws(
      () => generatePuzzle({ ...base, answer: 'orbit' }),
      /5 capital letters/
    );
    assert.throws(
      () => generatePuzzle({ ...base, answer: 'SIGNAL' }),
      /5 capital letters/
    );
    assert.throws(
      () => generatePuzzle({ ...base, answer: 'QXZVK' }),
      /not in the dictionary/
    );
  });

  test('gives up with a clear error when the rules cannot be met', () => {
    const impossible = { ...BANDS.mon, pathLength: [3, 3] } as const;
    assert.throws(
      () =>
        generatePuzzle({
          answer: 'PROBE',
          date: '2026-11-16',
          week: 'w',
          band: 'mon',
          isWord,
          isBlocked,
          spec: impossible,
          maxAttempts: 200,
        }),
      /No valid puzzle for PROBE on 2026-11-16 after 200 attempts/
    );
  });

  test('never accepts a board where an offensive word could appear', () => {
    assert.throws(
      () =>
        generatePuzzle({
          answer: 'PROBE',
          date: '2026-11-16',
          week: 'w',
          band: 'mon',
          isWord,
          isBlocked: () => true,
          maxAttempts: 2000,
        }),
      /No valid puzzle/
    );
  });
});

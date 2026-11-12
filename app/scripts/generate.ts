// Generates a week of daily puzzles from a week file.
//
//   npm run puzzles:generate -- content/weeks/<id>.json [--out <dir>] [--force]
//
// Writes one content/puzzles/<date>.json per day. Existing files are kept
// unless --force is passed, so a published puzzle never changes by accident.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { addDays, bandForDate } from './lib/bands.ts';
import { generatePuzzle } from './lib/generate.ts';
import { parseWeek } from './lib/week.ts';
import { createBlocklist, loadFiveLetterWords } from './lib/words.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', default: 'content/puzzles' },
    force: { type: 'boolean', default: false },
  },
});

const weekPath = positionals[0];
if (!weekPath) {
  console.error(
    'Usage: npm run puzzles:generate -- <week file> [--out <dir>] [--force]'
  );
  process.exit(1);
}

const dictionary = loadFiveLetterWords();
const isWord = (text: string): boolean => dictionary.has(text);
const isBlocked = createBlocklist();
const week = parseWeek(JSON.parse(readFileSync(weekPath, 'utf8')), isWord);

mkdirSync(values.out, { recursive: true });
console.log(`Week "${week.id}": ${week.message}\n`);

for (const [day, answer] of week.words.entries()) {
  const date = addDays(week.start, day);
  const file = path.join(values.out, `${date}.json`);
  if (existsSync(file) && !values.force) {
    console.error(`${file} already exists. Pass --force to replace it.`);
    process.exitCode = 1;
    continue;
  }
  const started = Date.now();
  const puzzle = generatePuzzle({
    answer,
    date,
    week: week.id,
    band: bandForDate(date),
    isWord,
    isBlocked,
  });
  writeFileSync(file, `${JSON.stringify(puzzle, null, 2)}\n`);
  const { stats } = puzzle;
  console.log(
    `${date} ${puzzle.band}  ${puzzle.ciphertext} → ${answer}  ` +
      `${stats.satellites} satellites, ${stats.routes} routes, ` +
      `${stats.minTaps} taps, ops ${stats.opKinds.join('+')}  ` +
      `(${Date.now() - started} ms)`
  );
}

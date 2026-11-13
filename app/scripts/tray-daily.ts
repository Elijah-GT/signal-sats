// Builds a week of daily tray puzzles with the generator.
//
//   npm run tray:daily
//
// Each day has its own difficulty (DAILY in src/shared/trayGen.ts) and word,
// seeded by date so a rebuild gives the same week. Writes
// content/tray/puzzles.json for the prototype and prints each puzzle's par and
// how many satellite orders solve it.

import { writeFileSync } from 'node:fs';
import type { DayBand } from '../src/shared/puzzle.ts';
import { DAILY, generateTray } from '../src/shared/trayGen.ts';
import { solveTray } from '../src/shared/traySolve.ts';

const OUT = 'content/tray/puzzles.json';
const WEEK: [DayBand, string, string][] = [
  ['mon', '2026-11-16', 'PROBE'],
  ['tue', '2026-11-17', 'AWAKE'],
  ['wed', '2026-11-18', 'RADIO'],
  ['thu', '2026-11-19', 'ORBIT'],
  ['fri', '2026-11-20', 'LIGHT'],
  ['sat', '2026-11-21', 'VOICE'],
  ['sun', '2026-11-22', 'EARTH'],
];

const puzzles = WEEK.map(([band, date, answer]) => {
  const puzzle = generateTray(DAILY[band], `daily:${date}`, {
    id: `tray-${date}`,
    band,
    answer,
  });
  const report = solveTray(puzzle);
  console.log(
    `${date} ${band}  ${puzzle.ciphertext} → ${answer}  par ${puzzle.par}  ` +
      `orders ${report.orders.length}  layouts ${report.solutions.length}  ` +
      `storms ${puzzle.storms.length}  bolted ${puzzle.fixed.length}  ` +
      `tray ${puzzle.pieces.length}`
  );
  return puzzle;
});

writeFileSync(OUT, `${JSON.stringify(puzzles, null, 2)}\n`);
console.log(`\nWrote ${OUT}`);

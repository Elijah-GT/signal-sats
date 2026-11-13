// Builds the hand-made tray puzzles and checks how much thinking each needs.
//
//   npm run tray:build
//
// Reads content/tray/designs.json (see scripts/lib/trayDesign.ts). The signal
// is worked out from each design's intended beam order. Writes
// content/tray/puzzles.json for the prototype and prints what the solver found:
// how many layouts work, how many different satellite orders, par, the rows
// the beam has to use, and any tray piece no solution needs (a decoy).

import { readFileSync, writeFileSync } from 'node:fs';
import type { TrayPuzzle } from '../src/shared/tray.ts';
import { toPuzzle, type Design } from './lib/trayDesign.ts';
import { solveTray } from './lib/traySolve.ts';

const IN = 'content/tray/designs.json';
// The harder hand-made set, kept for comparison. The dailies are generated
// by tray-daily.ts.
const OUT = 'content/tray/puzzles-hard.json';

const designs: Design[] = JSON.parse(readFileSync(IN, 'utf8'));
const puzzles: TrayPuzzle[] = [];
let failed = false;

for (const d of designs) {
  const puzzle = toPuzzle(d);
  const report = solveTray(puzzle);
  puzzle.par = report.par;
  const intendedOrder = d.intended.join('>');
  const problems: string[] = [];
  if (!report.orders.includes(intendedOrder)) {
    problems.push(`the intended order ${intendedOrder} doesn't work`);
  }
  const usedDecoys = d.decoys.filter((id) => !report.unusedPieces.includes(id));
  if (usedDecoys.length) {
    problems.push(`decoys used by some solution: ${usedDecoys.join(', ')}`);
  }
  if (problems.length) failed = true;

  // The rows where the beam turns or crosses a storm, in the easiest build.
  const easiest = report.solutions.find((s) => s.moves === report.par);
  const rows = new Set([
    ...Object.values(easiest?.placements ?? {}).map((p) => p.y),
    ...puzzle.storms
      .filter((s) => easiest?.order.includes(s.id))
      .map((s) => s.y),
    ...puzzle.fixed
      .filter((f) => easiest?.order.includes(f.id))
      .map((f) => f.y),
  ]);

  console.log(`\n${d.id} (${d.band})  ${puzzle.ciphertext} → ${d.answer}`);
  console.log(`  layouts that work: ${report.solutions.length}`);
  console.log(`  satellite orders:  ${report.orders.join('   ') || 'none'}`);
  console.log(`  par:               ${report.par}`);
  console.log(
    `  rows used:         ${[...rows]
      .sort()
      .map((y) => y + 1)
      .join(', ')}`
  );
  console.log(`  never needed:      ${report.unusedPieces.join(', ') || '-'}`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  puzzles.push(puzzle);
}

writeFileSync(OUT, `${JSON.stringify(puzzles, null, 2)}\n`);
console.log(`\nWrote ${OUT}`);
if (failed) process.exitCode = 1;

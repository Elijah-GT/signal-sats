// Builds the hand-made tray puzzles and checks how much thinking each needs.
//
//   npm run tray:build
//
// Reads content/tray/designs.json. Each design names its satellites' swaps as
// 1-based letter positions and lists the intended beam order; the signal is
// worked out from that. Writes content/tray/puzzles.json for the prototype and
// prints what the solver found: how many layouts work, how many different
// satellite orders, par, and any tray piece no solution needs (a decoy).

import { readFileSync, writeFileSync } from 'node:fs';
import { encode } from '../src/shared/engine/cipher.ts';
import type {
  Angle,
  CipherOp,
  Point,
  Port,
} from '../src/shared/engine/types.ts';
import type { DayBand } from '../src/shared/puzzle.ts';
import type { TrayPuzzle } from '../src/shared/tray.ts';
import { solveTray } from './lib/traySolve.ts';

type Swap = [number, number];
type Design = {
  id: string;
  band: DayBand;
  width: number;
  height: number;
  source: Port;
  debris: Point[];
  fixed: { id: string; x: number; y: number; angle: Angle; swap: Swap }[];
  pieces: { id: string; swap: Swap }[];
  answer: string;
  intended: string[];
};

const IN = 'content/tray/designs.json';
const OUT = 'content/tray/puzzles.json';

const trade = ([a, b]: Swap): CipherOp => ({
  kind: 'trade',
  a: a - 1,
  b: b - 1,
});

const designs: Design[] = JSON.parse(readFileSync(IN, 'utf8'));
const puzzles: TrayPuzzle[] = [];
let failed = false;

for (const d of designs) {
  const swaps = new Map<string, Swap>([
    ...d.fixed.map((f): [string, Swap] => [f.id, f.swap]),
    ...d.pieces.map((p): [string, Swap] => [p.id, p.swap]),
  ]);
  const intended = d.intended.map((id) => {
    const swap = swaps.get(id);
    if (!swap)
      throw new Error(`${d.id}: unknown satellite "${id}" in intended`);
    return trade(swap);
  });
  const puzzle: TrayPuzzle = {
    id: d.id,
    band: d.band,
    width: d.width,
    height: d.height,
    source: d.source,
    debris: d.debris,
    fixed: d.fixed.map(({ swap, ...f }) => ({ ...f, op: trade(swap) })),
    pieces: d.pieces.map(({ id, swap }) => ({ id, op: trade(swap) })),
    ciphertext: encode(d.answer, intended),
    answer: d.answer,
    par: 0,
  };

  const report = solveTray(puzzle);
  puzzle.par = report.par;
  const intendedOrder = d.intended.join('>');
  const ok = report.orders.includes(intendedOrder);
  if (!ok) failed = true;
  console.log(`\n${d.id} (${d.band})  ${puzzle.ciphertext} → ${d.answer}`);
  console.log(`  layouts that work: ${report.solutions.length}`);
  console.log(`  satellite orders:  ${report.orders.join('   ') || 'none'}`);
  console.log(`  par:               ${report.par}`);
  console.log(`  never needed:      ${report.unusedPieces.join(', ') || '-'}`);
  if (!ok) console.log(`  ✗ the intended order ${intendedOrder} doesn't work`);
  puzzles.push(puzzle);
}

writeFileSync(OUT, `${JSON.stringify(puzzles, null, 2)}\n`);
console.log(`\nWrote ${OUT}`);
if (failed) process.exitCode = 1;

// Finds every way to solve a tray puzzle, to check hand-made puzzles need real
// thinking: few distinct satellite orders, and decoys that are never needed.

import { applyOp } from '../../src/shared/engine/cipher.ts';
import {
  entryOf,
  exitPortOf,
  inBounds,
  pointKey,
  reflect,
  step,
  type Direction,
} from '../../src/shared/engine/grid.ts';
import type { Angle, CipherOp, Point } from '../../src/shared/engine/types.ts';
import type { TrayPuzzle } from '../../src/shared/tray.ts';

export type TraySolution = {
  /** Satellites the beam hits, in order: piece and fixed ids. */
  order: string[];
  /** Where each used tray piece goes. */
  placements: Record<string, { x: number; y: number; angle: Angle }>;
  /** Taps to build it: one per piece placed, plus one per mirror turned to "\". */
  moves: number;
};

export type TrayReport = {
  solutions: TraySolution[];
  /** Distinct hit orders across all solutions, e.g. "A>F1>B". */
  orders: string[];
  /** Fewest moves of any solution. */
  par: number;
  /** Tray pieces no solution uses. */
  unusedPieces: string[];
};

type Occupant = { id: string; op: CipherOp; angle: Angle; placed: boolean };

/** Explores the beam path, deciding at each empty square whether to place a piece. */
export const solveTray = (puzzle: TrayPuzzle): TrayReport => {
  const debris = new Set(puzzle.debris.map(pointKey));
  const occupied = new Map<string, Occupant>();
  for (const f of puzzle.fixed) {
    occupied.set(pointKey(f), {
      id: f.id,
      op: f.op,
      angle: f.angle,
      placed: false,
    });
  }
  const solutions: TraySolution[] = [];
  const used = new Set<string>();
  const order: string[] = [];
  // Squares the beam has crossed while empty: a piece placed there later
  // would change the path already walked.
  const crossedEmpty = new Map<string, number>();
  const limit = puzzle.width * puzzle.height * 4;

  const walk = (cell: Point, dir: Direction, text: string, steps: number) => {
    if (steps > limit) return;
    if (!inBounds(puzzle, cell)) return;
    const key = pointKey(cell);
    if (debris.has(key)) return;

    const advance = (d: Direction, t: string) => {
      const next = step(cell, d);
      if (inBounds(puzzle, next)) {
        walk(next, d, t, steps + 1);
        return;
      }
      if (exitPortOf(cell, d).side === 'bottom' && t === puzzle.answer) {
        const placements: TraySolution['placements'] = {};
        let moves = 0;
        for (const [k, o] of occupied) {
          if (!o.placed) continue;
          const [x = 0, y = 0] = k.split(',').map(Number);
          placements[o.id] = { x, y, angle: o.angle };
          moves += o.angle === '\\' ? 2 : 1;
        }
        solutions.push({ order: [...order], placements, moves });
      }
    };

    const here = occupied.get(key);
    if (here) {
      order.push(here.id);
      advance(reflect(dir, here.angle), applyOp(text, here.op));
      order.pop();
      return;
    }

    // Leave it empty.
    crossedEmpty.set(key, (crossedEmpty.get(key) ?? 0) + 1);
    advance(dir, text);
    const count = (crossedEmpty.get(key) ?? 1) - 1;
    if (count === 0) crossedEmpty.delete(key);
    else crossedEmpty.set(key, count);

    // Or place an unused piece here, if the beam hasn't already crossed it.
    if (crossedEmpty.has(key)) return;
    for (const piece of puzzle.pieces) {
      if (used.has(piece.id)) continue;
      for (const angle of ['/', '\\'] as const) {
        used.add(piece.id);
        occupied.set(key, { id: piece.id, op: piece.op, angle, placed: true });
        order.push(piece.id);
        advance(reflect(dir, angle), applyOp(text, piece.op));
        order.pop();
        occupied.delete(key);
        used.delete(piece.id);
      }
    }
  };

  const { cell, dir } = entryOf(puzzle, puzzle.source);
  walk(cell, dir, puzzle.ciphertext, 0);

  const orders = [...new Set(solutions.map((s) => s.order.join('>')))];
  const usedIds = new Set(solutions.flatMap((s) => Object.keys(s.placements)));
  return {
    solutions,
    orders,
    par: Math.min(...solutions.map((s) => s.moves)),
    unusedPieces: puzzle.pieces
      .map((p) => p.id)
      .filter((id) => !usedIds.has(id)),
  };
};

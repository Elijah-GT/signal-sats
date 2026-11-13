// Builds tray puzzles to order: practice puzzles at a chosen difficulty, and
// the daily puzzles. Everything is seeded, so a seed always gives the same
// puzzle.
//
// It lays the solution first: it walks a beam from the source, dropping
// satellites and storms on its path, until the beam falls into the dish. The
// signal is the answer run backwards through that route, so the puzzle always
// has a solution. Then the solver checks it isn't too loose for the
// difficulty: how many different satellite orders also work, and that decoys
// are never needed.

import { ANSWERS } from './answers.ts';
import { applyOp, encode } from './engine/cipher.ts';
import {
  entryOf,
  exitPortOf,
  inBounds,
  pointKey,
  reflect,
  step,
} from './engine/grid.ts';
import type { Angle, CipherOp, Point, Storm } from './engine/types.ts';
import type { DayBand } from './puzzle.ts';
import { createRng, type Rng } from './rng.ts';
import type { FixedSatellite, TrayPiece, TrayPuzzle } from './tray.ts';
import { solveTray } from './traySolve.ts';

export type TraySpec = {
  width: number;
  height: number;
  /** Tray pieces the solution needs. */
  pieces: number;
  /** How many satellites on the route reverse or rotate; the rest swap letters. */
  shapers: number;
  /** Storms on the solution's route. */
  storms: number;
  /** Satellites on the route that are bolted in place. */
  fixed: number;
  /** Extra tray pieces the solution never needs. */
  decoys: number;
  /** Asteroids off the route. */
  debris: number;
  /** How many different satellite orders may solve it. Fewer is harder. */
  maxOrders: number;
};

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Practice mode's difficulties. Every one has storms and a Reverse or Rotate. */
export const PRACTICE: Record<Difficulty, TraySpec> = {
  easy: {
    width: 4,
    height: 4,
    pieces: 2,
    shapers: 1,
    storms: 1,
    fixed: 0,
    decoys: 0,
    debris: 0,
    maxOrders: Infinity,
  },
  medium: {
    width: 5,
    height: 5,
    pieces: 3,
    shapers: 1,
    storms: 1,
    fixed: 1,
    decoys: 1,
    debris: 2,
    maxOrders: 3,
  },
  hard: {
    width: 5,
    height: 6,
    pieces: 3,
    shapers: 1,
    storms: 2,
    fixed: 1,
    decoys: 1,
    debris: 4,
    maxOrders: 1,
  },
};

/**
 * The daily puzzles: no harder than practice's medium, but each still has a
 * storm and a Reverse or Rotate, and from midweek a bolted satellite and,
 * later, a decoy.
 */
export const DAILY: Record<DayBand, TraySpec> = {
  mon: { ...PRACTICE.easy },
  tue: { ...PRACTICE.easy, debris: 1 },
  wed: { ...PRACTICE.medium, decoys: 0, debris: 1, maxOrders: 4 },
  thu: { ...PRACTICE.medium, maxOrders: 4 },
  fri: { ...PRACTICE.medium },
  sat: { ...PRACTICE.medium, storms: 2 },
  sun: { ...PRACTICE.medium, storms: 2, maxOrders: 2 },
};

/** How many puzzles to try before giving up. */
const ATTEMPTS = 400;
/** How many beam walks each try gets to lay a full route. */
const ROUTE_TRIES = 300;
const LETTERS = 5;

const randomShaper = (rng: Rng): CipherOp =>
  rng.next() < 0.5 ? { kind: 'reverse' } : { kind: 'rotate' };

const randomAngle = (rng: Rng): Angle => (rng.next() < 0.5 ? '/' : '\\');

/** `count` distinct letter swaps, none of them already in `taken`. */
const randomSwaps = (
  rng: Rng,
  count: number,
  taken: Set<string>
): CipherOp[] => {
  const out: CipherOp[] = [];
  while (out.length < count) {
    const a = rng.int(0, LETTERS - 2);
    const b = rng.int(a + 1, LETTERS - 1);
    const key = `${a}-${b}`;
    if (taken.has(key)) continue;
    taken.add(key);
    out.push({ kind: 'trade', a, b });
  }
  return out;
};

type Stop =
  { kind: 'sat'; cell: Point; angle: Angle } | { kind: 'storm'; cell: Point };

/**
 * Walks a beam from the source, putting `sats` satellites and `storms` storms
 * on squares it crosses for the first time, and returns the stops in order if
 * the beam then reaches the dish. Returns null if this walk doesn't work out.
 */
const layRoute = (
  rng: Rng,
  spec: TraySpec,
  source: number,
  sats: number,
  storms: number
): { stops: Stop[]; crossed: Set<string> } | null => {
  const placed = new Map<string, Stop>();
  const crossed = new Set<string>();
  const stops: Stop[] = [];
  let satsLeft = sats;
  let stormsLeft = storms;
  let { cell, dir } = entryOf(spec, { side: 'top', index: source });
  for (let n = 0; n < spec.width * spec.height * 4; n++) {
    const key = pointKey(cell);
    const here = placed.get(key);
    if (here?.kind === 'sat') {
      dir = reflect(dir, here.angle);
    } else if (
      !here &&
      !crossed.has(key) &&
      satsLeft + stormsLeft > 0 &&
      rng.next() < 0.4
    ) {
      const stop: Stop =
        rng.int(1, satsLeft + stormsLeft) <= satsLeft
          ? { kind: 'sat', cell, angle: randomAngle(rng) }
          : { kind: 'storm', cell };
      placed.set(key, stop);
      stops.push(stop);
      if (stop.kind === 'sat') {
        satsLeft--;
        dir = reflect(dir, stop.angle);
      } else {
        stormsLeft--;
      }
    }
    crossed.add(key);
    const next = step(cell, dir);
    if (!inBounds(spec, next)) {
      const done =
        exitPortOf(cell, dir).side === 'bottom' && satsLeft + stormsLeft === 0;
      return done ? { stops, crossed } : null;
    }
    cell = next;
  }
  return null;
};

export type GenerateOptions = {
  id?: string;
  band?: DayBand;
  /** The word to decode to; random from ANSWERS if not given. */
  answer?: string;
};

const pieceId = (index: number): string => String.fromCharCode(65 + index);

/** One try at a puzzle, or null if it fails a check. */
const attempt = (
  rng: Rng,
  spec: TraySpec,
  options: GenerateOptions
): TrayPuzzle | null => {
  const answer = options.answer ?? rng.pick(ANSWERS);
  const satCount = spec.pieces + spec.fixed;
  // Most random walks leave the board before every stop is placed, but walks
  // are cheap next to the solver, so try plenty.
  let source = 0;
  let route: ReturnType<typeof layRoute> = null;
  for (let n = 0; n < ROUTE_TRIES && !route; n++) {
    source = rng.int(0, spec.width - 1);
    route = layRoute(rng, spec, source, satCount, spec.storms);
  }
  if (!route) return null;

  // What each satellite does, and which ones are bolted, both at random.
  const taken = new Set<string>();
  const satOps = rng.shuffle([
    ...Array.from({ length: spec.shapers }, () => randomShaper(rng)),
    ...randomSwaps(rng, satCount - spec.shapers, taken),
  ]);
  const fixedAt = new Set(
    rng
      .shuffle(Array.from({ length: satCount }, (_, i) => i))
      .slice(0, spec.fixed)
  );

  const fixed: FixedSatellite[] = [];
  const pieces: TrayPiece[] = [];
  const storms: Storm[] = [];
  const ops: CipherOp[] = [];
  const intended: string[] = [];
  let satIndex = 0;
  for (const stop of route.stops) {
    if (stop.kind === 'storm') {
      const op = randomShaper(rng);
      const id = `S${storms.length + 1}`;
      storms.push({ id, ...stop.cell, op });
      ops.push(op);
      intended.push(id);
      continue;
    }
    const i = satIndex++;
    const op = satOps[i];
    if (!op) return null;
    if (fixedAt.has(i)) {
      const id = `F${fixed.length + 1}`;
      fixed.push({ id, ...stop.cell, angle: stop.angle, op });
      intended.push(id);
    } else {
      const id = pieceId(pieces.length);
      pieces.push({ id, op });
      intended.push(id);
    }
    ops.push(op);
  }
  // Decoys aren't checked: one that happens to fit another solution is just
  // another way to win, and maxOrders still limits how many ways there are.
  for (const op of randomSwaps(rng, spec.decoys, taken)) {
    pieces.push({ id: pieceId(pieces.length), op });
  }

  // Asteroids go where the solution's beam never goes.
  const free: Point[] = [];
  for (let y = 0; y < spec.height; y++) {
    for (let x = 0; x < spec.width; x++) {
      if (!route.crossed.has(pointKey({ x, y }))) free.push({ x, y });
    }
  }
  if (free.length < spec.debris) return null;
  const debris = rng.shuffle(free).slice(0, spec.debris);

  const ciphertext = encode(answer, ops);
  // Every satellite and storm on the route visibly changes the signal.
  let text = ciphertext;
  for (const op of ops) {
    const next = applyOp(text, op);
    if (next === text) return null;
    text = next;
  }

  const puzzle: TrayPuzzle = {
    id: options.id ?? `practice-${answer.toLowerCase()}`,
    band: options.band ?? 'mon',
    width: spec.width,
    height: spec.height,
    source: { side: 'top', index: source },
    debris,
    storms,
    fixed,
    // The tray in a random order, so the first pieces aren't always needed.
    pieces: rng.shuffle(pieces),
    ciphertext,
    answer,
    par: 0,
  };
  const report = solveTray(puzzle);
  if (
    // No shortcut that skips pieces the route needs.
    report.par < spec.pieces ||
    !report.orders.includes(intended.join('>')) ||
    report.orders.length > spec.maxOrders
  ) {
    return null;
  }
  return { ...puzzle, par: report.par };
};

/** A puzzle built to `spec`: the same puzzle every time for the same seed. */
export const generateTray = (
  spec: TraySpec,
  seed: string,
  options: GenerateOptions = {}
): TrayPuzzle => {
  // A beam from the top turns an even number of times to leave by the bottom,
  // and each satellite on the route turns it once.
  if ((spec.pieces + spec.fixed) % 2 !== 0) {
    throw new Error('A puzzle needs an even number of satellites on its route');
  }
  const rng = createRng(seed);
  for (let n = 0; n < ATTEMPTS; n++) {
    const puzzle = attempt(rng, spec, options);
    if (puzzle) return puzzle;
  }
  throw new Error(`No puzzle found for seed "${seed}"`);
};

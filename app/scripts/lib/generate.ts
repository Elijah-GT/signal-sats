import { traceBeam } from '../../src/shared/engine/beam.ts';
import { encode } from '../../src/shared/engine/cipher.ts';
import { decode } from '../../src/shared/engine/decode.ts';
import type {
  Angle,
  Board,
  CipherOp,
  Point,
  Satellite,
  Settings,
} from '../../src/shared/engine/types.ts';
import type { DayBand, Puzzle } from '../../src/shared/puzzle.ts';
import { BANDS, type BandSpec } from './bands.ts';
import { createRng, type Rng } from './rng.ts';
import { allSettings, fewestTaps, solve } from './solve.ts';

export type GenerateInput = {
  answer: string;
  date: string;
  week: string;
  band: DayBand;
  isWord: (text: string) => boolean;
  isBlocked: (text: string) => boolean;
  /** Overrides the weekday's rules, mainly for tests. */
  spec?: BandSpec;
  /** Defaults to `<date>:<answer>`, so a day's puzzle is reproducible. */
  seed?: string;
  maxAttempts?: number;
  width?: number;
  height?: number;
};

const SELF_CANCELLING = new Set<CipherOp['kind']>([
  'reverse',
  'swap',
  'mirror',
  'trade',
]);

const sameOp = (a: CipherOp, b: CipherOp): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** Two identical self-cancelling ops in a row undo each other, wasting both satellites. */
const hasCancellingPair = (ops: readonly CipherOp[]): boolean =>
  ops.some((op, i) => {
    const prev = ops[i - 1];
    return (
      prev !== undefined && SELF_CANCELLING.has(op.kind) && sameOp(prev, op)
    );
  });

/** Neighbouring letter swaps that share a letter, so their order matters. */
export const countOverlaps = (ops: readonly CipherOp[]): number =>
  ops.filter((op, i) => {
    const prev = ops[i - 1];
    if (prev?.kind !== 'trade' || op.kind !== 'trade') return false;
    return [op.a, op.b].some((p) => p === prev.a || p === prev.b);
  }).length;

const WORD_LENGTH = 5;

const randomOp = (spec: BandSpec, rng: Rng): CipherOp => {
  const kind = rng.pick(spec.ops);
  if (kind === 'shift') return { kind, amount: rng.int(1, spec.maxShift) };
  if (kind === 'trade') {
    const a = rng.int(0, WORD_LENGTH - 2);
    return { kind, a, b: rng.int(a + 1, WORD_LENGTH - 1) };
  }
  return { kind };
};

const randomSettings = (board: Board, rng: Rng): Settings => {
  const settings: Record<string, Angle> = {};
  for (const s of board.satellites) settings[s.id] = rng.pick(['/', '\\']);
  return settings;
};

const allCells = (width: number, height: number): Point[] =>
  Array.from({ length: width * height }, (_, i) => ({
    x: i % width,
    y: Math.floor(i / width),
  }));

/** One attempt at a puzzle. Returns `null` when the random board breaks a rule. */
const tryGenerate = (
  input: GenerateInput,
  spec: BandSpec,
  rng: Rng,
  width: number,
  height: number
): Puzzle | null => {
  const { answer, isWord, isBlocked } = input;
  const cells = rng.shuffle(allCells(width, height));
  const satelliteCount = rng.int(...spec.satellites);
  const debrisCount = rng.int(...spec.debris);
  const satellites: Satellite[] = cells
    .slice(0, satelliteCount)
    .map((p, i) => ({
      id: String.fromCharCode(65 + i),
      ...p,
      op: randomOp(spec, rng),
    }));
  const board: Board = {
    width,
    height,
    source: { side: 'top', index: rng.int(0, width - 1) },
    // Earth is the whole bottom edge: every route that comes down delivers text.
    receiver: { side: 'bottom', from: 0, to: width - 1 },
    satellites,
    debris: cells.slice(satelliteCount, satelliteCount + debrisCount),
  };

  // The solution route must reach Earth through the right number of satellites,
  // each once, leaving enough decoys off the path.
  const solution = randomSettings(board, rng);
  const trace = traceBeam(board, solution);
  const path = trace.hits;
  if (trace.end.kind !== 'received') return null;
  // The beam's first turn must be in the upper half, so the route crosses the
  // whole board instead of bunching up just above Earth.
  if ((path[0]?.y ?? height) >= height / 2) return null;
  if (path.length < spec.pathLength[0] || path.length > spec.pathLength[1])
    return null;
  if (new Set(path.map((s) => s.id)).size !== path.length) return null;
  if (satellites.length - path.length < spec.minDecoys) return null;

  const ops = path.map((s) => s.op);
  if (hasCancellingPair(ops)) return null;
  if (countOverlaps(ops) < spec.minOverlaps) return null;
  const ciphertext = encode(answer, ops);
  if (ciphertext === answer || isWord(ciphertext)) return null;
  // Every satellite on the route must visibly change the text.
  if (
    decode(board, solution, ciphertext).steps.some((s) => s.before === s.after)
  ) {
    return null;
  }

  // Exactly one real word may reach the receiver, and it must be the answer.
  // No route may ever show an offensive word, even part-way.
  const report = solve(board, ciphertext, isWord);
  const solving = report.words.get(answer);
  if (report.words.size !== 1 || !solving) return null;
  if (report.routes < spec.minRoutes) return null;
  if ([...report.texts].some(isBlocked)) return null;

  const starts = allSettings(board).filter(
    (s) => fewestTaps(s, solving) >= spec.minTaps
  );
  if (starts.length === 0) return null;
  const start = rng.pick(starts);

  return {
    date: input.date,
    week: input.week,
    band: input.band,
    board,
    ciphertext,
    start,
    answer,
    solution,
    stats: {
      satellites: satellites.length,
      pathLength: path.length,
      reachingSettings: report.reaching,
      routes: report.routes,
      minTaps: fewestTaps(start, solving),
      opKinds: [...new Set(ops.map((op) => op.kind))],
    },
  };
};

/** Builds a daily puzzle whose only real-word answer is `input.answer`. */
export const generatePuzzle = (input: GenerateInput): Puzzle => {
  const { answer, date } = input;
  if (!/^[A-Z]{5}$/.test(answer)) {
    throw new Error(`Answer "${answer}" must be 5 capital letters`);
  }
  if (!input.isWord(answer)) {
    throw new Error(`Answer "${answer}" is not in the dictionary`);
  }
  const spec = input.spec ?? BANDS[input.band];
  const rng = createRng(input.seed ?? `${date}:${answer}`);
  const maxAttempts = input.maxAttempts ?? 300000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const puzzle = tryGenerate(
      input,
      spec,
      rng,
      input.width ?? 5,
      input.height ?? 6
    );
    if (puzzle) return puzzle;
  }
  throw new Error(
    `No valid puzzle for ${answer} on ${date} after ${maxAttempts} attempts`
  );
};

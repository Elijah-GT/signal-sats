// Player-made levels. The maker builds the solution on the board, every
// satellite where it needs to be, and the level works out the scrambled signal
// from that: the answer run backwards through whatever the beam hits. So every
// level made this way can be solved.
//
// When it's played, movable satellites go back into the tray. Movable
// satellites the beam doesn't touch become decoys.

import { traceBeam, type Trace } from './engine/beam.ts';
import { applyOp, encode } from './engine/cipher.ts';
import { inBounds } from './engine/grid.ts';
import type {
  Angle,
  Board,
  CipherOp,
  Point,
  Settings,
  Storm,
} from './engine/types.ts';
import { validateBoard } from './engine/validate.ts';
import type { DayBand } from './puzzle.ts';
import type { FixedSatellite, TrayPiece, TrayPuzzle } from './tray.ts';
import { solveTray } from './traySolve.ts';

export type LevelSat = {
  id: string;
  x: number;
  y: number;
  angle: Angle;
  op: CipherOp;
  /** Bolted satellites stay on the board when it's played. */
  bolted: boolean;
};

export type Level = {
  width: number;
  height: number;
  /** The column the signal comes in at, along the top. */
  source: number;
  answer: string;
  debris: Point[];
  storms: Storm[];
  sats: LevelSat[];
};

export const LEVEL_LIMITS = {
  minSize: 3,
  maxSize: 6,
  /** Movable satellites, so the solver can still check a level quickly. */
  maxPieces: 5,
} as const;

/** What a tap on the board does in the editor. */
export type Tool =
  | { kind: 'sat'; op: CipherOp; bolted: boolean }
  | { kind: 'storm'; op: CipherOp }
  | { kind: 'debris' }
  | { kind: 'erase' };

export const emptyLevel = (): Level => ({
  width: 5,
  height: 5,
  source: 2,
  answer: '',
  debris: [],
  storms: [],
  sats: [],
});

const same = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

/** The level with nothing on `cell`. */
export const clearCell = (level: Level, cell: Point): Level => ({
  ...level,
  debris: level.debris.filter((d) => !same(d, cell)),
  storms: level.storms.filter((s) => !same(s, cell)),
  sats: level.sats.filter((s) => !same(s, cell)),
});

/** An id not used by anything in the level yet. */
const nextId = (level: Level): string => {
  const used = new Set([
    ...level.sats.map((s) => s.id),
    ...level.storms.map((s) => s.id),
  ]);
  let n = 1;
  while (used.has(`e${n}`)) n++;
  return `e${n}`;
};

/** Uses `tool` on `cell`: whatever was there is replaced, or erased. */
export const applyTool = (level: Level, cell: Point, tool: Tool): Level => {
  if (!inBounds(level, cell)) return level;
  const cleared = clearCell(level, cell);
  switch (tool.kind) {
    case 'erase':
      return cleared;
    case 'debris':
      return { ...cleared, debris: [...cleared.debris, cell] };
    case 'storm':
      return {
        ...cleared,
        storms: [
          ...cleared.storms,
          { id: nextId(level), ...cell, op: tool.op },
        ],
      };
    case 'sat':
      return {
        ...cleared,
        sats: [
          ...cleared.sats,
          {
            id: nextId(level),
            ...cell,
            angle: '/',
            op: tool.op,
            bolted: tool.bolted,
          },
        ],
      };
  }
};

/** Turns a satellite's mirror. */
export const turnSat = (level: Level, id: string): Level => ({
  ...level,
  sats: level.sats.map((s) =>
    s.id === id ? { ...s, angle: s.angle === '/' ? '\\' : '/' } : s
  ),
});

/** Changes the board size, dropping anything that no longer fits. */
export const resizeLevel = (
  level: Level,
  width: number,
  height: number
): Level => {
  const size = { width, height };
  const fits = (p: Point) => inBounds(size, p);
  return {
    ...level,
    width,
    height,
    source: Math.min(level.source, width - 1),
    debris: level.debris.filter(fits),
    storms: level.storms.filter(fits),
    sats: level.sats.filter(fits),
  };
};

/** The level as the engine sees it, every satellite where the maker put it. */
export const levelBoard = (
  level: Level
): { board: Board; settings: Settings } => ({
  board: {
    width: level.width,
    height: level.height,
    source: { side: 'top', index: level.source },
    receiver: { side: 'bottom', from: 0, to: level.width - 1 },
    satellites: level.sats.map(({ id, x, y, op }) => ({ id, x, y, op })),
    debris: level.debris,
    storms: level.storms,
  },
  settings: Object.fromEntries(level.sats.map((s) => [s.id, s.angle])),
});

export type Compiled = {
  /** The beam through the maker's solution. */
  trace: Trace;
  /** What players will see coming in, once there's a word. */
  ciphertext: string | null;
  /** The text after each stop on the beam, starting with the signal. */
  texts: string[];
  /** What stops this level being played yet. Empty means it's ready. */
  problems: string[];
  puzzle: TrayPuzzle | null;
};

const WORD = /^[A-Z]{5}$/;
const BANDS: readonly DayBand[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

/** Checks the level and builds the puzzle players get. */
export const compileLevel = (level: Level, id = 'level'): Compiled => {
  const { board, settings } = levelBoard(level);
  const trace = traceBeam(board, settings);
  const ops = trace.hits.map((h) => h.op);
  const word = level.answer.toUpperCase();
  const ciphertext = WORD.test(word) ? encode(word, ops) : null;
  const texts = ciphertext
    ? ops.reduce<string[]>(
        (acc, op) => [...acc, applyOp(acc.at(-1) ?? '', op)],
        [ciphertext]
      )
    : [];

  const onBeam = new Set(trace.hits.map((h) => h.id));
  const movable = level.sats.filter((s) => !s.bolted);
  const problems: string[] = [];
  if (!WORD.test(word)) problems.push('Type a five-letter word to hide.');
  if (trace.end.kind !== 'received') {
    problems.push('The beam has to come down into the dish.');
  }
  if (!movable.some((s) => onBeam.has(s.id))) {
    problems.push('Put at least one movable satellite on the beam.');
  }
  if (movable.length > LEVEL_LIMITS.maxPieces) {
    problems.push(`Use at most ${LEVEL_LIMITS.maxPieces} movable satellites.`);
  }
  if (ciphertext !== null && ciphertext === word) {
    problems.push(
      'The signal comes out already unscrambled. Change some satellites.'
    );
  }
  if (problems.length > 0 || ciphertext === null) {
    return { trace, ciphertext, texts, problems, puzzle: null };
  }

  // Players' names for things: A, B, C… in the tray, F1… bolted, S1… storms.
  const pieces: TrayPiece[] = movable.map((s, i) => ({
    id: String.fromCharCode(65 + i),
    op: s.op,
  }));
  const fixed: FixedSatellite[] = level.sats
    .filter((s) => s.bolted)
    .map((s, i) => ({
      id: `F${i + 1}`,
      x: s.x,
      y: s.y,
      angle: s.angle,
      op: s.op,
    }));
  const storms: Storm[] = level.storms.map((s, i) => ({
    ...s,
    id: `S${i + 1}`,
  }));
  const puzzle: TrayPuzzle = {
    id,
    band: 'mon',
    width: level.width,
    height: level.height,
    source: { side: 'top', index: level.source },
    debris: level.debris,
    storms,
    fixed,
    pieces,
    ciphertext,
    answer: word,
    par: 0,
  };
  return { trace, ciphertext, texts, problems, puzzle };
};

export type Rating = {
  par: number;
  /** Different satellite orders that solve it. */
  orders: number;
  /** Different layouts that solve it. */
  layouts: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
};

/** How hard a puzzle is, from the solver: one way to win with several pieces is hard. */
export const rateLevel = (puzzle: TrayPuzzle): Rating => {
  const report = solveTray(puzzle);
  const needed = puzzle.pieces.length - report.unusedPieces.length;
  const difficulty =
    report.orders.length === 1 && needed >= 3
      ? 'Hard'
      : report.orders.length <= 3 && needed >= 2
        ? 'Medium'
        : 'Easy';
  return {
    par: report.par,
    orders: report.orders.length,
    layouts: report.solutions.length,
    difficulty,
  };
};

// Share codes: the puzzle as JSON, in URL-safe base64. Anyone with the code
// can play the level. (The answer is in it; the real game will keep answers
// on the server.)

export const toCode = (puzzle: TrayPuzzle): string =>
  btoa(JSON.stringify(puzzle))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isInt = (v: unknown): v is number => Number.isInteger(v);

const isPoint = (v: unknown): v is Point =>
  isRecord(v) && isInt(v['x']) && isInt(v['y']);

const isOp = (v: unknown): v is CipherOp => {
  if (!isRecord(v)) return false;
  switch (v['kind']) {
    case 'reverse':
    case 'rotate':
      return true;
    case 'trade': {
      const { a, b } = v;
      return isInt(a) && isInt(b) && 0 <= a && a < b && b < 5;
    }
    default:
      return false;
  }
};

const isAngle = (v: unknown): v is Angle => v === '/' || v === '\\';

const isList = <T>(v: unknown, item: (x: unknown) => x is T): v is T[] =>
  Array.isArray(v) && v.every(item);

const isStorm = (v: unknown): v is Storm =>
  isRecord(v) && typeof v['id'] === 'string' && isOp(v['op']) && isPoint(v);

const isFixed = (v: unknown): v is FixedSatellite =>
  isRecord(v) && isAngle(v['angle']) && isStorm(v);

const isPiece = (v: unknown): v is TrayPiece =>
  isRecord(v) && typeof v['id'] === 'string' && isOp(v['op']);

/** Reads a share code. Returns null for anything that isn't a playable level. */
export const fromCode = (code: string): TrayPuzzle | null => {
  let data: unknown;
  try {
    const base64 = code.trim().replace(/-/g, '+').replace(/_/g, '/');
    data = JSON.parse(atob(base64));
  } catch {
    return null;
  }
  return parsePuzzle(data);
};

/**
 * Checks untrusted data is a playable level: the right shape, sizes in range,
 * and a valid board. Returns null if not. Doesn't check it can be solved.
 */
export const parsePuzzle = (data: unknown): TrayPuzzle | null => {
  if (!isRecord(data)) return null;
  const { width, height, source, debris, storms, fixed, pieces } = data;
  const { ciphertext, answer, par, id } = data;
  if (
    !isInt(width) ||
    !isInt(height) ||
    width < LEVEL_LIMITS.minSize ||
    height < LEVEL_LIMITS.minSize ||
    width > LEVEL_LIMITS.maxSize ||
    height > LEVEL_LIMITS.maxSize ||
    !isRecord(source) ||
    source['side'] !== 'top' ||
    !isInt(source['index']) ||
    !isList(debris, isPoint) ||
    !isList(storms, isStorm) ||
    !isList(fixed, isFixed) ||
    !isList(pieces, isPiece) ||
    pieces.length > LEVEL_LIMITS.maxPieces ||
    typeof ciphertext !== 'string' ||
    typeof answer !== 'string' ||
    !WORD.test(ciphertext) ||
    !WORD.test(answer) ||
    !isInt(par)
  ) {
    return null;
  }
  const band = BANDS.find((b) => b === data['band']) ?? 'mon';
  const puzzle: TrayPuzzle = {
    id: typeof id === 'string' ? id : 'shared',
    band,
    width,
    height,
    source: { side: 'top', index: source['index'] },
    debris,
    storms,
    fixed,
    pieces,
    ciphertext,
    answer,
    par,
  };
  const board: Board = {
    width,
    height,
    source: puzzle.source,
    receiver: { side: 'bottom', from: 0, to: width - 1 },
    satellites: fixed,
    debris,
    storms,
  };
  return validateBoard(board).length === 0 ? puzzle : null;
};

/** Every square, for making the whole board tappable in the editor. */
export const allCells = (level: Pick<Level, 'width' | 'height'>): Point[] =>
  Array.from({ length: level.width * level.height }, (_, i) => ({
    x: i % level.width,
    y: Math.floor(i / level.width),
  }));

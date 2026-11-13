// The tray version of the game: the player places satellites from a tray onto
// the board, so the beam visits them in an order that unscrambles the word.

import { decode, type DecodeResult } from './engine/decode.ts';
import { pointKey } from './engine/grid.ts';
import type {
  Angle,
  Board,
  CipherOp,
  Point,
  Port,
  Satellite,
  Settings,
  Storm,
} from './engine/types.ts';
import type { DayBand } from './puzzle.ts';

/** A satellite waiting in the tray. */
export type TrayPiece = { id: string; op: CipherOp };

/** A satellite already on the board that the player can't move or turn. */
export type FixedSatellite = Satellite & { angle: Angle };

export type TrayPuzzle = {
  id: string;
  band: DayBand;
  width: number;
  height: number;
  source: Port;
  debris: readonly Point[];
  /** Storms the beam passes through, changing the text. */
  storms: readonly Storm[];
  fixed: readonly FixedSatellite[];
  pieces: readonly TrayPiece[];
  ciphertext: string;
  /** In the real app this stays on the server. */
  answer: string;
  /** Fewest moves that solve it: one per piece placed, one more per mirror turned. */
  par: number;
};

/** A puzzle as players' devices get it: everything but the answer. */
export type PublicTrayPuzzle = Omit<TrayPuzzle, 'answer'>;

/** The puzzle without its answer, to send to players. */
export const toPublic = (puzzle: TrayPuzzle): PublicTrayPuzzle => {
  const { answer, ...rest } = puzzle;
  void answer;
  return rest;
};

export type Placement = { x: number; y: number; angle: Angle };

export type TrayState = {
  /** Where each placed piece sits, by piece id. Pieces not listed are in the tray. */
  placed: Readonly<Record<string, Placement>>;
  /** The tray piece about to be placed, if any. */
  selected: string | null;
  /** Placements and turns, for the score. */
  moves: number;
};

export const newTrayGame = (): TrayState => ({
  placed: {},
  selected: null,
  moves: 0,
});

/** The board as the engine sees it: fixed satellites plus everything placed. */
export const trayBoard = (
  puzzle: PublicTrayPuzzle,
  state: TrayState
): { board: Board; settings: Settings } => {
  const satellites: Satellite[] = puzzle.fixed.map(({ id, x, y, op }) => ({
    id,
    x,
    y,
    op,
  }));
  const settings: Record<string, Angle> = {};
  for (const f of puzzle.fixed) settings[f.id] = f.angle;
  for (const piece of puzzle.pieces) {
    const at = state.placed[piece.id];
    if (!at) continue;
    satellites.push({ id: piece.id, x: at.x, y: at.y, op: piece.op });
    settings[piece.id] = at.angle;
  }
  return {
    board: {
      width: puzzle.width,
      height: puzzle.height,
      source: puzzle.source,
      receiver: { side: 'bottom', from: 0, to: puzzle.width - 1 },
      satellites,
      debris: puzzle.debris,
      storms: puzzle.storms,
    },
    settings,
  };
};

export const trayDecode = (
  puzzle: PublicTrayPuzzle,
  state: TrayState
): DecodeResult => {
  const { board, settings } = trayBoard(puzzle, state);
  return decode(board, settings, puzzle.ciphertext);
};

export const isTraySolved = (puzzle: TrayPuzzle, state: TrayState): boolean =>
  trayDecode(puzzle, state).output === puzzle.answer;

/** Whether a piece can be put down at `cell`: on the board and empty. */
export const isFreeCell = (
  puzzle: PublicTrayPuzzle,
  state: TrayState,
  cell: Point
): boolean => {
  if (
    cell.x < 0 ||
    cell.y < 0 ||
    cell.x >= puzzle.width ||
    cell.y >= puzzle.height
  ) {
    return false;
  }
  const taken = new Set([
    ...puzzle.debris.map(pointKey),
    ...puzzle.storms.map(pointKey),
    ...puzzle.fixed.map(pointKey),
    ...Object.values(state.placed).map(pointKey),
  ]);
  return !taken.has(pointKey(cell));
};

/**
 * Taps a piece in the tray. A piece on the board comes back to the tray and is
 * picked up; tapping the picked-up piece again puts it down.
 */
export const selectPiece = (state: TrayState, pieceId: string): TrayState => {
  if (state.placed[pieceId]) {
    const placed = { ...state.placed };
    delete placed[pieceId];
    return { ...state, placed, selected: pieceId };
  }
  return { ...state, selected: state.selected === pieceId ? null : pieceId };
};

/** Taps an empty square: puts the picked-up piece there. */
export const tapCell = (
  puzzle: PublicTrayPuzzle,
  state: TrayState,
  cell: Point
): TrayState => {
  const { selected } = state;
  if (selected === null || !isFreeCell(puzzle, state, cell)) return state;
  return {
    placed: { ...state.placed, [selected]: { ...cell, angle: '/' } },
    selected: null,
    moves: state.moves + 1,
  };
};

/** Taps a satellite on the board: turns its mirror, unless it's fixed. */
export const tapSatellite = (state: TrayState, id: string): TrayState => {
  const at = state.placed[id];
  if (!at) return state;
  return {
    ...state,
    placed: {
      ...state.placed,
      [id]: { ...at, angle: at.angle === '/' ? '\\' : '/' },
    },
    moves: state.moves + 1,
  };
};

/** The placed piece on `cell`, if there is one. */
export const pieceAt = (state: TrayState, cell: Point): string | undefined =>
  Object.entries(state.placed).find(
    ([, p]) => p.x === cell.x && p.y === cell.y
  )?.[0];

/**
 * Drops a piece, from the tray or the board, on a square. An empty square
 * takes it. A square holding another placed piece swaps them: a piece moved
 * on the board trades squares with it, and a piece from the tray takes its
 * square and sends it back to the tray. Each piece keeps its mirror's angle; a
 * piece fresh from the tray faces "/". Anywhere else (off the board, debris,
 * a storm, a bolted satellite, its own square) changes nothing.
 */
export const dropPiece = (
  puzzle: PublicTrayPuzzle,
  state: TrayState,
  id: string,
  cell: Point
): TrayState => {
  if (!puzzle.pieces.some((p) => p.id === id)) return state;
  const from = state.placed[id];
  if (from && from.x === cell.x && from.y === cell.y) return state;
  const other = pieceAt(state, cell);
  const there = other === undefined ? undefined : state.placed[other];
  if (!there && !isFreeCell(puzzle, state, cell)) return state;

  const placed = { ...state.placed };
  if (other !== undefined && there) {
    if (from) placed[other] = { ...there, x: from.x, y: from.y };
    else delete placed[other];
  }
  placed[id] = { x: cell.x, y: cell.y, angle: from?.angle ?? '/' };
  return { placed, selected: null, moves: state.moves + 1 };
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Whether `placed` is a layout a player could really have built: only pieces
 * from the tray, each on its own free square, facing a real angle. The server
 * checks this before replaying a claimed solve.
 */
export const isValidLayout = (
  puzzle: PublicTrayPuzzle,
  placed: unknown
): placed is Record<string, Placement> => {
  if (!isRecord(placed)) return false;
  const taken = new Set([
    ...puzzle.debris.map(pointKey),
    ...puzzle.storms.map(pointKey),
    ...puzzle.fixed.map(pointKey),
  ]);
  for (const [id, p] of Object.entries(placed)) {
    if (!puzzle.pieces.some((piece) => piece.id === id)) return false;
    if (!isRecord(p)) return false;
    const { x, y, angle } = p;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      y < 0 ||
      x >= puzzle.width ||
      y >= puzzle.height ||
      (angle !== '/' && angle !== '\\')
    ) {
      return false;
    }
    const key = pointKey({ x, y });
    if (taken.has(key)) return false;
    taken.add(key);
  }
  return true;
};

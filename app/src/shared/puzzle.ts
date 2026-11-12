import type { Board, Settings } from './engine/types.ts';

/** Difficulty tier of a daily puzzle. Each weekday has its own, Monday easiest. */
export type DayBand = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type PuzzleStats = {
  satellites: number;
  /** Satellites the solution beam passes through. */
  pathLength: number;
  /** How many of the 2^n reflector settings get the beam to the receiver. */
  reachingSettings: number;
  /** Different routes to the receiver: the real choices a player has. */
  routes: number;
  /** Fewest taps from the starting angles to a solution. */
  minTaps: number;
  opKinds: string[];
};

/**
 * A generated daily puzzle, as stored in `content/puzzles/<date>.json`.
 * `answer` and `solution` must never be sent to the client.
 */
export type Puzzle = {
  /** UTC date the puzzle runs, as YYYY-MM-DD. */
  date: string;
  /** Id of the week file whose message this puzzle's answer hints at. */
  week: string;
  band: DayBand;
  board: Board;
  ciphertext: string;
  start: Settings;
  answer: string;
  solution: Settings;
  stats: PuzzleStats;
};

/** What the browser gets: everything except the answer and solution. */
export type ClientPuzzle = Pick<
  Puzzle,
  'date' | 'week' | 'band' | 'board' | 'ciphertext' | 'start'
>;

export const toClientPuzzle = (puzzle: Puzzle): ClientPuzzle => ({
  date: puzzle.date,
  week: puzzle.week,
  band: puzzle.band,
  board: puzzle.board,
  ciphertext: puzzle.ciphertext,
  start: puzzle.start,
});

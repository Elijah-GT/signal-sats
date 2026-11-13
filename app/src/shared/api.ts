// What the game's client and server send each other.

import type { DayBand } from './puzzle.ts';
import type { Placement, PublicTrayPuzzle, TrayPuzzle } from './tray.ts';

/**
 * Stored on each post (Reddit's postData, readable by anyone), so the feed
 * card can draw without asking the server. Never holds the answer.
 */
export type SignalPostData = {
  kind: 'daily' | 'custom';
  /** The daily puzzle's number, or 0 for a player's level. */
  number: number;
  /** The daily puzzle's date (YYYY-MM-DD), or '' for a player's level. */
  date: string;
  band: DayBand;
  /** Who made a player's level, or '' for the daily. */
  author: string;
};

/** How everyone has done on a post. */
export type PostStats = {
  /** People who opened the puzzle. */
  players: number;
  /** People who decoded it. */
  solves: number;
  /** Solvers who matched par. */
  parSolves: number;
  /** Average moves among solvers, or null before anyone solves it. */
  averageMoves: number | null;
};

/** The player's own solve of a post. */
export type MyResult = { moves: number; word: string };

export type InitResponse = {
  type: 'init';
  postId: string;
  post: SignalPostData;
  puzzle: PublicTrayPuzzle;
  /** Null until the player solves it. */
  mine: MyResult | null;
  stats: PostStats;
  /** Days in a row the player has solved the daily. */
  streak: number;
  /** Null when logged out: solves aren't kept. */
  username: string | null;
};

/** The player's layout when the beam lands a five-letter word in the dish. */
export type CheckRequest = {
  placed: Record<string, Placement>;
  moves: number;
};

export type CheckResponse =
  | { type: 'check'; correct: false }
  | {
      type: 'check';
      correct: true;
      result: MyResult;
      stats: PostStats;
      streak: number;
    };

/** A level made in the editor, to post as its own Reddit post. */
export type PostLevelRequest = { puzzle: TrayPuzzle };

export type PostLevelResponse = { type: 'level'; url: string };

export type ErrorResponse = { status: 'error'; message: string };

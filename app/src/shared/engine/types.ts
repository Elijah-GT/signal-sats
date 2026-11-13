/** Reflector angle on a satellite. Tapping a satellite flips between the two. */
export type Angle = '/' | '\\';

export type Point = { x: number; y: number };

export type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * A point on the grid's edge. `index` is the column for top/bottom ports and
 * the row for left/right ports.
 */
export type Port = { side: Side; index: number };

/**
 * Where the beam must leave the grid to deliver its text: edge points `from`
 * to `to` (inclusive) on one side. In the game the whole bottom edge is
 * Earth, but a single dish (`from === to`) also works.
 */
export type Receiver = { side: Side; from: number; to: number };

export type CipherOp =
  | { kind: 'reverse' }
  | { kind: 'swap' }
  | { kind: 'rotate' }
  | { kind: 'shift'; amount: number }
  | { kind: 'mirror' }
  /** Swaps the letters at positions `a` and `b` (0-based, `a < b`). */
  | { kind: 'trade'; a: number; b: number };

export type Satellite = { id: string; x: number; y: number; op: CipherOp };

/**
 * A storm in the sky. The beam passes straight through it, and the storm
 * changes the text every time it does. Nothing can be placed on a storm.
 */
export type Storm = { id: string; x: number; y: number; op: CipherOp };

/** Everything about a puzzle's layout. `y` grows downward; (0, 0) is the top-left cell. */
export type Board = {
  width: number;
  height: number;
  source: Port;
  receiver: Receiver;
  satellites: readonly Satellite[];
  debris: readonly Point[];
  /** Storms the beam passes straight through, changing the text. */
  storms?: readonly Storm[];
};

/** The reflector angle of every satellite, keyed by satellite id. */
export type Settings = Readonly<Record<string, Angle>>;

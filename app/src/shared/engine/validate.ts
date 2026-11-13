import {
  inBounds,
  pointKey,
  portInRange,
  reachesReceiver,
  receiverInRange,
} from './grid.ts';
import type { Board, Point } from './types.ts';

const isPositiveInt = (n: number): boolean => Number.isInteger(n) && n > 0;

/** Problems with a board's layout. An empty list means the board is usable. */
export const validateBoard = (board: Board): string[] => {
  const errors: string[] = [];
  if (!isPositiveInt(board.width) || !isPositiveInt(board.height)) {
    return ['Width and height must be positive whole numbers'];
  }
  if (!portInRange(board, board.source)) errors.push('Source is off the grid');
  if (!receiverInRange(board, board.receiver)) {
    errors.push('Receiver is off the grid or runs backwards');
  }
  if (reachesReceiver(board.source, board.receiver)) {
    errors.push('Source is inside the receiver');
  }

  const occupied = new Map<string, string>();
  const place = (p: Point, label: string): void => {
    if (
      !Number.isInteger(p.x) ||
      !Number.isInteger(p.y) ||
      !inBounds(board, p)
    ) {
      errors.push(`${label} is off the grid`);
      return;
    }
    const other = occupied.get(pointKey(p));
    if (other) errors.push(`${label} shares a cell with ${other}`);
    else occupied.set(pointKey(p), label);
  };

  const ids = new Set<string>();
  for (const satellite of board.satellites) {
    const label = `Satellite "${satellite.id}"`;
    if (satellite.id === '') errors.push('A satellite has an empty id');
    else if (ids.has(satellite.id)) errors.push(`${label} id is used twice`);
    ids.add(satellite.id);
    place(satellite, label);
    const { op } = satellite;
    if (
      op.kind === 'shift' &&
      !(Number.isInteger(op.amount) && op.amount >= 1 && op.amount <= 25)
    ) {
      errors.push(`${label} has a shift amount outside 1–25`);
    }
    if (
      op.kind === 'trade' &&
      !(
        Number.isInteger(op.a) &&
        Number.isInteger(op.b) &&
        0 <= op.a &&
        op.a < op.b
      )
    ) {
      errors.push(`${label} must swap two different letter positions`);
    }
  }
  board.debris.forEach((d, i) => place(d, `Debris ${i + 1}`));
  return errors;
};

/**
 * Problems with a set of reflector angles for `board`. An empty list means
 * they're usable. Takes unchecked input because settings arrive as request JSON.
 */
export const validateSettings = (
  board: Board,
  settings: Readonly<Record<string, unknown>>
): string[] => {
  const errors: string[] = [];
  const ids = new Set(board.satellites.map((s) => s.id));
  for (const id of ids) {
    if (settings[id] === undefined) {
      errors.push(`Satellite "${id}" has no reflector angle`);
    }
  }
  for (const [id, angle] of Object.entries(settings)) {
    if (!ids.has(id)) errors.push(`Unknown satellite "${id}"`);
    else if (angle !== '/' && angle !== '\\') {
      errors.push(`Satellite "${id}" has an invalid angle`);
    }
  }
  return errors;
};

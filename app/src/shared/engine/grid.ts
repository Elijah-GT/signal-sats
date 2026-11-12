import type { Angle, Board, Point, Port, Receiver } from './types.ts';

export type Direction = 'up' | 'down' | 'left' | 'right';

type GridSize = Pick<Board, 'width' | 'height'>;

const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const REFLECT: Record<Angle, Record<Direction, Direction>> = {
  '/': { right: 'up', up: 'right', left: 'down', down: 'left' },
  '\\': { right: 'down', down: 'right', left: 'up', up: 'left' },
};

/** The direction a beam travels after bouncing off a reflector at `angle`. */
export const reflect = (dir: Direction, angle: Angle): Direction =>
  REFLECT[angle][dir];

export const step = (p: Point, dir: Direction): Point => ({
  x: p.x + DELTA[dir].x,
  y: p.y + DELTA[dir].y,
});

export const inBounds = (size: GridSize, p: Point): boolean =>
  p.x >= 0 && p.x < size.width && p.y >= 0 && p.y < size.height;

export const pointKey = (p: Point): string => `${p.x},${p.y}`;

/** The first cell a beam enters from `port`, and the direction it is moving. */
export const entryOf = (
  size: GridSize,
  port: Port
): { cell: Point; dir: Direction } => {
  switch (port.side) {
    case 'top':
      return { cell: { x: port.index, y: 0 }, dir: 'down' };
    case 'bottom':
      return { cell: { x: port.index, y: size.height - 1 }, dir: 'up' };
    case 'left':
      return { cell: { x: 0, y: port.index }, dir: 'right' };
    case 'right':
      return { cell: { x: size.width - 1, y: port.index }, dir: 'left' };
  }
};

/** The edge port a beam passes through when it leaves `cell` moving `dir` off the grid. */
export const exitPortOf = (cell: Point, dir: Direction): Port => {
  switch (dir) {
    case 'up':
      return { side: 'top', index: cell.x };
    case 'down':
      return { side: 'bottom', index: cell.x };
    case 'left':
      return { side: 'left', index: cell.y };
    case 'right':
      return { side: 'right', index: cell.y };
  }
};

export const samePort = (a: Port, b: Port): boolean =>
  a.side === b.side && a.index === b.index;

const edgeLength = (size: GridSize, side: Port['side']): number =>
  side === 'top' || side === 'bottom' ? size.width : size.height;

export const portInRange = (size: GridSize, port: Port): boolean =>
  Number.isInteger(port.index) &&
  port.index >= 0 &&
  port.index < edgeLength(size, port.side);

/** Whether a beam leaving through `port` lands in the receiver. */
export const reachesReceiver = (port: Port, receiver: Receiver): boolean =>
  port.side === receiver.side &&
  port.index >= receiver.from &&
  port.index <= receiver.to;

export const receiverInRange = (size: GridSize, receiver: Receiver): boolean =>
  Number.isInteger(receiver.from) &&
  Number.isInteger(receiver.to) &&
  receiver.from >= 0 &&
  receiver.from <= receiver.to &&
  receiver.to < edgeLength(size, receiver.side);

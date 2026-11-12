import type { Trace } from './engine/beam.ts';
import type { Board, Point, Port } from './engine/types.ts';

/** Drawing sizes for the board, in SVG units. The SVG scales to fit the screen. */
export const LAYOUT = {
  cell: 64,
  pad: 14,
  /** Space above the grid for the incoming signal. */
  top: 40,
  /** Space below the grid for Earth. */
  bottom: 50,
} as const;

export const boardSize = (board: Board): { width: number; height: number } => ({
  width: board.width * LAYOUT.cell + LAYOUT.pad * 2,
  height: board.height * LAYOUT.cell + LAYOUT.top + LAYOUT.bottom,
});

export const cellCentre = (p: Point): Point => ({
  x: LAYOUT.pad + p.x * LAYOUT.cell + LAYOUT.cell / 2,
  y: LAYOUT.top + p.y * LAYOUT.cell + LAYOUT.cell / 2,
});

/** A point `offset` units outside the grid, level with edge point `port`. */
export const portPoint = (board: Board, port: Port, offset: number): Point => {
  const { cell, pad, top } = LAYOUT;
  const along = (port.index + 0.5) * cell;
  switch (port.side) {
    case 'top':
      return { x: pad + along, y: top - offset };
    case 'bottom':
      return { x: pad + along, y: top + board.height * cell + offset };
    case 'left':
      return { x: pad - offset, y: top + along };
    case 'right':
      return { x: pad + board.width * cell + offset, y: top + along };
  }
};

/** The beam as a line: from the source, through each cell, to where it ends. */
export const beamPoints = (board: Board, trace: Trace): Point[] => {
  const start = portPoint(board, board.source, LAYOUT.top - 10);
  const points = [start, ...trace.cells.map(cellCentre)];
  const end = trace.end;
  if (end.kind === 'blocked') {
    // Stop at the near edge of the debris.
    const from = points.at(-1) ?? start;
    const debris = cellCentre(end.at);
    points.push({ x: (from.x + debris.x) / 2, y: (from.y + debris.y) / 2 });
  } else if (end.kind === 'received') {
    points.push(portPoint(board, end.port, LAYOUT.bottom / 2));
  } else {
    points.push(portPoint(board, end.port, LAYOUT.pad));
  }
  return points;
};

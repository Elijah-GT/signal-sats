import {
  entryOf,
  exitPortOf,
  inBounds,
  pointKey,
  reachesReceiver,
  reflect,
  step,
} from './grid.ts';
import { angleFor } from './settings.ts';
import type {
  Board,
  Point,
  Port,
  Satellite,
  Settings,
  Storm,
} from './types.ts';

export type BeamEnd =
  | { kind: 'received'; port: Port }
  | { kind: 'escaped'; port: Port }
  | { kind: 'blocked'; at: Point };

export type Trace = {
  /** Cells the beam crosses, in order. A cell can appear twice. A debris cell that stops the beam is not included. */
  cells: Point[];
  /** Satellites and storms in the order the beam meets them. The same one can appear twice. */
  hits: (Satellite | Storm)[];
  end: BeamEnd;
};

/** Follows the beam from the source until it reaches the receiver, leaves the grid, or hits debris. */
export const traceBeam = (board: Board, settings: Settings): Trace => {
  const satellites = new Map<string, Satellite>(
    board.satellites.map((s) => [pointKey(s), s])
  );
  const storms = new Map<string, Storm>(
    (board.storms ?? []).map((s) => [pointKey(s), s])
  );
  const debris = new Set(board.debris.map(pointKey));
  const cells: Point[] = [];
  const hits: (Satellite | Storm)[] = [];
  let { cell, dir } = entryOf(board, board.source);

  // With two-angle reflectors, a beam that enters from the edge always leaves
  // again, crossing each cell at most once per direction. Going past that
  // limit means a bug, not a hard puzzle.
  const maxSteps = board.width * board.height * 4;
  for (let n = 0; n <= maxSteps; n++) {
    if (debris.has(pointKey(cell))) {
      return { cells, hits, end: { kind: 'blocked', at: cell } };
    }
    cells.push(cell);

    const satellite = satellites.get(pointKey(cell));
    if (satellite) {
      hits.push(satellite);
      dir = reflect(dir, angleFor(settings, satellite.id));
    } else {
      const storm = storms.get(pointKey(cell));
      if (storm) hits.push(storm);
    }

    const next = step(cell, dir);
    if (!inBounds(board, next)) {
      const port = exitPortOf(cell, dir);
      const end: BeamEnd = reachesReceiver(port, board.receiver)
        ? { kind: 'received', port }
        : { kind: 'escaped', port };
      return { cells, hits, end };
    }
    cell = next;
  }
  throw new Error('Beam exceeded the step limit; the board is invalid');
};

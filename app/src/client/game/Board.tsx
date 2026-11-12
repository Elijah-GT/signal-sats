import type { KeyboardEvent } from 'react';
import type { Trace } from '../../shared/engine/beam';
import { opName, opSymbol } from '../../shared/engine/cipher';
import type {
  Board as BoardData,
  Satellite as SatelliteData,
  Settings,
} from '../../shared/engine/types';
import {
  LAYOUT,
  beamPoints,
  boardSize,
  cellCentre,
  portPoint,
} from '../../shared/layout';

type BoardProps = {
  board: BoardData;
  settings: Settings;
  trace: Trace;
  locked: boolean;
  onTap: (satelliteId: string) => void;
};

// A fixed scatter of faint stars, so the background doesn't shift between renders.
const STARS = [
  [0.08, 0.12],
  [0.31, 0.05],
  [0.55, 0.09],
  [0.82, 0.04],
  [0.93, 0.18],
  [0.17, 0.33],
  [0.66, 0.27],
  [0.42, 0.41],
  [0.88, 0.45],
  [0.05, 0.58],
  [0.29, 0.66],
  [0.74, 0.61],
  [0.51, 0.74],
  [0.95, 0.72],
  [0.14, 0.84],
] as const;

const Satellite = ({
  satellite,
  angle,
  lit,
  locked,
  onTap,
}: {
  satellite: SatelliteData;
  angle: Settings[string];
  lit: boolean;
  locked: boolean;
  onTap: (id: string) => void;
}) => {
  const { x, y } = cellCentre(satellite);
  const tilt = angle === '/' ? 'leans right' : 'leans left';
  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (locked || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    onTap(satellite.id);
  };
  return (
    <g
      className={`sg-sat${lit ? ' sg-sat--lit' : ''}${locked ? ' sg-sat--locked' : ''}`}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-label={`Satellite ${satellite.id}, ${opName(satellite.op)}. Reflector ${tilt}.${locked ? '' : ' Tap to turn it.'}`}
      onClick={() => !locked && onTap(satellite.id)}
      onKeyDown={onKeyDown}
    >
      <rect className="sg-sat-hit" x={-32} y={-32} width={64} height={64} />
      <rect
        className="sg-sat-mirror"
        x={-27}
        y={-3}
        width={54}
        height={6}
        rx={3}
        style={{ transform: `rotate(${angle === '/' ? -45 : 45}deg)` }}
      />
      <circle className="sg-sat-body" r={16} />
      <text className="sg-sat-op" dy="0.35em">
        {opSymbol(satellite.op)}
      </text>
    </g>
  );
};

/** The grid of satellites, the live beam, and Earth below. */
export const Board = ({
  board,
  settings,
  trace,
  locked,
  onTap,
}: BoardProps) => {
  const { width, height } = boardSize(board);
  const points = beamPoints(board, trace)
    .map((p) => `${p.x},${p.y}`)
    .join(' ');
  const lit = new Set(trace.hits.map((s) => s.id));
  const earthTop = LAYOUT.top + board.height * LAYOUT.cell + 14;
  const earth = `M0 ${height} L0 ${earthTop + 12} Q${width / 2} ${earthTop - 14} ${width} ${earthTop + 12} L${width} ${height} Z`;
  const source = portPoint(board, board.source, LAYOUT.top - 14);

  return (
    <svg
      className="sg-board"
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label="Satellites between the signal and Earth"
    >
      {STARS.map(([sx, sy], i) => (
        <circle
          key={i}
          className="sg-star"
          cx={sx * width}
          cy={sy * height}
          r={1.4}
        />
      ))}
      {Array.from({ length: board.width * board.height }, (_, i) => {
        const c = cellCentre({
          x: i % board.width,
          y: Math.floor(i / board.width),
        });
        return <circle key={i} className="sg-cell" cx={c.x} cy={c.y} r={2} />;
      })}

      <path className="sg-earth" d={earth} />
      <path
        className="sg-earth-rim"
        d={`M0 ${earthTop + 12} Q${width / 2} ${earthTop - 14} ${width} ${earthTop + 12}`}
      />

      <polygon
        className="sg-source"
        points={`${source.x - 9},${source.y - 12} ${source.x + 9},${source.y - 12} ${source.x},${source.y + 2}`}
      />
      <polyline
        className={`sg-beam sg-beam--glow sg-beam--${trace.end.kind}`}
        points={points}
      />
      <polyline
        className={`sg-beam sg-beam--core sg-beam--${trace.end.kind}`}
        points={points}
      />

      {board.debris.map((d, i) => {
        const c = cellCentre(d);
        return (
          <path
            key={i}
            className="sg-debris"
            d={`M${c.x - 15} ${c.y - 6} L${c.x - 4} ${c.y - 17} L${c.x + 13} ${c.y - 11} L${c.x + 17} ${c.y + 6} L${c.x + 3} ${c.y + 17} L${c.x - 13} ${c.y + 11} Z`}
            aria-label="Debris"
          />
        );
      })}

      {board.satellites.map((s) => (
        <Satellite
          key={s.id}
          satellite={s}
          angle={settings[s.id] ?? '/'}
          lit={lit.has(s.id)}
          locked={locked}
          onTap={onTap}
        />
      ))}
    </svg>
  );
};

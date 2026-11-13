import {
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
} from 'react';
import type { Trace } from '../../shared/engine/beam';
import { opName } from '../../shared/engine/cipher';
import type {
  Board as BoardData,
  Point,
  Satellite as SatelliteData,
  Settings,
  Storm as StormData,
} from '../../shared/engine/types';
import {
  LAYOUT,
  beamPoints,
  boardSize,
  cellCentre,
  portPoint,
} from '../../shared/layout';
import {
  ASTEROID,
  ASTEROID_TONE,
  CHEVRON,
  DISH,
  DISH_TONE,
  DISH_UNIT,
  STORM,
  STORM_TONE,
  STORM_UNIT,
} from './sprites';
import { Bitmap, OpGlyph } from './pixels';

type BoardProps = {
  board: BoardData;
  settings: Settings;
  trace: Trace;
  locked: boolean;
  onTap: (satelliteId: string) => void;
  /** Text after each satellite on the beam, starting with the incoming signal. Shown along the beam when given. */
  texts?: readonly string[];
  /** Satellites bolted in place: they can't be turned. */
  fixedIds?: ReadonlySet<string>;
  /** Empty squares a piece can be put on, highlighted while placing. */
  targets?: readonly Point[];
  onCellTap?: (cell: Point) => void;
  /** The board's SVG, for working out which square a drag ends on. */
  svgRef?: Ref<SVGSVGElement>;
  /** A press on a movable satellite: it may become a drag. */
  onSatPointerDown?: (id: string, e: PointerEvent<SVGGElement>) => void;
  /** The satellite being dragged, drawn faintly where it was. */
  draggingId?: string | null;
  /** The square a dragged satellite would land on. */
  dropTarget?: Point | null;
  /** In the level editor even bolted satellites can be turned. */
  editing?: boolean;
};

// A fixed scatter of stars, so the sky doesn't shift between renders.
// [x, y, size]; size 0 is a twinkling cross.
const STARS = [
  [0.08, 0.12, 2],
  [0.31, 0.05, 3],
  [0.55, 0.09, 2],
  [0.82, 0.04, 0],
  [0.93, 0.18, 2],
  [0.17, 0.33, 2],
  [0.66, 0.27, 3],
  [0.42, 0.41, 2],
  [0.88, 0.45, 0],
  [0.05, 0.58, 3],
  [0.29, 0.66, 2],
  [0.74, 0.61, 2],
  [0.51, 0.74, 0],
  [0.95, 0.72, 2],
  [0.14, 0.84, 2],
] as const;

const Star = ({ x, y, size }: { x: number; y: number; size: number }) => {
  const px = (dx: number, dy: number) => (
    <rect x={Math.round(x) + dx} y={Math.round(y) + dy} width={2} height={2} />
  );
  if (size === 0) {
    return (
      <g className="sg-star sg-star--twinkle">
        {px(0, -4)}
        {px(-4, 0)}
        {px(0, 0)}
        {px(4, 0)}
        {px(0, 4)}
      </g>
    );
  }
  return (
    <rect
      className="sg-star"
      x={Math.round(x)}
      y={Math.round(y)}
      width={size}
      height={size}
    />
  );
};

/**
 * The reflector: a pixel-art "/" diagonal, three pixels thick, corner to
 * corner. Turning it a quarter turn gives "\".
 */
const PANEL_SIZE = 19;
const PANEL_UNIT = 3;
const PANEL = Array.from({ length: PANEL_SIZE }, (_, r) => {
  const c = PANEL_SIZE - 1 - r;
  return Array.from({ length: PANEL_SIZE }, (_, x) =>
    x === c - 1 ? 'e' : x === c ? 'p' : x === c + 1 ? 'h' : '.'
  ).join('');
});
const PANEL_TONE = {
  e: 'sg-px-panel-edge',
  p: 'sg-px-panel',
  h: 'sg-px-panel-shine',
};
const PANEL_OFFSET = -(PANEL_SIZE * PANEL_UNIT) / 2;

const Satellite = ({
  satellite,
  angle,
  lit,
  locked,
  fixed,
  onTap,
  onPointerDown,
  dragging,
}: {
  fixed: boolean;
  onPointerDown:
    ((id: string, e: PointerEvent<SVGGElement>) => void) | undefined;
  dragging: boolean;
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
      className={`sg-sat${lit ? ' sg-sat--lit' : ''}${locked ? ' sg-sat--locked' : ''}${fixed ? ' sg-sat--fixed' : ''}${dragging ? ' sg-sat--dragging' : ''}${onPointerDown && !locked ? ' sg-sat--movable' : ''}`}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-label={`Satellite ${satellite.id}, ${opName(satellite.op)}. Mirror ${tilt}.${fixed ? ' Bolted in place.' : locked ? '' : ' Tap to turn it.'}`}
      onClick={() => !locked && onTap(satellite.id)}
      onPointerDown={(e) => !locked && onPointerDown?.(satellite.id, e)}
      onKeyDown={onKeyDown}
    >
      <rect className="sg-sat-hit" x={-32} y={-32} width={64} height={64} />
      <g
        className="sg-sat-panels"
        style={{ transform: `rotate(${angle === '/' ? 0 : 90}deg)` }}
      >
        <Bitmap
          rows={PANEL}
          unit={PANEL_UNIT}
          tone={PANEL_TONE}
          x={PANEL_OFFSET}
          y={PANEL_OFFSET}
        />
      </g>
      <rect className="sg-sat-shadow" x={-16} y={-9} width={36} height={26} />
      <rect className="sg-sat-antenna" x={-1} y={-21} width={2} height={8} />
      <rect className="sg-sat-antenna" x={-3} y={-23} width={6} height={3} />
      <rect className="sg-sat-body" x={-18} y={-13} width={36} height={26} />
      {fixed &&
        [
          [-16, -11],
          [13, -11],
          [-16, 8],
          [13, 8],
        ].map(([bx = 0, by = 0]) => (
          <rect
            key={`${bx},${by}`}
            className="sg-sat-bolt"
            x={bx}
            y={by}
            width={3}
            height={3}
          />
        ))}
      <g className="sg-sat-op">
        <OpGlyph op={satellite.op} />
      </g>
    </g>
  );
};

const STORM_W = (STORM[0]?.length ?? 0) * STORM_UNIT;

/** A storm cloud with its op on it. It glows while the beam runs through. */
const Storm = ({ storm, lit }: { storm: StormData; lit: boolean }) => {
  const { x, y } = cellCentre(storm);
  return (
    <g
      className={`sg-storm${lit ? ' sg-storm--lit' : ''}`}
      transform={`translate(${x} ${y})`}
      role="img"
      aria-label={`Storm: ${opName(storm.op)}. The beam passes straight through it.`}
    >
      <Bitmap
        rows={STORM}
        unit={STORM_UNIT}
        tone={STORM_TONE}
        x={-STORM_W / 2}
        y={-22}
      />
      <g className="sg-storm-op" transform="translate(0 -4)">
        <OpGlyph op={storm.op} />
      </g>
    </g>
  );
};

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const PACKET_LETTER = 10;
const PACKET_WIDTH = 5 * PACKET_LETTER + 6;
/** Beam units per millisecond. */
const PACKET_SPEED = 0.14;
/** How long the packet waits just past each satellite, showing the swap. */
const PACKET_DWELL = 650;
/** How long it rests in the dish before the next run. */
const PACKET_REST = 1100;
/** How far past a satellite the packet stops, so it doesn't cover it. */
const PACKET_CLEAR = 30;

type Leg = { from: Point; to: Point; start: number; length: number };

/** The beam as straight legs, with the distance along the beam where each starts. */
const toLegs = (points: readonly Point[]): Leg[] => {
  const legs: Leg[] = [];
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    if (!from || !to) continue;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    legs.push({ from, to, start, length });
    start += length;
  }
  return legs;
};

const pointAt = (legs: readonly Leg[], distance: number): Point => {
  const leg = legs.find((l) => distance <= l.start + l.length) ?? legs.at(-1);
  if (!leg) return { x: 0, y: 0 };
  const t = leg.length === 0 ? 0 : (distance - leg.start) / leg.length;
  const clamped = Math.min(1, Math.max(0, t));
  return {
    x: leg.from.x + (leg.to.x - leg.from.x) * clamped,
    y: leg.from.y + (leg.to.y - leg.from.y) * clamped,
  };
};

/** Distance along the beam where it meets each satellite it hits. */
const hitDistances = (
  points: readonly Point[],
  legs: readonly Leg[],
  hits: readonly (SatelliteData | StormData)[]
): number[] => {
  const out: number[] = [];
  let from = 1;
  for (const hit of hits) {
    const c = cellCentre(hit);
    const at = points.findIndex(
      (p, i) => i >= from && p.x === c.x && p.y === c.y
    );
    if (at === -1) break;
    const leg = legs[at - 1];
    out.push(leg ? leg.start + leg.length : 0);
    from = at + 1;
  }
  return out;
};

type PacketProps = {
  points: readonly Point[];
  hits: readonly (SatelliteData | StormData)[];
  /** The signal, then the text after each satellite. */
  texts: readonly string[];
};

/**
 * The signal's letters riding the beam: they travel from the source, stop just
 * past each satellite to show which two letters swapped, then land in the dish
 * (or fly off into space) and start again.
 */
const Packet = ({ points, hits, texts }: PacketProps) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      setElapsed(now - began);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const legs = toLegs(points);
  const total = (legs.at(-1)?.start ?? 0) + (legs.at(-1)?.length ?? 0);
  const stops = hitDistances(points, legs, hits).map((d) =>
    Math.min(total, d + PACKET_CLEAR)
  );
  const cycle =
    total / PACKET_SPEED + stops.length * PACKET_DWELL + PACKET_REST;

  // Walk the timeline: travel to each stop, wait there, then on to the end.
  let t = elapsed % cycle;
  let distance = total;
  let passed = stops.length;
  let dwelling = false;
  let travelled = 0;
  for (let k = 0; k <= stops.length; k++) {
    const target = stops[k] ?? total;
    const travel = (target - travelled) / PACKET_SPEED;
    if (t < travel) {
      distance = travelled + t * PACKET_SPEED;
      passed = k;
      break;
    }
    t -= travel;
    travelled = target;
    if (k < stops.length) {
      if (t < PACKET_DWELL) {
        distance = target;
        passed = k + 1;
        dwelling = true;
        break;
      }
      t -= PACKET_DWELL;
    }
  }

  const text = texts[passed] ?? '';
  // Letters that just changed place, while the packet waits after a stop.
  const before = texts[passed - 1] ?? text;
  const moved = dwelling
    ? [...text].flatMap((c, i) => (c !== before.charAt(i) ? [i] : []))
    : [];
  const at = pointAt(legs, distance);

  return (
    <g
      className={`sg-packet${dwelling ? ' sg-packet--swap' : ''}`}
      transform={`translate(${Math.round(at.x)} ${Math.round(at.y)})`}
      aria-hidden="true"
    >
      <rect
        className="sg-tag-box"
        x={-PACKET_WIDTH / 2}
        y={-9}
        width={PACKET_WIDTH}
        height={18}
      />
      {[...text].map((letter, i) => (
        <text
          key={i}
          className={`sg-tag-letter${moved.includes(i) ? ' sg-tag-letter--moved' : ''}`}
          x={(i - 2) * PACKET_LETTER}
          dy="0.36em"
          textAnchor="middle"
        >
          {letter}
        </text>
      ))}
    </g>
  );
};

/** Low hills along the horizon, stepped like pixel art. */
const hills = (width: number, groundY: number): string => {
  const step = 8;
  let d = `M0 ${groundY}`;
  for (let x = 0; x < width; x += step) {
    const h =
      Math.round((5 + 4 * Math.sin(x / 41) + 3 * Math.sin(x / 13 + 1)) / 2) * 2;
    const top = groundY - Math.max(0, h);
    d += ` L${x} ${top} L${x + step} ${top}`;
  }
  return `${d} L${width} ${groundY} Z`;
};

const Dish = ({
  x,
  focusY,
  receiving,
}: {
  x: number;
  focusY: number;
  receiving: boolean;
}) => {
  const w = (DISH[0]?.length ?? 0) * DISH_UNIT;
  return (
    <g
      className={`sg-dish${receiving ? ' sg-dish--on' : ''}`}
      style={{
        transform: `translate(${x - w / 2}px, ${focusY - DISH_UNIT / 2}px)`,
      }}
      aria-hidden="true"
    >
      {receiving && (
        <g className="sg-dish-ping" transform={`translate(${w / 2} 1.5)`}>
          <rect x={-8} y={-8} width={16} height={16} />
        </g>
      )}
      <Bitmap rows={DISH} unit={DISH_UNIT} tone={DISH_TONE} />
    </g>
  );
};

/** The grid of satellites, the live beam, and Earth below with its dish. */
export const Board = ({
  board,
  settings,
  trace,
  locked,
  onTap,
  texts,
  fixedIds,
  targets,
  onCellTap,
  svgRef,
  onSatPointerDown,
  draggingId,
  dropTarget,
  editing = false,
}: BoardProps) => {
  const ditherId = useId();
  const { width, height } = boardSize(board);
  const beam = beamPoints(board, trace);
  const points = beam.map((p) => `${p.x},${p.y}`).join(' ');
  const motion = !reducedMotion();
  const lit = new Set(trace.hits.map((s) => s.id));
  const gridBottom = LAYOUT.top + board.height * LAYOUT.cell;
  const groundY = gridBottom + LAYOUT.ground;
  const source = portPoint(board, board.source, LAYOUT.top - 6);

  // The dish rolls to wherever the beam comes down, and waits there when the
  // beam is lost.
  const receivedAt =
    trace.end.kind === 'received' ? trace.end.port.index : null;
  const [dishAt, setDishAt] = useState(
    receivedAt ?? Math.floor(board.width / 2)
  );
  if (receivedAt !== null && receivedAt !== dishAt) setDishAt(receivedAt);
  const dishX = portPoint(board, { side: 'bottom', index: dishAt }, 0).x;

  return (
    <svg
      ref={svgRef}
      className="sg-board"
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      role="group"
      aria-label="Satellites between the signal and the radar dish on Earth"
    >
      <defs>
        <pattern
          id={ditherId}
          width={4}
          height={4}
          patternUnits="userSpaceOnUse"
        >
          <rect className="sg-glow-px" width={2} height={2} />
          <rect className="sg-glow-px" x={2} y={2} width={2} height={2} />
        </pattern>
      </defs>

      {STARS.map(([sx, sy, size], i) => (
        <Star key={i} x={sx * width} y={sy * gridBottom} size={size} />
      ))}
      {Array.from({ length: board.width * board.height }, (_, i) => {
        const c = cellCentre({
          x: i % board.width,
          y: Math.floor(i / board.width),
        });
        return (
          <rect
            key={i}
            className="sg-cell"
            x={c.x - 1}
            y={c.y - 1}
            width={2}
            height={2}
          />
        );
      })}

      {/* Earth: a dithered glow over the horizon, hills, then the ground. */}
      <rect
        x={0}
        y={groundY - 22}
        width={width}
        height={12}
        fill={`url(#${ditherId})`}
      />
      <path className="sg-hills" d={hills(width, groundY)} />
      <rect
        className="sg-ground"
        x={0}
        y={groundY}
        width={width}
        height={height - groundY}
      />
      <rect className="sg-grass" x={0} y={groundY} width={width} height={4} />

      <g
        className="sg-source"
        transform={`translate(${source.x - 7} ${source.y - 20})`}
        aria-hidden="true"
      >
        <g className="sg-chevron sg-chevron--1">
          <Bitmap rows={CHEVRON} unit={2} tone={{ '#': 'sg-px-beam' }} />
        </g>
        <g className="sg-chevron sg-chevron--2">
          <Bitmap rows={CHEVRON} unit={2} tone={{ '#': 'sg-px-beam' }} y={7} />
        </g>
      </g>

      <g shapeRendering="auto">
        <polyline
          className={`sg-beam sg-beam--glow sg-beam--${trace.end.kind}`}
          points={points}
        />
        <polyline
          className={`sg-beam sg-beam--main sg-beam--${trace.end.kind}`}
          points={points}
        />
        <polyline
          className={`sg-beam sg-beam--core sg-beam--${trace.end.kind}`}
          points={points}
        />
      </g>

      <Dish
        x={dishX}
        focusY={gridBottom + LAYOUT.dishFocus}
        receiving={trace.end.kind === 'received'}
      />

      {board.debris.map((d, i) => {
        const c = cellCentre(d);
        return (
          <g key={i} role="img" aria-label="Space debris">
            <Bitmap
              rows={ASTEROID}
              unit={4}
              tone={ASTEROID_TONE}
              x={c.x - 18}
              y={c.y - 16}
            />
          </g>
        );
      })}

      {board.storms?.map((s) => (
        <Storm key={s.id} storm={s} lit={lit.has(s.id)} />
      ))}

      {targets?.map((t) => {
        const c = cellCentre(t);
        return (
          <rect
            key={`${t.x},${t.y}`}
            className="sg-target"
            x={c.x - 28}
            y={c.y - 28}
            width={56}
            height={56}
            role="button"
            tabIndex={0}
            aria-label={`Put it on square ${t.x + 1}, row ${t.y + 1}`}
            onClick={() => onCellTap?.(t)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCellTap?.(t);
              }
            }}
          />
        );
      })}

      {dropTarget && (
        <rect
          className="sg-drop"
          x={cellCentre(dropTarget).x - 28}
          y={cellCentre(dropTarget).y - 28}
          width={56}
          height={56}
          aria-hidden="true"
        />
      )}

      {board.satellites.map((s) => (
        <Satellite
          key={s.id}
          satellite={s}
          angle={settings[s.id] ?? '/'}
          lit={lit.has(s.id)}
          locked={locked || (!editing && (fixedIds?.has(s.id) ?? false))}
          fixed={fixedIds?.has(s.id) ?? false}
          onTap={onTap}
          onPointerDown={onSatPointerDown}
          dragging={draggingId === s.id}
        />
      ))}

      {texts && motion && (
        <Packet
          key={`${points}|${texts.join()}`}
          points={beam}
          hits={trace.hits}
          texts={texts}
        />
      )}
    </svg>
  );
};

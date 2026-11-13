// Pixel-art sprites, drawn as SVG rectangles so they stay crisp at any size.
// Each sprite is a list of rows; each character picks a colour class, and "."
// is transparent.

import type { CipherOp } from '../../shared/engine/types';

type Tone = Readonly<Record<string, string>>;

type BitmapProps = {
  rows: readonly string[];
  unit: number;
  tone: Tone;
  x?: number;
  y?: number;
};

/** Draws a sprite, merging runs of the same colour into one rectangle. */
export const Bitmap = ({ rows, unit, tone, x = 0, y = 0 }: BitmapProps) => {
  const rects = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? '';
    let c = 0;
    while (c < row.length) {
      const ch = row[c] ?? '.';
      const cls = tone[ch];
      let end = c + 1;
      while (end < row.length && row[end] === ch) end++;
      if (cls) {
        rects.push(
          <rect
            key={`${r}-${c}`}
            className={cls}
            x={x + c * unit}
            y={y + r * unit}
            width={(end - c) * unit}
            height={unit}
          />
        );
      }
      c = end;
    }
  }
  return <>{rects}</>;
};

const INK: Tone = { '#': 'sg-px-ink' };

// Two arrows passing each other: the word is read backwards.
const REVERSE = [
  '.....#...',
  '......#..',
  '########.',
  '......#..',
  '.....#...',
  '...#.....',
  '..#......',
  '.########',
  '..#......',
  '...#.....',
];
// Crossing arrows: neighbouring letters trade places.
const SWAP = [
  '###...###',
  '##.....##',
  '#.#...#.#',
  '...#.#...',
  '....#....',
  '...#.#...',
  '..#...#..',
  '.#.....#.',
  '#.......#',
];
// A loop: the first letter goes round to the end.
const ROTATE = [
  '..####.#.',
  '.#....##.',
  '#....###.',
  '#........',
  '#.......#',
  '#.......#',
  '.#.....#.',
  '..#####..',
];
// Half light, half dark: A swaps with Z, B with Y.
const MIRROR = [
  '..#####..',
  '.#..####.',
  '#...#####',
  '#...#####',
  '#...#####',
  '#...#####',
  '#...#####',
  '.#..####.',
  '..#####..',
];

/**
 * A letter swap: five dots for the five letters, with the two that trade
 * places joined by a bracket.
 */
const TradeGlyph = ({ a, b }: { a: number; b: number }) => {
  const dotX = (i: number) => -15 + i * 6;
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <rect
          key={i}
          className={
            i === a || i === b ? 'sg-px-ink' : 'sg-px-ink sg-px-ink--faint'
          }
          x={dotX(i)}
          y={1}
          width={5}
          height={5}
        />
      ))}
      <rect className="sg-px-ink" x={dotX(a) + 1} y={-6} width={2} height={7} />
      <rect className="sg-px-ink" x={dotX(b) + 2} y={-6} width={2} height={7} />
      <rect
        className="sg-px-ink"
        x={dotX(a) + 1}
        y={-6}
        width={dotX(b) - dotX(a) + 3}
        height={2}
      />
    </>
  );
};

const ICONS: Record<Exclude<CipherOp['kind'], 'shift' | 'trade'>, string[]> = {
  reverse: REVERSE,
  swap: SWAP,
  rotate: ROTATE,
  mirror: MIRROR,
};

/** An operation's icon, centred on (0, 0), for use inside an SVG. */
export const OpGlyph = ({ op, unit = 2 }: { op: CipherOp; unit?: number }) => {
  if (op.kind === 'shift') {
    return (
      <text className="sg-px-text" dy="0.36em" textAnchor="middle">
        +{op.amount}
      </text>
    );
  }
  if (op.kind === 'trade') return <TradeGlyph a={op.a} b={op.b} />;
  const rows = ICONS[op.kind];
  const w = (rows[0]?.length ?? 0) * unit;
  const h = rows.length * unit;
  return <Bitmap rows={rows} unit={unit} tone={INK} x={-w / 2} y={-h / 2} />;
};

/** An operation's icon as a standalone inline image, for HTML. */
export const OpIcon = ({ op, size = 22 }: { op: CipherOp; size?: number }) => (
  <svg
    className="sg-op-icon"
    width={size}
    height={size}
    viewBox="-17 -17 34 34"
    shapeRendering="crispEdges"
    aria-hidden="true"
  >
    <OpGlyph op={op} />
  </svg>
);

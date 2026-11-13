export type TileTone = 'incoming' | 'idle' | 'lost' | 'wrong' | 'right';

type TilesProps = {
  text: string;
  tone: TileTone;
  /** What the row is, for screen readers, e.g. "Incoming signal". */
  label: string;
};

type SlidingTilesProps = {
  /** The letters in their original order. */
  letters: string;
  /** Which original letter sits at each position: `order[p]` is an index into `letters`. */
  order: readonly number[];
  /** Positions that just swapped, to highlight. */
  moved: readonly number[];
  label: string;
};

/** Tile width plus the gap between tiles, in pixels. Matches .sg-tile. */
const TILE_STEP = 46;

/**
 * Letter tiles that slide to new positions when letters swap. Each tile keeps
 * its identity (its original letter), so a swap animates as two tiles passing
 * each other.
 */
export const SlidingTiles = ({
  letters,
  order,
  moved,
  label,
}: SlidingTilesProps) => {
  const position = new Map(order.map((original, p) => [original, p]));
  const text = order.map((i) => letters.charAt(i)).join('');
  return (
    <div
      className="sg-tiles sg-tiles--sliding"
      style={{ width: letters.length * TILE_STEP - 6 }}
      role="img"
      aria-label={`${label}: ${[...text].join(' ')}`}
    >
      {[...letters].map((letter, i) => {
        const p = position.get(i) ?? i;
        return (
          <span
            key={i}
            className={`sg-tile sg-tile--slide${moved.includes(p) ? ' sg-tile--moved' : ''}`}
            style={{ transform: `translateX(${p * TILE_STEP}px)` }}
          >
            {letter}
          </span>
        );
      })}
    </div>
  );
};

/** A row of letter tiles, like the incoming signal or what reached Earth. */
export const Tiles = ({ text, tone, label }: TilesProps) => (
  <div
    className={`sg-tiles sg-tiles--${tone}`}
    role="img"
    aria-label={`${label}: ${tone === 'idle' ? 'nothing yet' : [...text].join(' ')}`}
  >
    {[...text].map((letter, i) => (
      <span key={i} className="sg-tile">
        {letter}
      </span>
    ))}
  </div>
);

export type TileTone = 'incoming' | 'idle' | 'lost' | 'wrong' | 'right';

type TilesProps = {
  text: string;
  tone: TileTone;
  /** What the row is, for screen readers, e.g. "Incoming signal". */
  label: string;
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

import { applyOp, opName, opSymbol } from '../../shared/engine/cipher';
import type { Board } from '../../shared/engine/types';
import { OpIcon } from './pixels';

const EXAMPLE = 'ABCDE';

/** What each satellite on today's board does, with a worked example. */
export const OpLegend = ({ board }: { board: Board }) => {
  const seen = new Set<string>();
  const ops = board.satellites
    .map((s) => s.op)
    .filter((op) => {
      const key = opSymbol(op);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const [first] = ops;
  if (first?.kind === 'trade' && ops.every((op) => op.kind === 'trade')) {
    return (
      <section className="sg-card" aria-labelledby="sg-legend-title">
        <h2 id="sg-legend-title" className="sg-card-title">
          How it works
        </h2>
        <p className="sg-help">
          Each satellite swaps the two letters its dots mark. Turn the mirrors
          so the beam passes the right satellites in the right order, and the
          signal lands in the dish as a word.
        </p>
        <p className="sg-legend-item">
          <span className="sg-legend-icon">
            <OpIcon op={first} />
          </span>
          <span className="sg-legend-name">{opName(first)}</span>
          <span className="sg-legend-eg">
            {EXAMPLE} <span aria-label="becomes">›</span>{' '}
            {applyOp(EXAMPLE, first)}
          </span>
        </p>
      </section>
    );
  }

  return (
    <section className="sg-card" aria-labelledby="sg-legend-title">
      <h2 id="sg-legend-title" className="sg-card-title">
        What the satellites do
      </h2>
      <ul className="sg-legend">
        {ops.map((op) => (
          <li key={opSymbol(op)} className="sg-legend-item">
            <span className="sg-legend-icon">
              <OpIcon op={op} />
            </span>
            <span className="sg-legend-name">{opName(op)}</span>
            <span className="sg-legend-eg">
              {EXAMPLE} <span aria-label="becomes">›</span>{' '}
              {applyOp(EXAMPLE, op)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

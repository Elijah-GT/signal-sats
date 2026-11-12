import { applyOp, opName, opSymbol } from '../../shared/engine/cipher';
import type { Board } from '../../shared/engine/types';

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

  return (
    <section className="sg-panel" aria-labelledby="sg-legend-title">
      <h2 id="sg-legend-title">What the satellites do</h2>
      <ul className="sg-legend">
        {ops.map((op) => (
          <li key={opSymbol(op)}>
            <span className="sg-legend-op" aria-hidden="true">
              {opSymbol(op)}
            </span>
            <span>{opName(op)}</span>
            <span className="sg-legend-eg">
              {EXAMPLE} → {applyOp(EXAMPLE, op)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

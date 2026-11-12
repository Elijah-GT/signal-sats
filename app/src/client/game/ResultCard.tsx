import { useState } from 'react';
import {
  SCORED_TRANSMISSIONS,
  shareText,
  solvedOn,
  type GameState,
} from '../../shared/game';
import { Tiles } from './Tiles';

type ResultCardProps = {
  title: string;
  date: string;
  state: GameState;
  mode: 'transmit' | 'live';
};

/** The single end screen: what was decoded, how it went, and a share line. */
export const ResultCard = ({ title, date, state, mode }: ResultCardProps) => {
  const [copied, setCopied] = useState(false);
  const solved = solvedOn(state);
  const answer = state.transmissions.find((t) => t.correct)?.output ?? '';
  const share = shareText(title, date, state);

  const summary =
    mode === 'live'
      ? `Decoded in ${state.taps} ${state.taps === 1 ? 'tap' : 'taps'}.`
      : solved !== null && solved <= SCORED_TRANSMISSIONS
        ? `Decoded on transmission ${solved} of ${SCORED_TRANSMISSIONS}.`
        : `Decoded after ${SCORED_TRANSMISSIONS} misses. It still counts toward your streak.`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="sg-panel sg-result" aria-live="polite">
      <h2>Signal decoded</h2>
      <Tiles text={answer} tone="right" label="Decoded word" />
      <p>{summary}</p>
      {mode === 'transmit' && <pre className="sg-share">{share}</pre>}
      <button
        className="sg-button sg-button--quiet"
        onClick={() => void copy()}
      >
        {copied ? 'Copied' : 'Copy result'}
      </button>
    </section>
  );
};

import { useState } from 'react';
import {
  SCORED_TRANSMISSIONS,
  parShareText,
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
  /** Fewest taps that solve the puzzle, for live scoring. */
  par: number;
};

/** The single end screen: what was decoded, how it went, and a share line. */
export const ResultCard = ({
  title,
  date,
  state,
  mode,
  par,
}: ResultCardProps) => {
  const [copied, setCopied] = useState(false);
  const solved = solvedOn(state);
  const answer = state.transmissions.find((t) => t.correct)?.output ?? '';
  const share =
    mode === 'live'
      ? parShareText(title, date, state.taps, par)
      : shareText(title, date, state);

  const summary =
    mode === 'live'
      ? state.taps <= par
        ? `Decoded in ${state.taps} ${state.taps === 1 ? 'tap' : 'taps'}. That's par: a perfect route!`
        : `Decoded in ${state.taps} taps. Par was ${par}.`
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
    <section className="sg-card sg-result" aria-live="polite">
      <h2 className="sg-result-title">Signal decoded!</h2>
      <Tiles text={answer} tone="right" label="Decoded word" />
      <p>{summary}</p>
      <pre className="sg-share">{share}</pre>
      <button
        className="sg-button sg-button--quiet"
        onClick={() => void copy()}
      >
        {copied ? 'Copied' : 'Copy result'}
      </button>
    </section>
  );
};

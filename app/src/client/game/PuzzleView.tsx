import './game.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { opSymbol } from '../../shared/engine/cipher';
import {
  SCORED_TRANSMISSIONS,
  isSolved,
  newGame,
  preview,
  recordTransmission,
  scoredTriesLeft,
  tap,
  transmitBlock,
  type GameState,
} from '../../shared/game';
import type { ClientPuzzle, DayBand } from '../../shared/puzzle';
import { Board } from './Board';
import { OpLegend } from './OpLegend';
import { ResultCard } from './ResultCard';
import { Tiles, type TileTone } from './Tiles';

export type PlayMode = 'transmit' | 'live';

type PuzzleViewProps = {
  title: string;
  puzzle: ClientPuzzle;
  /**
   * `transmit`: the text is only revealed when sent, with 3 scored tries.
   * `live`: the text at Earth updates as you tap; the score is taps.
   */
  mode: PlayMode;
  /** Asks the server whether `output` is today's answer. */
  check: (output: string) => Promise<boolean>;
  onChange?: (state: GameState) => void;
  onSolved?: (state: GameState) => void;
};

const BAND_LABEL: Record<DayBand, { day: string; level: number }> = {
  mon: { day: 'Monday', level: 1 },
  tue: { day: 'Tuesday', level: 2 },
  wed: { day: 'Wednesday', level: 3 },
  thu: { day: 'Thursday', level: 4 },
  fri: { day: 'Friday', level: 5 },
  sat: { day: 'Saturday', level: 6 },
  sun: { day: 'Sunday', level: 7 },
};

const PLACEHOLDER = '·····';

export const PuzzleView = ({
  title,
  puzzle,
  mode,
  check,
  onChange,
  onSolved,
}: PuzzleViewProps) => {
  const [state, setState] = useState(() => newGame(puzzle));
  const [sending, setSending] = useState(false);
  const current = useMemo(() => preview(puzzle, state), [puzzle, state]);
  const solved = isSolved(state);
  const block = transmitBlock(state, current);
  const last = state.transmissions.at(-1);
  const reported = useRef(false);

  useEffect(() => onChange?.(state), [state, onChange]);

  useEffect(() => {
    if (solved && !reported.current) {
      reported.current = true;
      onSolved?.(state);
    }
  }, [solved, state, onSolved]);

  // Live mode: check each new text that reaches Earth. Only a correct one is recorded.
  useEffect(() => {
    if (mode !== 'live' || solved || current.output === null) return;
    let cancelled = false;
    void check(current.output).then((correct) => {
      if (!cancelled && correct) {
        setState((s) => recordTransmission(s, preview(puzzle, s), true));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mode, solved, current, check, puzzle]);

  const transmit = async () => {
    const { output } = current;
    if (block !== null || sending || output === null) return;
    setSending(true);
    try {
      const correct = await check(output);
      setState((s) => recordTransmission(s, current, correct));
    } finally {
      setSending(false);
    }
  };

  // What the Earth readout shows.
  let readout = PLACEHOLDER;
  let tone: TileTone = 'idle';
  if (mode === 'live') {
    readout = current.output ?? PLACEHOLDER;
    tone = solved ? 'right' : current.output === null ? 'lost' : 'idle';
  } else if (last) {
    readout = last.output;
    tone = last.correct ? 'right' : 'wrong';
  }

  const triesLeft = scoredTriesLeft(state);
  const firstVisit = state.taps === 0 && state.transmissions.length === 0;
  // Right after a miss the route hasn't changed yet, so say what happened
  // rather than "already sent".
  const justMissed =
    mode === 'transmit' &&
    last &&
    !last.correct &&
    last.route === current.route;
  let status = '';
  let warn = false;
  if (!solved) {
    if (firstVisit) {
      status = 'Tap a satellite to turn its reflector.';
    } else if (block === 'lost') {
      status = 'The beam is lost in space. Aim it down to Earth.';
      warn = true;
    } else if (justMissed) {
      status =
        triesLeft > 0
          ? `Not a word. ${triesLeft} scored ${triesLeft === 1 ? 'try' : 'tries'} left.`
          : 'Not a word. Keep going, but it no longer counts toward your score.';
      warn = true;
    } else if (mode === 'transmit' && block === 'repeat') {
      status = 'You already sent this route. Try another.';
      warn = true;
    } else if (mode === 'transmit') {
      status = 'The beam reaches Earth. Transmit when it spells a word.';
    }
  }
  const band = BAND_LABEL[puzzle.band];
  const trace = mode === 'live' ? current.steps : last?.steps;

  return (
    <main className="sg">
      <header className="sg-head">
        <div>
          <h1 className="sg-title">{title}</h1>
          <p className="sg-sub">
            {band.day}
            <span
              className="sg-pips"
              aria-label={`Difficulty ${band.level} of 7`}
            >
              {Array.from({ length: 7 }, (_, i) => (
                <span
                  key={i}
                  className={`sg-pip${i < band.level ? ' sg-pip--on' : ''}`}
                />
              ))}
            </span>
          </p>
        </div>
        {mode === 'transmit' && (
          <ol className="sg-tries" aria-label="Scored transmissions">
            {Array.from({ length: SCORED_TRANSMISSIONS }, (_, i) => {
              const t = state.transmissions[i];
              const kind = !t
                ? ''
                : t.correct
                  ? ' sg-try--hit'
                  : ' sg-try--miss';
              const label = !t ? 'unused' : t.correct ? 'decoded' : 'missed';
              return (
                <li
                  key={i}
                  className={`sg-try${kind}`}
                  aria-label={`Transmission ${i + 1}: ${label}`}
                >
                  {!t ? '' : t.correct ? '✓' : '✕'}
                </li>
              );
            })}
          </ol>
        )}
      </header>

      <div className="sg-signal">
        <span className="sg-label">Signal</span>
        <Tiles
          text={puzzle.ciphertext}
          tone="incoming"
          label="Incoming signal"
        />
      </div>

      <Board
        board={puzzle.board}
        settings={state.settings}
        trace={current.trace}
        locked={solved}
        onTap={(id) => setState((s) => tap(s, id))}
      />

      <div className="sg-signal">
        <span className="sg-label">Earth</span>
        <Tiles text={readout} tone={tone} label="Received on Earth" />
      </div>

      <p
        className={`sg-status${warn ? ' sg-status--warn' : ''}${firstVisit && !solved ? ' sg-status--hint' : ''}`}
        role="status"
      >
        {status}
      </p>

      {solved ? (
        <ResultCard
          title={title}
          date={puzzle.date}
          state={state}
          mode={mode}
        />
      ) : (
        mode === 'transmit' && (
          <button
            className="sg-button"
            disabled={block !== null || sending}
            onClick={() => void transmit()}
          >
            {sending ? 'Transmitting…' : 'Transmit'}
          </button>
        )
      )}

      {trace && trace.length > 0 && (
        <section className="sg-panel" aria-labelledby="sg-trace-title">
          <h2 id="sg-trace-title">
            {mode === 'live' ? 'Along the beam' : 'Last transmission'}
          </h2>
          <ol className="sg-steps">
            {trace.map((step, i) => (
              <li key={i} className="sg-step">
                <span
                  className="sg-step-op"
                  aria-label={`Satellite ${step.satelliteId}`}
                >
                  {opSymbol(step.op)}
                </span>
                <span>
                  {step.before} → {step.after}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <OpLegend board={puzzle.board} />
    </main>
  );
};

import '@fontsource/silkscreen/latin-400.css';
import '@fontsource/silkscreen/latin-700.css';
import '@fontsource/reddit-sans/latin-400.css';
import '@fontsource/reddit-sans/latin-700.css';
import './game.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { applyOp } from '../../shared/engine/cipher';
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
import { OpIcon } from './pixels';
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
  mon: { day: 'Mon', level: 1 },
  tue: { day: 'Tue', level: 2 },
  wed: { day: 'Wed', level: 3 },
  thu: { day: 'Thu', level: 4 },
  fri: { day: 'Fri', level: 5 },
  sat: { day: 'Sat', level: 6 },
  sun: { day: 'Sun', level: 7 },
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
      status =
        'Tap a satellite to turn its mirror. Each one swaps the two letters it marks.';
    } else if (block === 'lost') {
      status = 'The beam is lost in space. Bend it down to the dish.';
      warn = true;
    } else if (justMissed) {
      status =
        triesLeft > 0
          ? `Not a word. ${triesLeft} scored ${triesLeft === 1 ? 'try' : 'tries'} left.`
          : 'Not a word. Keep going, but it no longer counts toward your score.';
      warn = true;
    } else if (mode === 'live') {
      status = 'Not a word yet. Keep turning mirrors.';
    } else if (mode === 'transmit' && block === 'repeat') {
      status = 'You already sent this route. Try another.';
      warn = true;
    } else if (mode === 'transmit') {
      status = 'Signal caught! Transmit if you think it spells a word.';
    }
  }
  const band = BAND_LABEL[puzzle.band];
  // The text on each stretch of beam: the signal, then after each satellite.
  const texts = current.trace.hits.reduce<string[]>(
    (acc, s) => [...acc, applyOp(acc.at(-1) ?? '', s.op)],
    [puzzle.ciphertext]
  );
  const trace = mode === 'live' ? current.steps : last?.steps;

  return (
    <main className="sg">
      <header className="sg-head">
        <h1 className="sg-title">{title}</h1>
        <span
          className="sg-day"
          aria-label={`${band.day}, difficulty ${band.level} of 7`}
        >
          {band.day}
          <span className="sg-pips" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <span
                key={i}
                className={`sg-pip${i < band.level ? ' sg-pip--on' : ''}`}
              />
            ))}
          </span>
        </span>
        {mode === 'live' && (
          <span className="sg-taps">
            {state.taps} {state.taps === 1 ? 'tap' : 'taps'}
            <span className="sg-par">par {puzzle.par}</span>
          </span>
        )}
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
                  style={{ height: 8 + i * 6 }}
                  aria-label={`Transmission ${i + 1}: ${label}`}
                />
              );
            })}
          </ol>
        )}
      </header>

      <div className="sg-incoming">
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
        texts={texts}
      />

      <div className={`sg-receiver sg-receiver--${tone}`}>
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
          par={puzzle.par}
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
        <section className="sg-card" aria-labelledby="sg-trace-title">
          <h2 id="sg-trace-title" className="sg-card-title">
            {mode === 'live' ? 'Along the beam' : 'Last transmission'}
          </h2>
          <ol className="sg-steps">
            {trace.map((step, i) => (
              <li key={i} className="sg-step">
                <span
                  className="sg-step-op"
                  aria-label={`Satellite ${step.satelliteId}`}
                >
                  <OpIcon op={step.op} size={18} />
                </span>
                <span className="sg-step-text">
                  {step.before} <span aria-label="becomes">›</span> {step.after}
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

import '@fontsource/silkscreen/latin-400.css';
import '@fontsource/silkscreen/latin-700.css';
import '@fontsource/reddit-sans/latin-400.css';
import '@fontsource/reddit-sans/latin-700.css';
import './game.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { applyOp, opName } from '../../shared/engine/cipher';
import type { DayBand } from '../../shared/puzzle';
import {
  isFreeCell,
  newTrayGame,
  selectPiece,
  tapCell,
  tapSatellite,
  trayBoard,
  trayDecode,
  type TrayPuzzle,
  type TrayState,
} from '../../shared/tray';
import { Board } from './Board';
import { OpIcon } from './pixels';
import { SlidingTiles, Tiles, type TileTone } from './Tiles';

type TrayViewProps = {
  title: string;
  puzzle: TrayPuzzle;
  onChange?: (state: TrayState) => void;
  onSolved?: (state: TrayState) => void;
};

const DAY: Record<DayBand, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const PLACEHOLDER = '·····';

/** Spoiler-free share line, e.g. "Signal Sats Wed · 4 moves (par 3)\n🛰🛰🛰🛰📡". */
const shareLine = (title: string, day: string, moves: number, par: number) => {
  const sats = '🛰'.repeat(Math.min(moves, 12)) + (moves > 12 ? '…' : '');
  const star = moves <= par ? ' ⭐' : '';
  return `${title} ${day} · ${moves} ${moves === 1 ? 'move' : 'moves'} (par ${par})${star}\n${sats}📡`;
};

/**
 * The tray version: place satellites from the tray so the beam visits them in
 * an order that turns the scrambled signal into a word.
 */
export const TrayView = ({
  title,
  puzzle,
  onChange,
  onSolved,
}: TrayViewProps) => {
  const [state, setState] = useState(newTrayGame);
  const [copied, setCopied] = useState(false);
  const current = useMemo(() => trayDecode(puzzle, state), [puzzle, state]);
  const { board, settings } = useMemo(
    () => trayBoard(puzzle, state),
    [puzzle, state]
  );
  const solved = current.output === puzzle.answer;
  const reported = useRef(false);

  useEffect(() => onChange?.(state), [state, onChange]);
  useEffect(() => {
    if (solved && !reported.current) {
      reported.current = true;
      onSolved?.(state);
    }
  }, [solved, state, onSolved]);

  const fixedIds = useMemo(
    () => new Set(puzzle.fixed.map((f) => f.id)),
    [puzzle]
  );
  const targets = useMemo(() => {
    if (state.selected === null || solved) return [];
    return Array.from({ length: puzzle.width * puzzle.height }, (_, i) => ({
      x: i % puzzle.width,
      y: Math.floor(i / puzzle.width),
    })).filter((cell) => isFreeCell(puzzle, state, cell));
  }, [puzzle, state, solved]);

  const texts = current.trace.hits.reduce<string[]>(
    (acc, s) => [...acc, applyOp(acc.at(-1) ?? '', s.op)],
    [puzzle.ciphertext]
  );

  // Where each signal letter has moved to after the satellites on the beam,
  // so the top row can slide letters as they swap.
  const order = current.trace.hits.reduce<number[]>(
    (acc, s) => {
      if (s.op.kind !== 'trade') return acc;
      const next = [...acc];
      const { a, b } = s.op;
      [next[a], next[b]] = [acc[b] ?? b, acc[a] ?? a];
      return next;
    },
    [...puzzle.ciphertext].map((_, i) => i)
  );
  const lastOp = current.trace.hits.at(-1)?.op;
  const lastSwap = lastOp?.kind === 'trade' ? [lastOp.a, lastOp.b] : [];

  const readout = current.output ?? PLACEHOLDER;
  const tone: TileTone = solved
    ? 'right'
    : current.output === null
      ? 'lost'
      : 'idle';

  const placedCount = Object.keys(state.placed).length;
  let status: string;
  let warn = false;
  if (state.selected !== null) {
    status = 'Tap an empty square to put it there.';
  } else if (placedCount === 0) {
    status = 'Pick a satellite below, then tap a square on the board.';
  } else if (current.output === null) {
    status =
      current.trace.end.kind === 'blocked'
        ? 'The beam hit debris. Route it around.'
        : 'The beam is lost in space. Bend it down to the dish.';
    warn = true;
  } else {
    status = 'The dish has letters, but not a word yet.';
  }

  const day = DAY[puzzle.band];
  const share = shareLine(title, day, state.moves, puzzle.par);

  return (
    <main className="sg sg--tray">
      <header className="sg-head">
        <h1 className="sg-title">{title}</h1>
        <span className="sg-day">{day}</span>
        <span className="sg-taps">
          {state.moves} {state.moves === 1 ? 'move' : 'moves'}
          <span className="sg-par">par {puzzle.par}</span>
        </span>
      </header>

      <div className="sg-incoming">
        <SlidingTiles
          letters={puzzle.ciphertext}
          order={order}
          moved={lastSwap}
          label="Signal after the satellites on the beam"
        />
        <p className="sg-signal-note">
          {current.trace.hits.length === 0
            ? 'Incoming signal'
            : `Signal ${puzzle.ciphertext}, after ${current.trace.hits.length} ${current.trace.hits.length === 1 ? 'satellite' : 'satellites'}`}
        </p>
      </div>

      <Board
        board={board}
        settings={settings}
        trace={current.trace}
        locked={solved}
        onTap={(id) => setState((s) => tapSatellite(s, id))}
        texts={texts}
        fixedIds={fixedIds}
        targets={targets}
        onCellTap={(cell) => setState((s) => tapCell(puzzle, s, cell))}
      />

      <div className={`sg-receiver sg-receiver--${tone}`}>
        <Tiles text={readout} tone={tone} label="Received on Earth" />
      </div>

      {solved ? (
        <section className="sg-card sg-result" aria-live="polite">
          <h2 className="sg-result-title">Signal decoded!</h2>
          <Tiles text={puzzle.answer} tone="right" label="Decoded word" />
          <p>
            {state.moves <= puzzle.par
              ? `${state.moves} moves. That's par: a perfect build!`
              : `${state.moves} moves. Par was ${puzzle.par}.`}
          </p>
          <pre className="sg-share">{share}</pre>
          <button
            className="sg-button sg-button--quiet"
            onClick={() => {
              navigator.clipboard
                .writeText(share)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? 'Copied' : 'Copy result'}
          </button>
        </section>
      ) : (
        <>
          <section className="sg-tray" aria-label="Satellite tray">
            {puzzle.pieces.map((piece) => {
              const onBoard = state.placed[piece.id] !== undefined;
              const picked = state.selected === piece.id;
              return (
                <button
                  key={piece.id}
                  className={`sg-piece${picked ? ' sg-piece--picked' : ''}${onBoard ? ' sg-piece--placed' : ''}`}
                  aria-pressed={picked}
                  aria-label={`${opName(piece.op)}. ${onBoard ? 'On the board: tap to pick it back up.' : picked ? 'Picked up: tap a square.' : 'Tap to pick it up.'}`}
                  onClick={() => setState((s) => selectPiece(s, piece.id))}
                >
                  <span className="sg-piece-icon">
                    <OpIcon op={piece.op} size={30} />
                  </span>
                  <span className="sg-piece-label">
                    {piece.op.kind === 'trade'
                      ? `${piece.op.a + 1}⇄${piece.op.b + 1}`
                      : opName(piece.op)}
                  </span>
                  <span className="sg-piece-state">
                    {onBoard ? 'placed' : picked ? 'placing' : ''}
                  </span>
                </button>
              );
            })}
          </section>
          <p
            className={`sg-status${warn ? ' sg-status--warn' : ''}${placedCount === 0 ? ' sg-status--hint' : ''}`}
            role="status"
          >
            {status}
          </p>
        </>
      )}

      <section className="sg-card" aria-labelledby="sg-how-title">
        <h2 id="sg-how-title" className="sg-card-title">
          How it works
        </h2>
        <p className="sg-help">
          Each satellite swaps the two letters its dots mark. Place satellites
          so the beam carries the signal through them in the right order and
          down into the dish. Tap a placed satellite to turn its mirror; tap it
          in the tray to pick it back up. Bolted satellites can&apos;t move. Not
          every satellite in the tray is needed.
        </p>
      </section>
    </main>
  );
};

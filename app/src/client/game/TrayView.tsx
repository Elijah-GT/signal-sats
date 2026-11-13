import '@fontsource/silkscreen/latin-400.css';
import '@fontsource/silkscreen/latin-700.css';
import '@fontsource/reddit-sans/latin-400.css';
import '@fontsource/reddit-sans/latin-700.css';
import './game.css';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { applyOp, opName, permute } from '../../shared/engine/cipher';
import type { CipherOp, Point } from '../../shared/engine/types';
import type { DayBand } from '../../shared/puzzle';
import {
  dropPiece,
  isFreeCell,
  newTrayGame,
  pieceAt,
  selectPiece,
  tapCell,
  tapSatellite,
  trayBoard,
  trayDecode,
  type TrayPuzzle,
  type TrayState,
} from '../../shared/tray';
import { Board } from './Board';
import { cellAt, DRAG_START } from './drag';
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

/** The short name on a tray piece. */
const pieceLabel = (op: CipherOp): string =>
  op.kind === 'trade' ? `${op.a + 1}⇄${op.b + 1}` : opName(op);

/** What each kind of satellite does, for the help card. */
const KIND_HELP: Partial<Record<CipherOp['kind'], string>> = {
  trade: 'Swap: trades the two letters its dots mark.',
  reverse: 'Reverse: flips the whole signal back to front.',
  rotate: 'Rotate: moves the first letter to the end.',
};

/** A satellite being pressed or dragged, from the tray or the board. */
type Drag = {
  id: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** False until the pointer has moved far enough to count as a drag. */
  active: boolean;
  /** The board square under the pointer, if any. */
  cell: Point | null;
};

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

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

  // Dragging: a press on a piece becomes a drag once the pointer moves. On
  // release the piece drops on the square underneath (see dropPiece).
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const boardRef = useRef<SVGSVGElement>(null);
  // The click that follows a drag's release isn't a tap.
  const justDragged = useRef(false);
  const dragging = drag !== null;

  const startDrag = (id: string, e: ReactPointerEvent) => {
    if (solved || e.button !== 0) return;
    const d = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
      cell: null,
    };
    dragRef.current = d;
    setDrag(d);
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const active =
        d.active ||
        Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_START;
      const svg = boardRef.current;
      const cell = svg ? cellAt(svg, puzzle, e.clientX, e.clientY) : null;
      const next = { ...d, x: e.clientX, y: e.clientY, active, cell };
      dragRef.current = next;
      setDrag(next);
    };
    const end = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d?.active) return;
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
      const svg = boardRef.current;
      const cell =
        e.type === 'pointerup' && svg
          ? cellAt(svg, puzzle, e.clientX, e.clientY)
          : null;
      if (cell) setState((s) => dropPiece(puzzle, s, d.id, cell));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [dragging, puzzle]);

  const dropTarget = useMemo(() => {
    const cell = drag?.active ? drag.cell : null;
    if (!drag || !cell) return null;
    const other = pieceAt(state, cell);
    return isFreeCell(puzzle, state, cell) ||
      (other !== undefined && other !== drag.id)
      ? cell
      : null;
  }, [drag, puzzle, state]);
  const dragPiece = drag?.active
    ? puzzle.pieces.find((p) => p.id === drag.id)
    : undefined;

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

  // Where each signal letter has moved to after each stop on the beam, so the
  // top row can slide letters into place.
  const orders = current.trace.hits.reduce<number[][]>(
    (acc, s) => [...acc, permute(acc.at(-1) ?? [], s.op)],
    [[...puzzle.ciphertext].map((_, i) => i)]
  );
  const order = orders.at(-1) ?? [];
  const before = orders.at(-2);
  const lastMoved = before
    ? order.flatMap((o, p) => (o !== before[p] ? [p] : []))
    : [];
  const stormIds = new Set(puzzle.storms.map((s) => s.id));
  const stormHits = current.trace.hits.filter((h) => stormIds.has(h.id)).length;
  const satHits = current.trace.hits.length - stormHits;
  const kinds = [
    ...new Set(
      [...puzzle.pieces, ...puzzle.fixed, ...puzzle.storms].map(
        (s) => s.op.kind
      )
    ),
  ];
  const sampleOp = (kind: CipherOp['kind']) =>
    [...puzzle.pieces, ...puzzle.fixed, ...puzzle.storms].find(
      (s) => s.op.kind === kind
    )?.op;

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
    status = 'Tap an empty square to put it there, or a satellite to swap.';
  } else if (placedCount === 0) {
    status = 'Drag a satellite onto the board, or tap it then a square.';
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
          moved={lastMoved}
          label="Signal after the satellites on the beam"
        />
        <p className="sg-signal-note">
          {current.trace.hits.length === 0
            ? 'Incoming signal'
            : `Signal ${puzzle.ciphertext}, after ${[
                satHits ? plural(satHits, 'satellite', 'satellites') : '',
                stormHits ? plural(stormHits, 'storm', 'storms') : '',
              ]
                .filter(Boolean)
                .join(' and ')}`}
        </p>
      </div>

      <Board
        board={board}
        settings={settings}
        trace={current.trace}
        locked={solved}
        onTap={(id) => {
          if (justDragged.current) return;
          setState((s) => {
            // With a piece picked up, tapping a placed one swaps them.
            const at = s.placed[id];
            return s.selected !== null && at
              ? dropPiece(puzzle, s, s.selected, at)
              : tapSatellite(s, id);
          });
        }}
        texts={texts}
        fixedIds={fixedIds}
        targets={targets}
        onCellTap={(cell) => setState((s) => tapCell(puzzle, s, cell))}
        svgRef={boardRef}
        onSatPointerDown={(id, e) => {
          if (puzzle.pieces.some((p) => p.id === id)) startDrag(id, e);
        }}
        draggingId={drag?.active ? drag.id : null}
        dropTarget={dropTarget}
      />

      {dragPiece && drag && (
        <div
          className="sg-ghost"
          style={{ left: drag.x, top: drag.y }}
          aria-hidden="true"
        >
          <OpIcon op={dragPiece.op} size={34} />
        </div>
      )}

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
                  className={`sg-piece${picked ? ' sg-piece--picked' : ''}${onBoard ? ' sg-piece--placed' : ''}${drag?.active && drag.id === piece.id ? ' sg-piece--dragging' : ''}`}
                  aria-pressed={picked}
                  aria-label={`${opName(piece.op)}. ${onBoard ? 'On the board: tap to pick it back up.' : picked ? 'Picked up: tap a square.' : 'Tap to pick it up.'}`}
                  onPointerDown={(e) => startDrag(piece.id, e)}
                  onClick={() => {
                    if (justDragged.current) return;
                    setState((s) => selectPiece(s, piece.id));
                  }}
                >
                  <span className="sg-piece-icon">
                    <OpIcon op={piece.op} size={30} />
                  </span>
                  <span className="sg-piece-label">{pieceLabel(piece.op)}</span>
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
          Place satellites so the beam carries the signal through them in the
          right order and down into the dish. Drag satellites onto the board and
          around it; drop one on another to swap them. Tap a placed satellite to
          turn its mirror; tap it in the tray to pick it back up. Bolted
          satellites can&apos;t move. Not every satellite in the tray is needed.
        </p>
        <ul className="sg-kinds">
          {kinds.map((kind) => {
            const op = sampleOp(kind);
            const help = KIND_HELP[kind];
            if (!op || !help) return null;
            return (
              <li key={kind}>
                <OpIcon op={op} size={26} />
                <span>{help}</span>
              </li>
            );
          })}
          {puzzle.storms.length > 0 && (
            <li>
              <span className="sg-kinds-storm" aria-hidden="true" />
              <span>
                Storms: the beam goes straight through and the storm scrambles
                the signal its way, every time. Nothing can sit on a storm.
              </span>
            </li>
          )}
        </ul>
      </section>
    </main>
  );
};

import '@fontsource/silkscreen/latin-400.css';
import '@fontsource/silkscreen/latin-700.css';
import '@fontsource/reddit-sans/latin-400.css';
import '@fontsource/reddit-sans/latin-700.css';
import './game.css';

import { useMemo, useState, type ReactNode } from 'react';
import type { CipherOp } from '../../shared/engine/types';
import {
  allCells,
  applyTool,
  compileLevel,
  LEVEL_LIMITS,
  levelBoard,
  rateLevel,
  resizeLevel,
  toCode,
  turnSat,
  type Level,
  type Rating,
  type Tool,
} from '../../shared/level';
import type { TrayPuzzle } from '../../shared/tray';
import { Board } from './Board';
import { OpIcon } from './pixels';
import { Tiles } from './Tiles';

type LevelEditorProps = {
  initial: Level;
  /** Play the level as players will see it. */
  onPlay: (puzzle: TrayPuzzle, level: Level) => void;
  /** Keep the level in the maker's list. */
  onSave: (puzzle: TrayPuzzle, level: Level) => void;
};

type ToolKey =
  | 'swap'
  | 'reverse'
  | 'rotate'
  | 'storm-reverse'
  | 'storm-rotate'
  | 'debris'
  | 'erase';

const SIZES = Array.from(
  { length: LEVEL_LIMITS.maxSize - LEVEL_LIMITS.minSize + 1 },
  (_, i) => LEVEL_LIMITS.minSize + i
);
const POSITIONS = [1, 2, 3, 4, 5];

const PLACEHOLDER = '·····';

/**
 * The level editor. The maker builds the solution: satellites where they go,
 * mirrors turned the right way. The signal players get is worked out from it.
 */
export const LevelEditor = ({ initial, onPlay, onSave }: LevelEditorProps) => {
  const [level, setLevel] = useState(initial);
  const [toolKey, setToolKey] = useState<ToolKey>('swap');
  const [swapA, setSwapA] = useState(1);
  const [swapB, setSwapB] = useState(2);
  const [bolted, setBolted] = useState(false);
  const [rating, setRating] = useState<Rating | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const compiled = useMemo(() => compileLevel(level), [level]);
  const { board, settings } = useMemo(() => levelBoard(level), [level]);
  const boltedIds = useMemo(
    () => new Set(level.sats.filter((s) => s.bolted).map((s) => s.id)),
    [level]
  );
  const cells = useMemo(() => allCells(level), [level]);

  const swapOp: CipherOp = {
    kind: 'trade',
    a: Math.min(swapA, swapB) - 1,
    b: Math.max(swapA, swapB) - 1,
  };
  const tool: Tool = (() => {
    switch (toolKey) {
      case 'swap':
        return { kind: 'sat', op: swapOp, bolted };
      case 'reverse':
        return { kind: 'sat', op: { kind: 'reverse' }, bolted };
      case 'rotate':
        return { kind: 'sat', op: { kind: 'rotate' }, bolted };
      case 'storm-reverse':
        return { kind: 'storm', op: { kind: 'reverse' } };
      case 'storm-rotate':
        return { kind: 'storm', op: { kind: 'rotate' } };
      case 'debris':
        return { kind: 'debris' };
      case 'erase':
        return { kind: 'erase' };
    }
  })();

  // Any change to the level makes the old rating and code out of date.
  const change = (next: Level) => {
    setLevel(next);
    setRating(null);
    setCode(null);
    setCopied(false);
  };

  /** The puzzle with par filled in, rating it on the way. */
  const finished = (): TrayPuzzle | null => {
    if (!compiled.puzzle) return null;
    const r = rating ?? rateLevel(compiled.puzzle);
    setRating(r);
    return { ...compiled.puzzle, par: r.par };
  };

  const ready = compiled.problems.length === 0;
  const toolButton = (key: ToolKey, label: string, icon: ReactNode) => (
    <button
      key={key}
      className={`sg-tool${toolKey === key ? ' sg-tool--on' : ''}`}
      aria-pressed={toolKey === key}
      onClick={() => setToolKey(key)}
    >
      <span className="sg-tool-icon">{icon}</span>
      <span className="sg-tool-label">{label}</span>
    </button>
  );

  return (
    <main className="sg sg--tray sg-editor">
      <header className="sg-head">
        <h1 className="sg-title">Make a level</h1>
      </header>

      <section className="sg-card sg-editor-setup">
        <label className="sg-field">
          Hidden word
          <input
            value={level.answer}
            maxLength={5}
            placeholder="ORBIT"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) =>
              change({
                ...level,
                answer: e.target.value.toUpperCase().replace(/[^A-Z]/g, ''),
              })
            }
          />
        </label>
        <label className="sg-field">
          Width
          <select
            value={level.width}
            onChange={(e) =>
              change(resizeLevel(level, Number(e.target.value), level.height))
            }
          >
            {SIZES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="sg-field">
          Height
          <select
            value={level.height}
            onChange={(e) =>
              change(resizeLevel(level, level.width, Number(e.target.value)))
            }
          >
            {SIZES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="sg-field">
          Signal enters
          <select
            value={level.source}
            onChange={(e) =>
              change({ ...level, source: Number(e.target.value) })
            }
          >
            {Array.from({ length: level.width }, (_, i) => (
              <option key={i} value={i}>
                column {i + 1}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section
        className="sg-palette"
        aria-label="What a tap on the board puts there"
      >
        <div className="sg-palette-row">
          {toolButton(
            'swap',
            `${swapA}⇄${swapB}`,
            <OpIcon op={swapOp} size={26} />
          )}
          <span className="sg-swap-pick">
            <select
              aria-label="First letter to swap"
              value={swapA}
              onChange={(e) => {
                const a = Number(e.target.value);
                setSwapA(a);
                if (a === swapB) setSwapB(a === 5 ? 4 : a + 1);
                setToolKey('swap');
              }}
            >
              {POSITIONS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            <select
              aria-label="Second letter to swap"
              value={swapB}
              onChange={(e) => {
                setSwapB(Number(e.target.value));
                setToolKey('swap');
              }}
            >
              {POSITIONS.filter((n) => n !== swapA).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </span>
          {toolButton(
            'reverse',
            'Reverse',
            <OpIcon op={{ kind: 'reverse' }} size={26} />
          )}
          {toolButton(
            'rotate',
            'Rotate',
            <OpIcon op={{ kind: 'rotate' }} size={26} />
          )}
          <label className="sg-bolted">
            <input
              type="checkbox"
              checked={bolted}
              onChange={(e) => setBolted(e.target.checked)}
            />
            Bolted
          </label>
        </div>
        <div className="sg-palette-row">
          {toolButton(
            'storm-reverse',
            'Storm: Rev',
            <span className="sg-kinds-storm" />
          )}
          {toolButton(
            'storm-rotate',
            'Storm: Rot',
            <span className="sg-kinds-storm" />
          )}
          {toolButton('debris', 'Debris', <span className="sg-tool-rock" />)}
          {toolButton('erase', 'Erase', <span className="sg-tool-x">×</span>)}
        </div>
      </section>

      <div className="sg-incoming">
        <Tiles
          text={compiled.ciphertext ?? PLACEHOLDER}
          tone="incoming"
          label="The signal players get"
        />
        <p className="sg-signal-note">The signal players get</p>
      </div>

      <Board
        board={board}
        settings={settings}
        trace={compiled.trace}
        locked={false}
        editing
        onTap={(id) => {
          const sat = level.sats.find((s) => s.id === id);
          if (!sat) return;
          change(
            toolKey === 'erase'
              ? applyTool(level, sat, { kind: 'erase' })
              : turnSat(level, id)
          );
        }}
        {...(compiled.texts.length > 0 ? { texts: compiled.texts } : {})}
        fixedIds={boltedIds}
        targets={cells}
        onCellTap={(cell) => change(applyTool(level, cell, tool))}
      />

      <section className="sg-card" aria-live="polite">
        {ready ? (
          <p className="sg-editor-ok">
            Ready to play.
            {rating &&
              ` ${rating.difficulty} · par ${rating.par} · ${rating.orders} ${rating.orders === 1 ? 'way' : 'ways'} to solve`}
          </p>
        ) : (
          <ul className="sg-problems">
            {compiled.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="sg-editor-actions">
          <button
            className="sg-button"
            disabled={!ready}
            onClick={() => {
              const puzzle = finished();
              if (puzzle) onPlay(puzzle, level);
            }}
          >
            Test play
          </button>
          <button
            className="sg-button sg-button--quiet"
            disabled={!ready}
            onClick={() => {
              const puzzle = finished();
              if (puzzle) onSave(puzzle, level);
            }}
          >
            Save
          </button>
          <button
            className="sg-button sg-button--quiet"
            disabled={!ready}
            onClick={() => {
              const puzzle = finished();
              if (!puzzle) return;
              const text = toCode(puzzle);
              setCode(text);
              navigator.clipboard
                .writeText(text)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? 'Code copied' : 'Share code'}
          </button>
        </div>
        {code && (
          <input
            className="sg-code"
            readOnly
            value={code}
            aria-label="Share code"
            onFocus={(e) => e.currentTarget.select()}
          />
        )}
      </section>

      <section className="sg-card">
        <h2 className="sg-card-title">How to make a level</h2>
        <p className="sg-help">
          Type the word to hide, then build the solution: pick a tool and tap
          squares to place satellites, storms and debris. Tap a satellite to
          turn its mirror. The beam shows your route; get it into the dish. The
          signal players get is worked out for you. When they play, movable
          satellites go back into the tray, and any the beam doesn&apos;t touch
          become decoys. Bolted ones stay put.
        </p>
      </section>
    </main>
  );
};

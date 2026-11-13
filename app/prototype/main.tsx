import './prototype.css';

import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import { PuzzleView, type PlayMode } from '../src/client/game/PuzzleView';
import { TrayView } from '../src/client/game/TrayView';
import { solvedOn, type GameState } from '../src/shared/game';
import { toClientPuzzle, type Puzzle } from '../src/shared/puzzle';
import type { TrayPuzzle, TrayState } from '../src/shared/tray';
import { generateTray, PRACTICE, type Difficulty } from '../src/shared/trayGen';
import { EditorApp } from './EditorApp';
import { formatLog, loadLog, saveLog, type LogEntry } from './playtest';

// Every puzzle, bundled in. Fine for a prototype; the real game keeps answers
// on the server.
const modules = import.meta.glob('../content/puzzles/*.json', {
  eager: true,
  import: 'default',
});
const isPuzzle = (value: unknown): value is Puzzle =>
  typeof value === 'object' &&
  value !== null &&
  'date' in value &&
  'answer' in value &&
  'board' in value &&
  'ciphertext' in value;
const PUZZLES = Object.values(modules)
  .filter(isPuzzle)
  .sort((a, b) => a.date.localeCompare(b.date));

const trayModules = import.meta.glob('../content/tray/puzzles.json', {
  eager: true,
  import: 'default',
});
const isTrayPuzzle = (value: unknown): value is TrayPuzzle =>
  typeof value === 'object' &&
  value !== null &&
  'pieces' in value &&
  'fixed' in value &&
  'answer' in value &&
  'par' in value;
const TRAY_PUZZLES = Object.values(trayModules)
  .flatMap((v) => (Array.isArray(v) ? v : []))
  .filter(isTrayPuzzle);

// The first storm puzzles, made by hand: harder than the generated dailies.
const hardModules = import.meta.glob('../content/tray/puzzles-hard.json', {
  eager: true,
  import: 'default',
});
const HARD_PUZZLES = Object.values(hardModules)
  .flatMap((v) => (Array.isArray(v) ? v : []))
  .filter(isTrayPuzzle);

// The tray version before storms and Reverse/Rotate satellites: swaps only.
const swapModules = import.meta.glob('../content/tray/puzzles-swaps.json', {
  eager: true,
  import: 'default',
});
const SWAP_PUZZLES = Object.values(swapModules)
  .flatMap((v) => (Array.isArray(v) ? v : []))
  .filter(isTrayPuzzle);

const TITLE = 'Signal Sats';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Version = 'tray' | 'practice' | 'make' | 'hard' | 'swaps' | 'toggle';
const VERSIONS: { value: Version; label: string }[] = [
  { value: 'tray', label: 'Daily' },
  { value: 'practice', label: 'Practice' },
  { value: 'make', label: 'Make a level' },
  { value: 'hard', label: 'Daily: hard set (previous)' },
  { value: 'swaps', label: 'Daily: swaps only (older)' },
  { value: 'toggle', label: 'Toggle (oldest)' },
];
const isVersion = (v: string): v is Version =>
  VERSIONS.some((o) => o.value === v);
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const isDifficulty = (v: string): v is Difficulty =>
  DIFFICULTIES.some((d) => d === v);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
type AppProps = { picker: ReactNode; add: (entry: LogEntry) => void };
type TrayAppProps = AppProps & { puzzles: readonly TrayPuzzle[] };

/** The tray version: place satellites so the beam unscrambles the word. */
const TrayApp = ({ picker, add, puzzles }: TrayAppProps) => {
  const [index, setIndex] = useState(0);
  const [run, setRun] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const latest = useRef<TrayState | null>(null);
  const startedAt = useRef(Date.now());
  const puzzle = puzzles[index];

  useEffect(() => {
    startedAt.current = Date.now();
    latest.current = null;
    setRevealed(false);
    setFinished(false);
  }, [index, run]);

  const record = useCallback(
    (solved: boolean, state: TrayState | null) => {
      if (!puzzle) return;
      add({
        date: puzzle.id,
        band: puzzle.band,
        mode: 'tray',
        solved,
        solvedOn: null,
        transmissions: 0,
        taps: state?.moves ?? 0,
        seconds: Math.round((Date.now() - startedAt.current) / 1000),
      });
      setFinished(true);
    },
    [puzzle, add]
  );
  const onChange = useCallback((state: TrayState) => {
    latest.current = state;
  }, []);
  const onSolved = useCallback(
    (state: TrayState) => record(true, state),
    [record]
  );

  if (!puzzle) {
    return (
      <p className="pt-note">
        No tray puzzles found. Run <code>npm run tray:build</code> first.
      </p>
    );
  }

  return (
    <>
      <div className="pt-bar">
        {picker}
        <label>
          Puzzle
          <select
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
          >
            {puzzles.map((p, i) => (
              <option key={p.id} value={i}>
                {p.band}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => setRun((r) => r + 1)}>Restart</button>
        {!finished && (
          <button
            onClick={() => {
              record(false, latest.current);
              setRevealed(true);
            }}
          >
            Give up
          </button>
        )}
      </div>
      {revealed && (
        <p className="pt-note">
          The word was <b className="pt-reveal">{puzzle.answer}</b>.
        </p>
      )}
      <TrayView
        key={`${puzzle.id}-${run}`}
        title={TITLE}
        puzzle={puzzle}
        onChange={onChange}
        onSolved={onSolved}
      />
    </>
  );
};

/** Practice: endless generated puzzles at a chosen difficulty. */
const PracticeApp = ({ picker, add }: AppProps) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  // A fresh seed per puzzle; the same seed rebuilds the same puzzle.
  const [seed, setSeed] = useState(() => `practice:${Date.now()}`);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const latest = useRef<TrayState | null>(null);
  const startedAt = useRef(Date.now());
  const puzzle = useMemo(
    () => generateTray(PRACTICE[difficulty], `${seed}:${difficulty}`),
    [difficulty, seed]
  );

  useEffect(() => {
    startedAt.current = Date.now();
    latest.current = null;
    setRevealed(false);
    setFinished(false);
  }, [puzzle]);

  const record = useCallback(
    (solved: boolean, state: TrayState | null) => {
      add({
        date: puzzle.answer,
        band: difficulty,
        mode: 'practice',
        solved,
        solvedOn: null,
        transmissions: 0,
        taps: state?.moves ?? 0,
        seconds: Math.round((Date.now() - startedAt.current) / 1000),
      });
      setFinished(true);
    },
    [puzzle, difficulty, add]
  );
  const onChange = useCallback((state: TrayState) => {
    latest.current = state;
  }, []);
  const onSolved = useCallback(
    (state: TrayState) => record(true, state),
    [record]
  );

  return (
    <>
      <div className="pt-bar">
        {picker}
        <label>
          Difficulty
          <select
            value={difficulty}
            onChange={(e) => {
              const v = e.target.value;
              if (isDifficulty(v)) setDifficulty(v);
            }}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {capital(d)}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => setSeed(`practice:${Date.now()}`)}>
          New puzzle
        </button>
        {!finished && (
          <button
            onClick={() => {
              record(false, latest.current);
              setRevealed(true);
            }}
          >
            Give up
          </button>
        )}
      </div>
      {revealed && (
        <p className="pt-note">
          The word was <b className="pt-reveal">{puzzle.answer}</b>.
        </p>
      )}
      <TrayView
        key={`${seed}-${difficulty}`}
        title={TITLE}
        label={capital(difficulty)}
        puzzle={puzzle}
        onChange={onChange}
        onSolved={onSolved}
      />
    </>
  );
};

/** The earlier version: turn satellites already on the board. */
const ToggleApp = ({ picker, add }: AppProps) => {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<PlayMode>('live');
  const [run, setRun] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const latest = useRef<GameState | null>(null);
  const startedAt = useRef(Date.now());
  const puzzle = PUZZLES[index];

  useEffect(() => {
    startedAt.current = Date.now();
    latest.current = null;
    setRevealed(false);
    setFinished(false);
  }, [index, mode, run]);

  const answer = puzzle?.answer;
  const check = useCallback(
    async (output: string) => {
      await sleep(250); // stand-in for the round trip to the server
      return output === answer;
    },
    [answer]
  );

  const record = useCallback(
    (solved: boolean, state: GameState | null) => {
      if (!puzzle) return;
      add({
        date: puzzle.date,
        band: puzzle.band,
        mode,
        solved,
        solvedOn: state ? solvedOn(state) : null,
        transmissions: state?.transmissions.length ?? 0,
        taps: state?.taps ?? 0,
        seconds: Math.round((Date.now() - startedAt.current) / 1000),
      });
      setFinished(true);
    },
    [puzzle, mode, add]
  );

  const onChange = useCallback((state: GameState) => {
    latest.current = state;
  }, []);
  const onSolved = useCallback(
    (state: GameState) => record(true, state),
    [record]
  );

  if (!puzzle) {
    return (
      <p className="pt-note">
        No puzzles found. Run{' '}
        <code>npm run puzzles:generate -- content/weeks/sample.json</code>{' '}
        first.
      </p>
    );
  }

  return (
    <>
      <div className="pt-bar">
        {picker}
        <label>
          Puzzle
          <select
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
          >
            {PUZZLES.map((p, i) => (
              <option key={p.date} value={i}>
                {p.date} · {p.band}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mode
          <select
            value={mode}
            onChange={(e) =>
              setMode(e.target.value === 'live' ? 'live' : 'transmit')
            }
          >
            <option value="live">Live decode</option>
            <option value="transmit">3 transmissions</option>
          </select>
        </label>
        <button onClick={() => setRun((r) => r + 1)}>Restart</button>
        {!finished && (
          <button
            onClick={() => {
              record(false, latest.current);
              setRevealed(true);
            }}
          >
            Give up
          </button>
        )}
      </div>
      {revealed && (
        <p className="pt-note">
          The answer was <b className="pt-reveal">{puzzle.answer}</b>.
        </p>
      )}

      <PuzzleView
        key={`${puzzle.date}-${mode}-${run}`}
        title={TITLE}
        puzzle={toClientPuzzle(puzzle)}
        mode={mode}
        check={check}
        onChange={onChange}
        onSolved={onSolved}
      />
    </>
  );
};

const modeLabel = (mode: LogEntry['mode']): string =>
  mode === 'tray' || mode === 'practice'
    ? mode
    : mode === 'live'
      ? 'live'
      : '3 tries';

const LogPanel = ({
  log,
  clear,
}: {
  log: readonly LogEntry[];
  clear: () => void;
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>(
    'idle'
  );
  return (
    <section className="pt-log">
      <h2>Your playtest results ({log.length})</h2>
      {log.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Version</th>
                <th>Result</th>
                <th>Moves</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {log.map((e, i) => (
                <tr key={i}>
                  <td>{e.band}</td>
                  <td>{modeLabel(e.mode)}</td>
                  <td>
                    {!e.solved
                      ? 'gave up'
                      : e.mode === 'transmit'
                        ? `solved on ${e.solvedOn ?? '?'}`
                        : 'solved'}
                  </td>
                  <td>{e.taps}</td>
                  <td>{e.seconds}s</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pt-actions">
            <button
              onClick={() => {
                navigator.clipboard
                  .writeText(formatLog(log))
                  .then(() => setCopyState('copied'))
                  .catch(() => setCopyState('manual'));
              }}
            >
              {copyState === 'copied' ? 'Copied' : 'Copy results'}
            </button>
            <button
              onClick={() => {
                clear();
                setCopyState('idle');
              }}
            >
              Clear
            </button>
          </div>
          {copyState === 'manual' && (
            <>
              <p className="pt-note pt-note--flush">
                Copying is blocked here. Select the text below and copy it.
              </p>
              <textarea
                className="pt-results"
                readOnly
                value={formatLog(log)}
                onFocus={(e) => e.currentTarget.select()}
              />
            </>
          )}
        </>
      )}
    </section>
  );
};

const Root = () => {
  const [version, setVersion] = useState<Version>('tray');
  const [log, setLog] = useState<LogEntry[]>(loadLog);
  const add = useCallback((entry: LogEntry) => {
    setLog((prev) => {
      const next = [...prev, entry];
      saveLog(next);
      return next;
    });
  }, []);
  const clear = useCallback(() => {
    saveLog([]);
    setLog([]);
  }, []);

  const picker = (
    <label>
      Version
      <select
        value={version}
        onChange={(e) => {
          const v = e.target.value;
          if (isVersion(v)) setVersion(v);
        }}
      >
        {VERSIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      {version === 'toggle' ? (
        <ToggleApp picker={picker} add={add} />
      ) : version === 'practice' ? (
        <PracticeApp picker={picker} add={add} />
      ) : version === 'make' ? (
        <EditorApp picker={picker} />
      ) : (
        <TrayApp
          key={version}
          picker={picker}
          add={add}
          puzzles={
            version === 'swaps'
              ? SWAP_PUZZLES
              : version === 'hard'
                ? HARD_PUZZLES
                : TRAY_PUZZLES
          }
        />
      )}
      <LogPanel log={log} clear={clear} />
    </>
  );
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Root />
    </StrictMode>
  );
}

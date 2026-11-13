import './prototype.css';

import {
  StrictMode,
  useCallback,
  useEffect,
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

const TITLE = 'Signal Sats';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Version = 'tray' | 'toggle';
type AppProps = { picker: ReactNode; add: (entry: LogEntry) => void };

/** The tray version: place satellites so the beam unscrambles the word. */
const TrayApp = ({ picker, add }: AppProps) => {
  const [index, setIndex] = useState(0);
  const [run, setRun] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const latest = useRef<TrayState | null>(null);
  const startedAt = useRef(Date.now());
  const puzzle = TRAY_PUZZLES[index];

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
            {TRAY_PUZZLES.map((p, i) => (
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
  mode === 'tray' ? 'tray' : mode === 'live' ? 'live' : '3 tries';

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
        onChange={(e) =>
          setVersion(e.target.value === 'toggle' ? 'toggle' : 'tray')
        }
      >
        <option value="tray">Tray (new)</option>
        <option value="toggle">Toggle (old)</option>
      </select>
    </label>
  );

  return (
    <>
      {version === 'tray' ? (
        <TrayApp picker={picker} add={add} />
      ) : (
        <ToggleApp picker={picker} add={add} />
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

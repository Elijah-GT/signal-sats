import './prototype.css';

import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PuzzleView, type PlayMode } from '../src/client/game/PuzzleView';
import { solvedOn, type GameState } from '../src/shared/game';
import { toClientPuzzle, type Puzzle } from '../src/shared/puzzle';
import { formatLog, loadLog, saveLog, type LogEntry } from './playtest';

// Every generated puzzle, bundled in. Fine for a prototype; the real game
// keeps answers on the server.
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

const TITLE = 'Signal Sats';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const App = () => {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<PlayMode>('transmit');
  const [run, setRun] = useState(0);
  const [log, setLog] = useState<LogEntry[]>(loadLog);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>(
    'idle'
  );
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
      const entry: LogEntry = {
        date: puzzle.date,
        band: puzzle.band,
        mode,
        solved,
        solvedOn: state ? solvedOn(state) : null,
        transmissions: state?.transmissions.length ?? 0,
        taps: state?.taps ?? 0,
        seconds: Math.round((Date.now() - startedAt.current) / 1000),
      };
      setLog((prev) => {
        const next = [...prev, entry];
        saveLog(next);
        return next;
      });
      setFinished(true);
    },
    [puzzle, mode]
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
            <option value="transmit">3 transmissions</option>
            <option value="live">Live decode</option>
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

      <section className="pt-log">
        <h2>Your playtest results ({log.length})</h2>
        {log.length > 0 && (
          <>
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Mode</th>
                  <th>Result</th>
                  <th>Taps</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {log.map((e, i) => (
                  <tr key={i}>
                    <td>{e.band}</td>
                    <td>{e.mode === 'live' ? 'live' : '3 tries'}</td>
                    <td>
                      {e.solved
                        ? e.mode === 'live'
                          ? 'solved'
                          : `solved on ${e.solvedOn ?? '?'}`
                        : 'gave up'}
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
                  saveLog([]);
                  setLog([]);
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
                  id="pt-results-text"
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
    </>
  );
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

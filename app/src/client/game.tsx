import './app.css';

import { navigateTo } from '@devvit/web/client';
import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CheckResponse, InitResponse, PostStats } from '../shared/api';
import { emptyLevel, type Level } from '../shared/level';
import type { TrayPuzzle, TrayState } from '../shared/tray';
import { generateTray, PRACTICE, type Difficulty } from '../shared/trayGen';
import { LevelEditor } from './game/LevelEditor';
import { Tiles } from './game/Tiles';
import { TrayView } from './game/TrayView';
import { checkLayout, fetchInit, postLevel } from './net';

const TITLE = 'Signal Sats';
type Tab = 'today' | 'practice' | 'make';
type Solved = Extract<CheckResponse, { correct: true }>;

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
const message = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong.';

/** "🔥 3-day streak · 12 of 40 players decoded it". */
const statsLine = (
  stats: PostStats,
  streak: number,
  daily: boolean,
  loggedIn: boolean
): string =>
  [
    daily && streak > 0 ? `🔥 ${streak}-day streak` : '',
    `${stats.solves} of ${plural(Math.max(stats.players, 1), 'player', 'players')} decoded it`,
    loggedIn ? '' : 'Log in to keep your results',
  ]
    .filter(Boolean)
    .join(' · ');

/** The post's own puzzle: today's daily, or a player's level. */
const TodayTab = ({
  init,
  error,
  onPractice,
}: {
  init: InitResponse | null;
  error: string | null;
  onPractice: () => void;
}) => {
  const [solved, setSolved] = useState<Solved | null>(null);
  const [replay, setReplay] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // The server runs the beam itself and says whether the word is right.
  const check = useCallback(async (state: TrayState) => {
    try {
      const reply = await checkLayout({
        placed: state.placed,
        moves: state.moves,
      });
      setCheckError(null);
      if (reply.correct) setSolved(reply);
      return reply.correct;
    } catch (e) {
      setCheckError(message(e));
      throw e;
    }
  }, []);

  if (error) {
    return (
      <>
        <p className="app-note app-note--warn">{error}</p>
        <div className="app-row">
          <button className="sg-button" onClick={onPractice}>
            Play practice puzzles
          </button>
        </div>
      </>
    );
  }
  if (!init) return <p className="app-note">Tuning in…</p>;

  const { post, puzzle } = init;
  const daily = post.kind === 'daily';
  const label = daily ? `#${post.number}` : 'Level';
  const loggedIn = init.username !== null;
  const stats = solved?.stats ?? init.stats;
  const streak = solved ? solved.streak : init.streak;
  const byline = !daily && post.author && (
    <p className="app-note">A level by u/{post.author}</p>
  );

  if (init.mine && !replay && !solved) {
    return (
      <>
        {byline}
        <section className="sg sg-card sg-result app-done">
          <h2 className="sg-result-title">Already decoded</h2>
          <Tiles text={init.mine.word} tone="right" label="Decoded word" />
          <p>
            You did it in {plural(init.mine.moves, 'move', 'moves')} (par{' '}
            {puzzle.par}).
          </p>
          <p className="sg-result-extra">
            {statsLine(stats, streak, daily, loggedIn)}
          </p>
        </section>
        <div className="app-row">
          <button className="sg-button" onClick={() => setReplay(true)}>
            Play it again
          </button>
          <button className="sg-button sg-button--quiet" onClick={onPractice}>
            Practice
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {byline}
      {checkError && <p className="app-note app-note--warn">{checkError}</p>}
      <TrayView
        title={TITLE}
        label={label}
        puzzle={puzzle}
        check={check}
        resultExtra={
          solved && (
            <p className="sg-result-extra">
              {statsLine(stats, streak, daily, loggedIn)}
            </p>
          )
        }
      />
    </>
  );
};

/** Endless generated puzzles at a chosen difficulty. */
const PracticeTab = () => {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [seed, setSeed] = useState(() => `practice:${Date.now()}`);
  const puzzle = useMemo(() => {
    try {
      return generateTray(PRACTICE[difficulty], `${seed}:${difficulty}`);
    } catch {
      return null;
    }
  }, [difficulty, seed]);
  const check = useCallback(
    (_state: TrayState, output: string) => output === puzzle?.answer,
    [puzzle]
  );

  return (
    <>
      <div className="app-row">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            className="app-chip"
            aria-pressed={d === difficulty}
            onClick={() => setDifficulty(d)}
          >
            {capital(d)}
          </button>
        ))}
        <button
          className="app-chip"
          onClick={() => setSeed(`practice:${Date.now()}`)}
        >
          New puzzle
        </button>
      </div>
      {puzzle ? (
        <TrayView
          key={`${seed}:${difficulty}`}
          title={TITLE}
          label={capital(difficulty)}
          puzzle={puzzle}
          check={check}
        />
      ) : (
        <p className="app-note app-note--warn">
          Couldn&apos;t build a puzzle. Try New puzzle.
        </p>
      )}
    </>
  );
};

/** The level editor: test a level, then post it for others to play. */
const MakeTab = () => {
  const [draft, setDraft] = useState<Level>(emptyLevel);
  const [testing, setTesting] = useState<TrayPuzzle | null>(null);
  const [posting, setPosting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (testing) {
    return (
      <>
        <div className="app-row">
          <button className="app-chip" onClick={() => setTesting(null)}>
            Back to editor
          </button>
        </div>
        <TrayView
          title={TITLE}
          label="Test"
          puzzle={testing}
          check={(_state, output) => output === testing.answer}
        />
      </>
    );
  }

  return (
    <>
      {note && <p className="app-note app-note--warn">{note}</p>}
      <LevelEditor
        initial={draft}
        onChange={setDraft}
        onPlay={(puzzle, level) => {
          setDraft(level);
          setTesting(puzzle);
        }}
        saveLabel={posting ? 'Posting…' : 'Post it'}
        share={false}
        onSave={(puzzle) => {
          if (posting) return;
          setPosting(true);
          setNote(null);
          postLevel(puzzle)
            .then((url) => navigateTo(url))
            .catch((e: unknown) => setNote(message(e)))
            .finally(() => setPosting(false));
        }}
      />
    </>
  );
};

export const App = () => {
  const [init, setInit] = useState<InitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  // Tabs stay mounted once opened, so switching keeps your board.
  const [opened, setOpened] = useState<ReadonlySet<Tab>>(new Set(['today']));

  useEffect(() => {
    fetchInit()
      .then(setInit)
      .catch((e: unknown) => setError(message(e)));
  }, []);

  const open = (t: Tab) => {
    setTab(t);
    setOpened((prev) => new Set([...prev, t]));
  };
  const tabs: { id: Tab; label: string }[] = [
    { id: 'today', label: init?.post.kind === 'custom' ? 'Level' : 'Today' },
    { id: 'practice', label: 'Practice' },
    { id: 'make', label: 'Make' },
  ];

  return (
    <>
      <nav className="app-nav" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            className="app-tab"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => open(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {opened.has('today') && (
        <div hidden={tab !== 'today'}>
          <TodayTab
            init={init}
            error={error}
            onPractice={() => open('practice')}
          />
        </div>
      )}
      {opened.has('practice') && (
        <div hidden={tab !== 'practice'}>
          <PracticeTab />
        </div>
      )}
      {opened.has('make') && (
        <div hidden={tab !== 'make'}>
          <MakeTab />
        </div>
      )}
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

import { useState, type ReactNode } from 'react';
import { LevelEditor } from '../src/client/game/LevelEditor';
import { TrayView } from '../src/client/game/TrayView';
import { emptyLevel, fromCode, toCode, type Level } from '../src/shared/level';
import type { TrayPuzzle } from '../src/shared/tray';

// Levels live in this browser only. The real game would post them to Reddit.
const LEVELS_KEY = 'signal-sats-levels';
const DRAFT_KEY = 'signal-sats-draft';

type Saved = { name: string; level: Level; code: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Loose check: a stored level from this prototype, not untrusted input. */
const isLevel = (v: unknown): v is Level =>
  isRecord(v) &&
  typeof v['answer'] === 'string' &&
  Array.isArray(v['sats']) &&
  Array.isArray(v['storms']) &&
  Array.isArray(v['debris']);

const read = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked or full: the level just isn't kept.
  }
};

const loadSaved = (): Saved[] => {
  const data = read(LEVELS_KEY);
  if (!Array.isArray(data)) return [];
  return data.flatMap((s: unknown) =>
    isRecord(s) &&
    typeof s['name'] === 'string' &&
    typeof s['code'] === 'string' &&
    isLevel(s['level']) &&
    fromCode(s['code'])
      ? [{ name: s['name'], level: s['level'], code: s['code'] }]
      : []
  );
};

const loadDraft = (): Level => {
  const data = read(DRAFT_KEY);
  return isLevel(data) ? data : emptyLevel();
};

type Playing = { puzzle: TrayPuzzle; from: 'editor' | 'list' | 'code' };

/** Make a level, test it, save it, share it as a code, or play someone's code. */
export const EditorApp = ({ picker }: { picker: ReactNode }) => {
  const [draft, setDraft] = useState(loadDraft);
  // Bumped to restart the editor on a different level.
  const [editorKey, setEditorKey] = useState(0);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [saved, setSaved] = useState(loadSaved);
  const [codeInput, setCodeInput] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const keep = (next: Saved[]) => {
    setSaved(next);
    write(LEVELS_KEY, next);
  };
  const edit = (level: Level) => {
    setDraft(level);
    write(DRAFT_KEY, level);
    setEditorKey((k) => k + 1);
    setPlaying(null);
  };

  if (playing) {
    return (
      <>
        <div className="pt-bar">
          {picker}
          <button onClick={() => setPlaying(null)}>
            {playing.from === 'editor' ? 'Back to editor' : 'Back'}
          </button>
        </div>
        <TrayView
          key={toCode(playing.puzzle)}
          title="Signal Sats"
          label="Custom"
          puzzle={playing.puzzle}
        />
      </>
    );
  }

  return (
    <>
      <div className="pt-bar">
        {picker}
        <button onClick={() => edit(emptyLevel())}>New level</button>
      </div>
      {note && <p className="pt-note">{note}</p>}

      <LevelEditor
        key={editorKey}
        initial={draft}
        onPlay={(puzzle, level) => {
          setDraft(level);
          write(DRAFT_KEY, level);
          setPlaying({ puzzle, from: 'editor' });
        }}
        onSave={(puzzle, level) => {
          setDraft(level);
          write(DRAFT_KEY, level);
          const code = toCode(puzzle);
          keep([
            ...saved.filter((s) => s.code !== code),
            { name: `${puzzle.answer} · par ${puzzle.par}`, level, code },
          ]);
          setNote(`Saved ${puzzle.answer}.`);
        }}
      />

      <section className="pt-log">
        <h2>Play a share code</h2>
        <div className="pt-actions">
          <input
            className="pt-code"
            value={codeInput}
            placeholder="Paste a code"
            onChange={(e) => setCodeInput(e.target.value)}
          />
          <button
            onClick={() => {
              const puzzle = fromCode(codeInput);
              if (puzzle) {
                setNote(null);
                setPlaying({ puzzle, from: 'code' });
              } else {
                setNote("That code didn't work. Check it was copied whole.");
              }
            }}
          >
            Play
          </button>
        </div>

        <h2>Your levels ({saved.length})</h2>
        {saved.length === 0 && (
          <p className="pt-note pt-note--flush">
            Levels you save show up here.
          </p>
        )}
        <ul className="pt-levels">
          {saved.map((s) => (
            <li key={s.code}>
              <span>{s.name}</span>
              <button
                onClick={() => {
                  const puzzle = fromCode(s.code);
                  if (puzzle) setPlaying({ puzzle, from: 'list' });
                }}
              >
                Play
              </button>
              <button onClick={() => edit(s.level)}>Edit</button>
              <button
                onClick={() => {
                  navigator.clipboard
                    .writeText(s.code)
                    .then(() => setNote(`Copied the code for ${s.name}.`))
                    .catch(() => setNote(s.code));
                }}
              >
                Copy code
              </button>
              <button onClick={() => keep(saved.filter((x) => x !== s))}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
};

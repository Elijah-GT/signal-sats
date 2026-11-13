import '@fontsource/silkscreen/latin-700.css';
import '@fontsource/reddit-sans/latin-400.css';
import './game/game.css';
import './app.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { InitResponse } from '../shared/api';
import { Tiles } from './game/Tiles';
import { fetchInit } from './net';

const DAY: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** The sticker from the post's own data, so it shows before the server answers. */
const sticker = (): string => {
  const d = context.postData;
  if (!isRecord(d)) return '';
  if (d['kind'] === 'daily') {
    const band = typeof d['band'] === 'string' ? (DAY[d['band']] ?? '') : '';
    const number = typeof d['number'] === 'number' ? d['number'] : '';
    return `#${number} · ${band}`;
  }
  return typeof d['author'] === 'string' && d['author']
    ? `Level by u/${d['author']}`
    : 'Level';
};

/** One line on how it's going: your result, or how many have solved it. */
const status = (init: InitResponse | null): string => {
  if (!init) return '';
  if (init.mine) return `✓ You decoded it in ${init.mine.moves} moves`;
  const n = init.stats.solves;
  if (n === 0) return 'Be the first to decode it';
  return `${n} ${n === 1 ? 'player has' : 'players have'} decoded it`;
};

export const Splash = () => {
  const [init, setInit] = useState<InitResponse | null>(null);
  useEffect(() => {
    fetchInit()
      .then(setInit)
      .catch(() => setInit(null));
  }, []);
  const tag = sticker();

  return (
    <main className="sg splash">
      <h1 className="sg-title">Signal Sats</h1>
      {tag && <span className="sg-day">{tag}</span>}
      <Tiles
        text={init?.puzzle.ciphertext ?? '·····'}
        tone="incoming"
        label="The scrambled signal"
      />
      <p className="splash-tag">
        Place satellites to bounce the signal down to Earth and unscramble the
        word.
      </p>
      <p className="splash-status">
        {status(init)}
        {init && init.streak > 0 ? ` · 🔥 ${init.streak}` : ''}
      </p>
      <button
        className="sg-button"
        onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
      >
        {init?.mine ? 'Open' : 'Play'}
      </button>
    </main>
  );
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Splash />
    </StrictMode>
  );
}

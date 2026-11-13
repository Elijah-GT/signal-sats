// The daily puzzle: one a day, the same for everyone, built by the generator
// from the date. Days run on UTC, like the scheduled post.

import { ANSWERS } from './answers.ts';
import type { DayBand } from './puzzle.ts';
import { createRng } from './rng.ts';
import type { TrayPuzzle } from './tray.ts';
import { DAILY, generateTray } from './trayGen.ts';

/** Day 1 of Signal Sats. Puzzle numbers count from here. */
export const FIRST_DAY = '2026-11-01';

const BANDS: DayBand[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC date of `now`, as YYYY-MM-DD. */
export const dayOf = (now: Date): string => now.toISOString().slice(0, 10);

const toTime = (date: string): number => Date.parse(`${date}T00:00:00Z`);

/** Whether `date` is a real YYYY-MM-DD date. */
export const isDate = (date: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  !Number.isNaN(toTime(date)) &&
  dayOf(new Date(toTime(date))) === date;

/** The date `days` after `date` (or before, if negative). */
export const addDays = (date: string, days: number): string =>
  dayOf(new Date(toTime(date) + days * DAY_MS));

/** Which day of the week `date` is, which sets how hard the puzzle is. */
export const bandOf = (date: string): DayBand =>
  BANDS[new Date(toTime(date)).getUTCDay()] ?? 'mon';

/** The puzzle's number: 1 on FIRST_DAY. */
export const dailyNumber = (date: string): number =>
  Math.round((toTime(date) - toTime(FIRST_DAY)) / DAY_MS) + 1;

/**
 * The word for `date`. Words don't repeat until the whole list has been used:
 * the list is shuffled once per cycle and each day takes the next word.
 */
export const dailyWord = (date: string): string => {
  const n = Math.max(0, dailyNumber(date) - 1);
  const cycle = Math.floor(n / ANSWERS.length);
  const order = createRng(`words:${cycle}`).shuffle(ANSWERS);
  return order[n % order.length] ?? 'PROBE';
};

/** The puzzle for `date`, the same every time it's built. */
export const dailyPuzzle = (date: string): TrayPuzzle => {
  const band = bandOf(date);
  return generateTray(DAILY[band], `daily:${date}`, {
    id: `daily-${date}`,
    band,
    answer: dailyWord(date),
  });
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** The daily post's title, e.g. "Signal Sats #13 · Fri, Nov 13". */
export const dailyTitle = (date: string): string => {
  const d = new Date(toTime(date));
  const weekday = WEEKDAYS[d.getUTCDay()] ?? '';
  const month = MONTHS[d.getUTCMonth()] ?? '';
  return `Signal Sats #${dailyNumber(date)} · ${weekday}, ${month} ${d.getUTCDate()}`;
};

/** Days in a row a player has solved the daily, and the last day they did. */
export type Streak = { count: number; last: string };

/** The streak after solving the daily for `date`. */
export const extendStreak = (prev: Streak | null, date: string): Streak => {
  if (!prev) return { count: 1, last: date };
  if (prev.last === date) return prev;
  if (prev.last === addDays(date, -1)) {
    return { count: prev.count + 1, last: date };
  }
  return { count: 1, last: date };
};

/** The streak as it stands on `today`: still alive if they solved yesterday. */
export const currentStreak = (streak: Streak | null, today: string): number =>
  streak && (streak.last === today || streak.last === addDays(today, -1))
    ? streak.count
    : 0;

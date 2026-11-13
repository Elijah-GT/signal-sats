import type { PlayMode } from '../src/client/game/PuzzleView';

/** One attempt at one puzzle, kept in this browser so a tester can send it back. */
export type LogEntry = {
  date: string;
  band: string;
  mode: PlayMode | 'tray';
  solved: boolean;
  /** Which transmission solved it, or null. */
  solvedOn: number | null;
  transmissions: number;
  taps: number;
  seconds: number;
};

const KEY = 'signal-sats-playtest';

const isEntry = (value: unknown): value is LogEntry =>
  typeof value === 'object' &&
  value !== null &&
  'date' in value &&
  'mode' in value &&
  'solved' in value &&
  'seconds' in value;

export const loadLog = (): LogEntry[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
};

export const saveLog = (log: readonly LogEntry[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    // Storage can be blocked (private windows); the log just won't persist.
  }
};

/** Tab-separated, so it pastes cleanly into a spreadsheet. */
export const formatLog = (log: readonly LogEntry[]): string =>
  [
    'date\tday\tmode\tsolved\tsolved on\ttransmissions\ttaps\tseconds',
    ...log.map((e) =>
      [
        e.date,
        e.band,
        e.mode,
        e.solved ? 'yes' : 'gave up',
        e.solvedOn ?? '-',
        e.transmissions,
        e.taps,
        e.seconds,
      ].join('\t')
    ),
  ].join('\n');

import type { CipherOp } from '../../src/shared/engine/types.ts';
import type { DayBand } from '../../src/shared/puzzle.ts';

type Range = readonly [min: number, max: number];

/** What a puzzle for one weekday may contain. */
export type BandSpec = {
  satellites: Range;
  /**
   * Satellites the solution beam must pass through. The beam enters at the
   * top heading down and must leave at the bottom heading down, and each
   * reflector turns it 90°, so this is always an even number.
   */
  pathLength: Range;
  ops: readonly CipherOp['kind'][];
  /** Largest shift amount allowed when `shift` is in `ops`. */
  maxShift: number;
  debris: Range;
  /** Satellites that must be off the solution path, to mislead. */
  minDecoys: number;
  /** Fewest taps the starting angles must be from any solution. */
  minTaps: number;
  /** Fewest different routes to the receiver, so trying them all isn't enough. */
  minRoutes: number;
};

const STRUCTURAL: CipherOp['kind'][] = ['reverse', 'rotate', 'swap'];

export const BANDS: Record<DayBand, BandSpec> = {
  mon: {
    satellites: [3, 3],
    pathLength: [2, 2],
    ops: ['reverse', 'rotate'],
    maxShift: 0,
    debris: [0, 0],
    minDecoys: 0,
    minTaps: 1,
    minRoutes: 2,
  },
  tue: {
    satellites: [4, 4],
    pathLength: [2, 2],
    ops: STRUCTURAL,
    maxShift: 0,
    debris: [0, 1],
    minDecoys: 0,
    minTaps: 2,
    minRoutes: 2,
  },
  wed: {
    satellites: [5, 5],
    pathLength: [2, 4],
    ops: STRUCTURAL,
    maxShift: 0,
    debris: [0, 1],
    minDecoys: 1,
    minTaps: 2,
    minRoutes: 3,
  },
  thu: {
    satellites: [5, 6],
    pathLength: [4, 4],
    ops: [...STRUCTURAL, 'shift'],
    maxShift: 2,
    debris: [1, 1],
    minDecoys: 1,
    minTaps: 2,
    minRoutes: 3,
  },
  fri: {
    satellites: [5, 6],
    pathLength: [4, 4],
    ops: [...STRUCTURAL, 'shift'],
    maxShift: 3,
    debris: [1, 2],
    minDecoys: 1,
    minTaps: 3,
    minRoutes: 3,
  },
  sat: {
    satellites: [6, 7],
    pathLength: [4, 4],
    ops: [...STRUCTURAL, 'shift', 'mirror'],
    maxShift: 3,
    debris: [1, 2],
    minDecoys: 1,
    minTaps: 3,
    minRoutes: 4,
  },
  sun: {
    satellites: [6, 7],
    pathLength: [4, 6],
    ops: [...STRUCTURAL, 'shift', 'mirror'],
    maxShift: 3,
    debris: [1, 2],
    minDecoys: 1,
    minTaps: 3,
    minRoutes: 4,
  },
};

// Ordered to match Date.getUTCDay(), which starts on Sunday.
const BY_UTC_DAY: readonly DayBand[] = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a YYYY-MM-DD date as UTC midnight. Throws on anything else. */
export const parseDate = (date: string): Date => {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !DATE_PATTERN.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`"${date}" is not a valid YYYY-MM-DD date`);
  }
  return parsed;
};

export const addDays = (date: string, days: number): string => {
  const parsed = parseDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

export const bandForDate = (date: string): DayBand =>
  BY_UTC_DAY[parseDate(date).getUTCDay()] ?? 'mon';

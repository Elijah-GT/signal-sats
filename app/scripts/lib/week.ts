import { bandForDate } from './bands.ts';

/** A week of content, as written by hand in `content/weeks/<id>.json`. */
export type WeekFile = {
  id: string;
  /** The Monday the week starts, as YYYY-MM-DD (UTC). */
  start: string;
  /** The Signal: the message the community decodes over the week. */
  message: string;
  /** One answer per day, Monday first. Each hints at the message. */
  words: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Checks a parsed week file. Throws one error listing every problem found. */
export const parseWeek = (
  raw: unknown,
  isWord: (text: string) => boolean
): WeekFile => {
  if (!isRecord(raw)) throw new Error('Week file must be a JSON object');
  const errors: string[] = [];
  const { id, start, message, words } = raw;

  if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) {
    errors.push('"id" must be lowercase letters, digits and dashes');
  }

  if (typeof start !== 'string') {
    errors.push('"start" must be a YYYY-MM-DD date');
  } else {
    try {
      if (bandForDate(start) !== 'mon') errors.push('"start" must be a Monday');
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (typeof message !== 'string' || !/^[A-Z ]{20,60}$/.test(message)) {
    errors.push('"message" must be 20–60 capital letters and spaces');
  }

  const list: string[] = [];
  if (!Array.isArray(words) || words.length !== 7) {
    errors.push('"words" must list exactly 7 words, Monday first');
  } else {
    for (const word of words) {
      if (typeof word !== 'string' || !/^[A-Z]{5}$/.test(word)) {
        errors.push(`Word ${JSON.stringify(word)} must be 5 capital letters`);
      } else if (!isWord(word)) {
        errors.push(`Word "${word}" is not in the dictionary`);
      } else if (list.includes(word)) {
        errors.push(`Word "${word}" appears twice`);
      } else {
        list.push(word);
      }
    }
  }

  if (
    errors.length > 0 ||
    typeof id !== 'string' ||
    typeof start !== 'string' ||
    typeof message !== 'string'
  ) {
    throw new Error(`Invalid week file:\n- ${errors.join('\n- ')}`);
  }
  return { id, start, message, words: list };
};

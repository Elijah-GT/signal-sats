import { decode } from '../../src/shared/engine/decode.ts';
import type { Angle, Board, Settings } from '../../src/shared/engine/types.ts';

/** Every combination of reflector angles for `board`: 2^n settings for n satellites. */
export const allSettings = (board: Board): Settings[] => {
  const ids = board.satellites.map((s) => s.id);
  const out: Settings[] = [];
  for (let mask = 0; mask < 2 ** ids.length; mask++) {
    const settings: Record<string, Angle> = {};
    ids.forEach((id, bit) => {
      settings[id] = mask & (1 << bit) ? '\\' : '/';
    });
    out.push(settings);
  }
  return out;
};

/** How many taps it takes to get from settings `a` to settings `b`. */
export const tapsBetween = (a: Settings, b: Settings): number =>
  Object.keys(a).filter((id) => a[id] !== b[id]).length;

/** Fewest taps from `from` to any of `targets`. */
export const fewestTaps = (
  from: Settings,
  targets: readonly Settings[]
): number => Math.min(...targets.map((t) => tapsBetween(from, t)));

export type SolveReport = {
  total: number;
  /** Settings whose beam reaches the receiver. */
  reaching: number;
  /**
   * Different routes to the receiver, by the satellites hit in order. Flipping
   * a decoy makes a new setting but not a new route, so this is the number of
   * real choices a player has.
   */
  routes: number;
  /** Real words that can reach the receiver, with every setting that produces each. */
  words: Map<string, Settings[]>;
  /** Every text a player could see: the ciphertext and every step of every route. */
  texts: Set<string>;
};

/** Tries every reflector setting and records what reaches the receiver. */
export const solve = (
  board: Board,
  ciphertext: string,
  isWord: (text: string) => boolean
): SolveReport => {
  const words = new Map<string, Settings[]>();
  const texts = new Set([ciphertext]);
  const routes = new Set<string>();
  const settingsList = allSettings(board);
  let reaching = 0;

  for (const settings of settingsList) {
    const result = decode(board, settings, ciphertext);
    for (const step of result.steps) texts.add(step.after);
    if (result.output === null) continue;
    reaching++;
    routes.add(result.steps.map((s) => s.satelliteId).join('>'));
    if (isWord(result.output)) {
      const producers = words.get(result.output) ?? [];
      producers.push(settings);
      words.set(result.output, producers);
    }
  }
  return {
    total: settingsList.length,
    reaching,
    routes: routes.size,
    words,
    texts,
  };
};

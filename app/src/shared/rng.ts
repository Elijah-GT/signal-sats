/** A seeded random number generator, so the same seed always builds the same puzzle. */
export type Rng = {
  /** A float in [0, 1). */
  next: () => number;
  /** A whole number from `min` to `max`, both included. */
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  shuffle: <T>(items: readonly T[]) => T[];
};

/** FNV-1a: turns the seed text into a 32-bit starting state. */
const hashString = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export const createRng = (seed: string): Rng => {
  let state = hashString(seed);

  // mulberry32: small, fast, and good enough for level generation.
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number =>
    min + Math.floor(next() * (max - min + 1));

  const pick = <T>(items: readonly T[]): T => {
    const target = int(0, items.length - 1);
    for (const [index, item] of items.entries()) {
      if (index === target) return item;
    }
    throw new Error('Cannot pick from an empty list');
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const pool = [...items];
    const out: T[] = [];
    while (pool.length > 0)
      out.push(...pool.splice(int(0, pool.length - 1), 1));
    return out;
  };

  return { next, int, pick, shuffle };
};

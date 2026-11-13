import type { CipherOp } from './types.ts';

// The engine works on uppercase A–Z text. Shift and Mirror leave any other
// character unchanged; the structural ops move every character.
const CODE_A = 65;
const LETTERS = 26;

const mod = (n: number, m: number): number => ((n % m) + m) % m;

const mapLetters = (text: string, fn: (index: number) => number): string =>
  text.replace(/[A-Z]/g, (c) =>
    String.fromCharCode(CODE_A + mod(fn(c.charCodeAt(0) - CODE_A), LETTERS))
  );

const shiftLetters = (text: string, amount: number): string =>
  mapLetters(text, (i) => i + amount);

const mirrorLetters = (text: string): string =>
  mapLetters(text, (i) => LETTERS - 1 - i);

const rotateRight = (text: string): string =>
  text.length < 2 ? text : text.charAt(text.length - 1) + text.slice(0, -1);

/**
 * Where an op moves things: the same rearrangement the structural ops make to
 * letters, applied to any list. Shift and Mirror change letters, not places, so
 * they leave the list as it is. The game uses it to slide letter tiles.
 */
export const permute = <T>(items: readonly T[], op: CipherOp): T[] => {
  const out = [...items];
  sourcePlaces(op, items.length).forEach((from, to) => {
    const item = items[from];
    if (item !== undefined) out[to] = item;
  });
  return out;
};

/** For each place, the place its item comes from after `op`. */
const sourcePlaces = (op: CipherOp, n: number): number[] => {
  const places = Array.from({ length: n }, (_, i) => i);
  switch (op.kind) {
    case 'reverse':
      return places.reverse();
    case 'swap':
      return places.map((i) => (i % 2 === 0 ? (i + 1 < n ? i + 1 : i) : i - 1));
    case 'rotate':
      return places.map((i) => (i + 1) % n);
    case 'trade':
      return op.a >= n || op.b >= n
        ? places
        : places.map((i) => (i === op.a ? op.b : i === op.b ? op.a : i));
    case 'shift':
    case 'mirror':
      return places;
  }
};

/** What a satellite does to the text passing through it. */
export const applyOp = (text: string, op: CipherOp): string => {
  switch (op.kind) {
    case 'shift':
      return shiftLetters(text, op.amount);
    case 'mirror':
      return mirrorLetters(text);
    default:
      return permute([...text], op).join('');
  }
};

/** Undoes `applyOp`, so `unapplyOp(applyOp(text, op), op) === text`. */
export const unapplyOp = (text: string, op: CipherOp): string => {
  switch (op.kind) {
    case 'rotate':
      return rotateRight(text);
    case 'shift':
      return shiftLetters(text, -op.amount);
    default:
      // Every other op undoes itself.
      return applyOp(text, op);
  }
};

/** The short symbol drawn on a satellite. */
export const opSymbol = (op: CipherOp): string => {
  switch (op.kind) {
    case 'reverse':
      return '⇄';
    case 'swap':
      return '⤨';
    case 'rotate':
      return '↻';
    case 'shift':
      return `+${op.amount}`;
    case 'mirror':
      return '◐';
    case 'trade':
      return `${op.a + 1}⇄${op.b + 1}`;
  }
};

/** The op's name, for hints and screen readers. */
export const opName = (op: CipherOp): string => {
  switch (op.kind) {
    case 'reverse':
      return 'Reverse';
    case 'swap':
      return 'Swap pairs';
    case 'rotate':
      return 'Rotate';
    case 'shift':
      return `Shift +${op.amount}`;
    case 'mirror':
      return 'Mirror';
    case 'trade':
      return `Swap letters ${op.a + 1} and ${op.b + 1}`;
  }
};

/**
 * Builds a puzzle's ciphertext: the text that turns into `plaintext` after
 * passing through `ops` in order.
 */
export const encode = (plaintext: string, ops: readonly CipherOp[]): string =>
  ops.reduceRight((text, op) => unapplyOp(text, op), plaintext);

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

const reverse = (text: string): string => [...text].reverse().join('');

/** Swaps letters 1↔2, 3↔4, … An odd last letter stays put. */
const swapPairs = (text: string): string => {
  let out = '';
  for (let i = 0; i < text.length; i += 2) {
    out +=
      i + 1 < text.length
        ? text.charAt(i + 1) + text.charAt(i)
        : text.charAt(i);
  }
  return out;
};

const rotateLeft = (text: string): string =>
  text.length < 2 ? text : text.slice(1) + text.charAt(0);

const rotateRight = (text: string): string =>
  text.length < 2 ? text : text.charAt(text.length - 1) + text.slice(0, -1);

/** Swaps the letters at two positions. Out-of-range positions change nothing. */
const trade = (text: string, a: number, b: number): string => {
  if (a === b || a >= text.length || b >= text.length) return text;
  const letters = [...text];
  [letters[a], letters[b]] = [letters[b] ?? '', letters[a] ?? ''];
  return letters.join('');
};

/** What a satellite does to the text passing through it. */
export const applyOp = (text: string, op: CipherOp): string => {
  switch (op.kind) {
    case 'reverse':
      return reverse(text);
    case 'swap':
      return swapPairs(text);
    case 'rotate':
      return rotateLeft(text);
    case 'shift':
      return shiftLetters(text, op.amount);
    case 'mirror':
      return mirrorLetters(text);
    case 'trade':
      return trade(text, op.a, op.b);
  }
};

/** Undoes `applyOp`, so `unapplyOp(applyOp(text, op), op) === text`. */
export const unapplyOp = (text: string, op: CipherOp): string => {
  switch (op.kind) {
    case 'reverse':
      return reverse(text);
    case 'swap':
      return swapPairs(text);
    case 'rotate':
      return rotateRight(text);
    case 'shift':
      return shiftLetters(text, -op.amount);
    case 'mirror':
      return mirrorLetters(text);
    case 'trade':
      return trade(text, op.a, op.b);
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

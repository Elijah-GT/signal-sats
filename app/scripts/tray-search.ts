// Searches for letter swaps that make a tray design need real thinking.
//
//   npm run tray:search -- <design id> [attempts]
//
// Keeps the design's board, pieces and intended beam order, and tries random
// swaps on every satellite. A good set of swaps has exactly one satellite order
// that solves the puzzle (the intended one), never needs the decoys, and makes
// every satellite on the route change the text. Prints the best few to paste
// into content/tray/designs.json.

import { readFileSync } from 'node:fs';
import { applyOp, encode } from '../src/shared/engine/cipher.ts';
import type { CipherOp } from '../src/shared/engine/types.ts';
import type { TrayPuzzle } from '../src/shared/tray.ts';
import { createRng } from './lib/rng.ts';
import { solveTray } from './lib/traySolve.ts';
import { loadFiveLetterWords } from './lib/words.ts';

type Swap = [number, number];
type Design = Omit<TrayPuzzle, 'fixed' | 'pieces' | 'ciphertext'> & {
  fixed: (Omit<TrayPuzzle['fixed'][number], 'op'> & { swap: Swap })[];
  pieces: { id: string; swap: Swap }[];
  intended: string[];
};

const [id, attemptsArg, maxOrdersArg] = process.argv.slice(2);
const attempts = Number(attemptsArg ?? 4000);
/** How many different satellite orders may solve it. 1 is strictest. */
const maxOrders = Number(maxOrdersArg ?? 1);
const designs: Design[] = JSON.parse(
  readFileSync('content/tray/designs.json', 'utf8')
);
const design = designs.find((d) => d.id === id);
if (!design) throw new Error(`No design "${id}"`);

const words = loadFiveLetterWords();
const rng = createRng(`search:${id}`);
const trade = ([a, b]: Swap): CipherOp => ({
  kind: 'trade',
  a: a - 1,
  b: b - 1,
});
const randomSwap = (): Swap => {
  const a = rng.int(1, 4);
  return [a, rng.int(a + 1, 5)];
};
const key = (s: Swap) => s.join('-');

type Found = {
  swaps: Record<string, Swap>;
  layouts: number;
  orders: number;
  par: number;
  cipher: string;
};
const found: Found[] = [];
const seen = new Set<string>();

for (let n = 0; n < attempts; n++) {
  const swaps: Record<string, Swap> = {};
  for (const f of design.fixed) swaps[f.id] = randomSwap();
  for (const p of design.pieces) swaps[p.id] = randomSwap();
  // All swaps different, so no two satellites are interchangeable.
  if (new Set(Object.values(swaps).map(key)).size !== Object.keys(swaps).length)
    continue;
  const signature = JSON.stringify(swaps);
  if (seen.has(signature)) continue;
  seen.add(signature);

  const ops = design.intended.map((sid) => trade(swaps[sid] ?? [1, 2]));
  const cipher = encode(design.answer, ops);
  if (words.has(cipher)) continue;
  // Every satellite on the route must visibly change the text.
  let text = cipher;
  let changes = true;
  for (const op of ops) {
    const next = applyOp(text, op);
    if (next === text) changes = false;
    text = next;
  }
  if (!changes) continue;

  const puzzle: TrayPuzzle = {
    ...design,
    fixed: design.fixed.map(({ swap: _s, ...f }) => ({
      ...f,
      op: trade(swaps[f.id] ?? [1, 2]),
    })),
    pieces: design.pieces.map((p) => ({
      id: p.id,
      op: trade(swaps[p.id] ?? [1, 2]),
    })),
    ciphertext: cipher,
    par: 0,
  };
  const report = solveTray(puzzle);
  const decoys = design.pieces
    .map((p) => p.id)
    .filter((pid) => !design.intended.includes(pid));
  if (
    report.orders.length <= maxOrders &&
    report.orders.includes(design.intended.join('>')) &&
    decoys.every((d) => report.unusedPieces.includes(d))
  ) {
    found.push({
      swaps,
      layouts: report.solutions.length,
      orders: report.orders.length,
      par: report.par,
      cipher,
    });
  }
}

found.sort((a, b) => a.orders - b.orders || a.layouts - b.layouts);
console.log(`${id}: ${found.length} good swap sets out of ${seen.size} tried`);
for (const f of found.slice(0, 5)) {
  console.log(
    `  ${f.cipher} → ${design.answer}  orders ${f.orders}  layouts ${f.layouts}  par ${f.par}  ${JSON.stringify(f.swaps)}`
  );
}

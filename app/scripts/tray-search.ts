// Searches for letter swaps and a beam route that make a tray design need
// real thinking.
//
//   npm run tray:search -- <design id> [attempts] [maxOrders]
//
// Keeps the design's board, storms and piece kinds, and tries random swaps on
// every swapping satellite, with a random route that uses every piece except
// the decoys and goes through at least one storm. A good result has exactly one
// satellite order that solves the puzzle, never needs the decoys, and has every
// satellite and storm on the route change the text. Prints the best few to
// paste into content/tray/designs.json.

import { readFileSync } from 'node:fs';
import { applyOp } from '../src/shared/engine/cipher.ts';
import { createRng } from './lib/rng.ts';
import {
  opsAlong,
  toPuzzle,
  type Design,
  type OpSpec,
  type Swap,
} from './lib/trayDesign.ts';
import { solveTray } from './lib/traySolve.ts';
import { loadFiveLetterWords } from './lib/words.ts';

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
const randomSwap = (): Swap => {
  const a = rng.int(1, 4);
  return [a, rng.int(a + 1, 5)];
};

// Routes don't depend on what the satellites do, so find them once.
const needed = design.pieces
  .map((p) => p.id)
  .filter((pid) => !design.decoys.includes(pid));
const stormIds = design.storms.map((s) => s.id);
const routes = solveTray(toPuzzle(design, []), () => true)
  .solutions.map((s) => s.order)
  .filter(
    (order) =>
      needed.every((pid) => order.includes(pid)) &&
      !design.decoys.some((pid) => order.includes(pid)) &&
      (stormIds.length === 0 || stormIds.some((sid) => order.includes(sid)))
  );
const routeKeys = [...new Set(routes.map((r) => r.join('>')))];
console.log(`${id}: ${routeKeys.length} routes use every piece but the decoys`);
if (routeKeys.length === 0) process.exit(1);

type Found = {
  swaps: Record<string, Swap>;
  intended: string;
  layouts: number;
  par: number;
  cipher: string;
};
const found: Found[] = [];
const seen = new Set<string>();

for (let n = 0; n < attempts; n++) {
  const swaps: Record<string, Swap> = {};
  const withSwap = <T extends { id: string } & OpSpec>(s: T): T => {
    if (!('swap' in s)) return s;
    const swap = randomSwap();
    swaps[s.id] = swap;
    return { ...s, swap };
  };
  const trial: Design = {
    ...design,
    fixed: design.fixed.map(withSwap),
    pieces: design.pieces.map(withSwap),
  };
  // All swaps different, so no two satellites are interchangeable.
  const keys = Object.values(swaps).map((s) => s.join('-'));
  if (new Set(keys).size !== keys.length) continue;
  const intended = (routeKeys[rng.int(0, routeKeys.length - 1)] ?? '').split(
    '>'
  );
  const signature = JSON.stringify([swaps, intended]);
  if (seen.has(signature)) continue;
  seen.add(signature);

  const puzzle = toPuzzle(trial, intended);
  if (words.has(puzzle.ciphertext)) continue;
  // Everything on the route must visibly change the text.
  let text = puzzle.ciphertext;
  let changes = true;
  for (const op of opsAlong(trial, intended)) {
    const next = applyOp(text, op);
    if (next === text) changes = false;
    text = next;
  }
  if (!changes) continue;

  const report = solveTray(puzzle);
  if (
    report.orders.length <= maxOrders &&
    report.orders.includes(intended.join('>')) &&
    design.decoys.every((d) => report.unusedPieces.includes(d))
  ) {
    found.push({
      swaps,
      intended: intended.join('>'),
      layouts: report.solutions.length,
      par: report.par,
      cipher: puzzle.ciphertext,
    });
  }
}

// Prefer longer routes, then fewer working layouts, then a higher par.
found.sort(
  (a, b) =>
    b.intended.length - a.intended.length ||
    a.layouts - b.layouts ||
    b.par - a.par
);
console.log(`${found.length} good sets out of ${seen.size} tried`);
for (const f of found.slice(0, 6)) {
  console.log(
    `  ${f.cipher} → ${design.answer}  ${f.intended}  layouts ${f.layouts}  par ${f.par}  ${JSON.stringify(f.swaps)}`
  );
}

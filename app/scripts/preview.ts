// Draws every generated puzzle into one HTML page for checking by eye.
//
//   npm run puzzles:preview [-- --dir content/puzzles --out content/preview.html]

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { opName, opSymbol } from '../src/shared/engine/cipher.ts';
import { decode } from '../src/shared/engine/decode.ts';
import type { Board, Point, Settings } from '../src/shared/engine/types.ts';
import type { Puzzle } from '../src/shared/puzzle.ts';

const { values } = parseArgs({
  options: {
    dir: { type: 'string', default: 'content/puzzles' },
    out: { type: 'string', default: 'content/preview.html' },
  },
});

const CELL = 52;
const PAD = 30;

const escape = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const centre = (p: Point): Point => ({
  x: PAD + p.x * CELL + CELL / 2,
  y: PAD + p.y * CELL + CELL / 2,
});

const drawBoard = (
  board: Board,
  settings: Settings,
  ciphertext: string
): string => {
  const width = board.width * CELL + PAD * 2;
  const height = board.height * CELL + PAD * 2;
  const { trace } = decode(board, settings, ciphertext);
  const parts: string[] = [];

  // Earth along the receiver edge.
  parts.push(
    `<rect x="${PAD}" y="${height - PAD}" width="${board.width * CELL}" height="${PAD - 6}" rx="4" class="earth"/>`
  );
  for (let x = 0; x <= board.width; x++) {
    parts.push(
      `<line x1="${PAD + x * CELL}" y1="${PAD}" x2="${PAD + x * CELL}" y2="${height - PAD}" class="grid"/>`
    );
  }
  for (let y = 0; y <= board.height; y++) {
    parts.push(
      `<line x1="${PAD}" y1="${PAD + y * CELL}" x2="${width - PAD}" y2="${PAD + y * CELL}" class="grid"/>`
    );
  }

  // The beam, from just above the source to just past where it ends.
  const first = trace.cells[0];
  if (first) {
    const points = [{ x: centre(first).x, y: 4 }, ...trace.cells.map(centre)];
    const last = trace.cells.at(-1);
    if (last && trace.end.kind !== 'blocked') {
      const port = trace.end.port;
      const c = centre(last);
      if (port.side === 'bottom') points.push({ x: c.x, y: height - 8 });
      if (port.side === 'top') points.push({ x: c.x, y: 4 });
      if (port.side === 'left') points.push({ x: 4, y: c.y });
      if (port.side === 'right') points.push({ x: width - 4, y: c.y });
    }
    parts.push(
      `<polyline points="${points.map((p) => `${p.x},${p.y}`).join(' ')}" class="beam ${trace.end.kind}"/>`
    );
  }

  for (const d of board.debris) {
    const c = centre(d);
    parts.push(
      `<rect x="${c.x - 16}" y="${c.y - 16}" width="32" height="32" rx="6" class="debris"/>`,
      `<text x="${c.x}" y="${c.y + 5}" class="debris-mark">✕</text>`
    );
  }

  for (const s of board.satellites) {
    const c = centre(s);
    const tilt = settings[s.id] === '/' ? -1 : 1;
    parts.push(
      `<line x1="${c.x - 20}" y1="${c.y - 20 * tilt}" x2="${c.x + 20}" y2="${c.y + 20 * tilt}" class="mirror"/>`,
      `<circle cx="${c.x}" cy="${c.y}" r="13" class="sat"><title>${escape(`${s.id}: ${opName(s.op)}`)}</title></circle>`,
      `<text x="${c.x}" y="${c.y + 5}" class="op">${escape(opSymbol(s.op))}</text>`,
      `<text x="${c.x + 16}" y="${c.y - 12}" class="id">${s.id}</text>`
    );
  }

  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">${parts.join('')}</svg>`;
};

const describe = (puzzle: Puzzle): string => {
  const { steps } = decode(puzzle.board, puzzle.solution, puzzle.ciphertext);
  const rows = steps
    .map(
      (s) =>
        `<li><b>${s.satelliteId}</b> ${escape(opName(s.op))}: <code>${s.before}</code> → <code>${s.after}</code></li>`
    )
    .join('');
  const { stats } = puzzle;
  return `
  <section>
    <header><h2>${puzzle.date} · ${puzzle.band.toUpperCase()}</h2><p><code>${escape(puzzle.ciphertext)}</code> → <b>${escape(puzzle.answer)}</b></p></header>
    <div class="boards">
      <figure>${drawBoard(puzzle.board, puzzle.start, puzzle.ciphertext)}<figcaption>Start (${stats.minTaps} taps from solved)</figcaption></figure>
      <figure>${drawBoard(puzzle.board, puzzle.solution, puzzle.ciphertext)}<figcaption>Solution</figcaption></figure>
      <div class="info">
        <ol>${rows}</ol>
        <p>${stats.satellites} satellites · ${stats.routes} routes to Earth · ${stats.reachingSettings}/${2 ** stats.satellites} settings reach Earth</p>
        <p>Ops on route: ${escape(stats.opKinds.join(', '))}</p>
      </div>
    </div>
  </section>`;
};

const files = readdirSync(values.dir)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort();
const puzzles: Puzzle[] = files.map((f) =>
  JSON.parse(readFileSync(path.join(values.dir, f), 'utf8'))
);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Puzzle Preview</title>
<style>
  :root { color-scheme: dark; --bg:#0b1020; --panel:#121a33; --ink:#e6ecff; --dim:#8a97c4; --beam:#ffb547; --sat:#2a3a70; --earth:#1f6f5c; }
  body { margin:0; padding:24px 16px; background:var(--bg); color:var(--ink); font:15px/1.5 system-ui, sans-serif; }
  h1 { margin:0 0 16px; font-size:20px; }
  section { background:var(--panel); border-radius:12px; padding:16px; margin:0 0 16px; }
  header { display:flex; gap:16px; align-items:baseline; flex-wrap:wrap; }
  h2 { margin:0; font-size:16px; }
  header p { margin:0; }
  code { font-family: ui-monospace, monospace; letter-spacing:.1em; }
  .boards { display:flex; flex-wrap:wrap; gap:16px; margin-top:12px; align-items:flex-start; }
  figure { margin:0; } figcaption { color:var(--dim); font-size:13px; text-align:center; }
  svg { max-width:100%; height:auto; }
  .info { flex:1; min-width:240px; } .info ol { padding-left:20px; margin-top:0; }
  .grid { stroke:#ffffff14; } .earth { fill:var(--earth); }
  .beam { fill:none; stroke:var(--beam); stroke-width:3; stroke-linejoin:round; }
  .beam.escaped, .beam.blocked { stroke:#ff6b6b; stroke-dasharray:6 4; }
  .mirror { stroke:#c9d4ff; stroke-width:3; stroke-linecap:round; }
  .sat { fill:var(--sat); stroke:#c9d4ff; stroke-width:1.5; }
  .op { fill:var(--ink); font-size:13px; text-anchor:middle; font-weight:600; }
  .id { fill:var(--dim); font-size:11px; }
  .debris { fill:#3a2f2f; } .debris-mark { fill:#ff8a8a; text-anchor:middle; font-size:16px; }
</style></head>
<body><h1>${puzzles.length} puzzles from ${escape(values.dir)}</h1>${puzzles.map(describe).join('')}</body></html>
`;

writeFileSync(values.out, html);
console.log(`Wrote ${values.out} (${puzzles.length} puzzles)`);

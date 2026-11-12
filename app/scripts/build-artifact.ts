// Turns the prototype build into one self-contained page for publishing as a
// claude.ai artifact, which only allows inline scripts and styles.
//
//   npm run prototype:artifact
//
// Reads dist/prototype (from `npm run prototype:build`) and writes
// dist/prototype-artifact/signal-sats-prototype.html.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BUILD = 'dist/prototype';
const OUT_DIR = 'dist/prototype-artifact';
const OUT = path.join(OUT_DIR, 'signal-sats-prototype.html');

const index = readFileSync(path.join(BUILD, 'index.html'), 'utf8');
const script = /<script[^>]*src="\.\/(assets\/[^"]+\.js)"/.exec(index)?.[1];
const style = /<link[^>]*href="\.\/(assets\/[^"]+\.css)"/.exec(index)?.[1];
if (!script || !style) {
  throw new Error(
    `Could not find the script and stylesheet in ${BUILD}/index.html`
  );
}

// "</script" inside the bundle would end the inline <script> early. "<\/" means
// the same thing inside JavaScript strings and regular expressions.
const js = readFileSync(path.join(BUILD, script), 'utf8').replaceAll(
  '</script',
  '<\\/script'
);
const css = readFileSync(path.join(BUILD, style), 'utf8').replaceAll(
  '</style',
  '<\\/style'
);

// The artifact host adds the doctype, head and body around this.
const page = `<title>Signal Sats Prototype</title>
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, page);
console.log(`Wrote ${OUT} (${Math.round(page.length / 1024)} KB)`);

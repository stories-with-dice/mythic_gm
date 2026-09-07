#!/usr/bin/env node
/* =========================================================================
   Single-file build
   -------------------------------------------------------------------------
   Inlines every stylesheet and every <script src> referenced by index.html
   into ONE self-contained HTML file at dist/mythic-toolkit.html — vendored
   libraries included — so the whole toolkit can be downloaded and opened
   straight from disk with no server and no other files.

   No dependencies; run it with plain Node:

     node scripts/build-singlefile.mjs [--version vN] [--out path.html]

   It reads index.html as the source of truth for load order, so if you add
   a css/ or js/ file there, the bundle picks it up automatically.
   ========================================================================= */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// --- args ----------------------------------------------------------------
const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};
const version = getArg('--version') || process.env.VERSION || '';
const outPath = resolve(repoRoot, getArg('--out') || 'dist/mythic-toolkit.html');

// --- helpers -----------------------------------------------------------------
const read = (rel) => {
  const p = join(repoRoot, rel);
  if (!existsSync(p)) throw new Error(`referenced file not found: ${rel}`);
  return readFileSync(p, 'utf8');
};
// A string is safe to drop inside a <script>/<style> element as long as it
// never contains the element's closing tag. None of our sources do, but guard
// anyway — "<\/tag" is identical to "</tag" everywhere JS/CSS can legally hold it.
const neutralizeClosers = (s, tag) =>
  s.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');

// --- build -----------------------------------------------------------------
let html = read('index.html');

// 1. stylesheets  ->  <style> … </style>
html = html.replace(/[^\S\r\n]*<link\s+rel="stylesheet"\s+href="([^"]+)"\s*>/g, (_, href) => {
  const css = neutralizeClosers(read(href), 'style');
  return `<style>\n/* ${href} */\n${css}\n</style>`;
});

// 2. favicon  ->  inlined data: URI (or dropped if the file is gone)
html = html.replace(/[^\S\r\n]*<link\s+rel="icon"[^>]*href="([^"]+)"[^>]*>\s*/g, (_, href) => {
  if (!existsSync(join(repoRoot, href))) return '';
  const b64 = readFileSync(join(repoRoot, href)).toString('base64');
  return `<link rel="icon" type="image/x-icon" href="data:image/x-icon;base64,${b64}">\n`;
});

// 3. every <script src="…"></script>  ->  inline <script> … </script>
//    (processed in document order, so load order is preserved)
let scriptCount = 0;
html = html.replace(/[^\S\r\n]*<script\s+src="([^"]+)"\s*>\s*<\/script>/g, (_, src) => {
  scriptCount++;
  const js = neutralizeClosers(read(src), 'script');
  return `<script>\n/* ${src} */\n${js}\n</script>`;
});

// 4. build marker
const stamp = `single-file build ${version || '(local)'} — ${new Date().toISOString()}`;
html = html.replace(/^<!DOCTYPE html>/i, `<!DOCTYPE html>\n<!-- Mythic Toolkit ${stamp} -->`);
if (version) {
  html = html.replace(/<\/title>/i, `</title>\n<meta name="build-version" content="${version}">`);
}

// --- sanity checks -------------------------------------------------------
if (scriptCount === 0) throw new Error('no <script src> tags were inlined — index.html format changed?');
for (const leftover of ['<script src=', '<link rel="stylesheet"']) {
  if (html.includes(leftover)) throw new Error(`bundle still references external resources (${leftover})`);
}

// --- write -------------------------------------------------------------------
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
console.log(`Bundled ${scriptCount} scripts → ${outPath} (${kb} KB)${version ? `, version ${version}` : ''}`);

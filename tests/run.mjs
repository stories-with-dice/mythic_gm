#!/usr/bin/env node
/* Headless test runner: opens tests/tests.html in a headless Chromium
   (Edge or Chrome) and reports the pass/fail summary as this process's
   exit code. No npm dependencies — just a browser on the machine.

   Usage:  node tests/run.mjs            (auto-detects Edge/Chrome)
           BROWSER="/path/to/chrome" node tests/run.mjs

   Or skip this entirely and just open tests/tests.html in any browser. */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageUrl = pathToFileURL(join(here, 'tests.html')).href;

const candidates = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const browser = candidates.find((p) => existsSync(p));
if (!browser) {
  console.error('No headless Chromium found. Set BROWSER=/path/to/chrome, or open tests/tests.html manually.');
  process.exit(2);
}

const profile = mkdtempSync(join(tmpdir(), 'mythic-tests-'));
let dom = '';
try {
  dom = execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--user-data-dir=${profile}`,
    '--virtual-time-budget=30000',
    '--run-all-compositor-stages-before-draw',
    '--dump-dom', pageUrl,
  ], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
  console.error('Browser run failed:', e.message);
  process.exit(2);
}

const m = dom.match(/class="summary (ok|bad)">([^<]*)/);
if (!m) {
  console.error('Could not find a test summary in the page output — the run probably errored before finishing.');
  process.exit(2);
}
console.log(m[2]);
for (const f of dom.matchAll(/<li class="fail">([^<]*)<(?:pre)>([^<]*)/g)) {
  console.log('  FAIL ' + f[1].replace(/^✗\s*/, '') + '\n       ' + f[2]);
}
process.exit(m[1] === 'ok' ? 0 : 1);

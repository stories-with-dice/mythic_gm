# Mythic Toolkit — UI test suite

A dependency-free, in-browser test suite that drives the **real** app (real
DOM, real EasyMDE, real `sessionStorage`) and asserts on what it renders and
logs. No Jest, no Playwright, no `npm install` — same "one machine, no build
step" spirit as the rest of the project.

## Run it

**In a browser:** open `tests/tests.html`. Results render in the panel on the
right; a green banner means everything passed. Works from `file://`.

**Headless (exit code for CI):**

```
node tests/run.mjs
```

Auto-detects Edge or Chrome. Override with `BROWSER=/path/to/chrome node tests/run.mjs`.
Exit `0` = all passed, `1` = failures, `2` = could not run.

## Layout

| File | Purpose |
|---|---|
| `tests.html` | Harness page: loads the app's CSS + vendor libs + `js/app/*` in the same order as `mythic.html`, then the runner, helpers and specs. Contains the app's real DOM skeleton. |
| `runner.js` | ~150-line test framework: `describe` / `it` / `beforeEach` / `afterEach` and an `expect()` with the matchers used here. Runs every suite on `window`'s `load` event and writes `window.__TEST_RESULTS__`. |
| `helpers.js` | App-aware helpers: `resetApp()` (wipe `sessionStorage` + rebuild UI from a fresh campaign), `showTab()`, `click()`, `setValue()`, `withRolls()` (force dice outcomes by stubbing `rollDie`), `withDialogs()` (stub `confirm`/`prompt`/`alert`), `lastLog()`. |
| `specs/*.spec.js` | One file per area. `01`–`03` cover the pure data/state functions; `04`–`12` are behavioural UI tests that click buttons and read the rendered result + the Campaign Log entry it produced. |

## What's covered

- **Data tables** (`01`): roll→result mapping for Discover Meaning, Ask the GM
  (thresholds + double detection), themes / plot points, Area Elements,
  `pickDie`, Mystery Elements, ability words.
- **Utils** (`02`): `rollDie` bounds, `timestamp` format, `escapeMd` vs
  `escapeAttr` (the two must not be crossed — see `AGENTS.md`).
- **State / import** (`03`): `freshCampaign` shape, `sessionStorage`
  round-trip, garbage-input fallback, and every documented
  `sanitizeCampaign()` invariant (field defaulting, uid dedupe, clue↔suspect
  connection rule, symmetrisation, `nextUid`, `solvedBoxUid`).
- **Scaffolding** (`04`): tab strip build, tab switching swaps `#panelHost`,
  every tab renders without throwing; campaign bar New / Rename / Delete /
  switch.
- **Each tab** (`05`–`09`): the roll buttons produce the expected on-screen
  result *and* the expected Campaign Log Markdown; transient "last result"
  displays survive an unrelated re-render (the module-`let` cache pattern);
  Mystery Matrix connection toggling, auto-Clincher at 6 connections,
  Discovery Check outcomes, reset, box removal.
- **Quick Note + Log** (`10`): Enter commits a note to the log as raw
  Markdown and clears the editor, empty notes are ignored, EasyMDE's built-in
  shortcuts survive the merged keymap; the log's Markdown is the source of
  truth, HTML display is sanitised (a `<script>` in a note does not execute),
  entry counter, Clear log (confirm / cancel), per-campaign isolation.
- **Mythic GME tab** (`11`): `discoveryCheckResult()` / `sceneAdjustment()` /
  `rollEventFocus()` tables, Chaos Factor clamp (1–9), Expected-Scene test
  (over CF → Expected; within CF → odd Altered = Scene Adjustment + Meaning
  word, even Interrupt = Event Focus + Meaning word), the collapsible **editable
  Random Event Focus Table** (expand, edit a result/max, re-sort, add/remove
  row, reset, drive an Interrupt roll), End-Scene CF adjustment,
  Threads/Characters List add / dupe-for-weight / remove / uniform Roll,
  Progress Track creation, Make Progress, phase-boundary auto-Flashpoint,
  manual Flashpoint (no auto-fire), Conclusion at full points, Discovery Check
  via `askTheGM()` (Yes / Exceptional Yes / No), the track collapse toggle
  (persists, survives re-render), and the `gme` sanitiser defaults.
- **Published Adventures tab** (`12`): the collapsible "How it works"
  flowchart, the `adventureDieOptions` /
  `rollAdventureDie` / `crisisElement` / `specialElement` tables, the running
  page counter (adds the Adventure Die each roll, wraps at the page count),
  page-count → Adventure Die snapping, the Deconstructed scene test (`>CF` odd
  → Expected / even → Crisis Scene generated inline; `≤CF` → Altered +
  Adventure Element / Interrupt + Event Focus + Adventure Element), Crisis
  Scene generation + Crisis PP maths (incl. Special deltas and the 0 floor),
  the shared Chaos Factor / End Scene, the Adventure Meaning List
  (add ≤20 / remove / roll 1d10), the Diminisher divide helper, and
  `sanitizeDeconstructed()`.

## Adding a test

Add an `it()` to the relevant spec, or a new `specs/NN-name.spec.js` plus a
`<script>` line in `tests.html`. Use `beforeEach(resetApp)` for isolation and
`withRolls([...])` whenever an assertion depends on a specific dice outcome.

# AGENTS.md — Mythic Toolkit

Orientation doc for any agent (human or AI) that needs to review, fix, or extend
this project. `index.html` is the entry point; the code lives in `css/` and
`js/` beside it (see "File map"). Read this before touching anything. It explains
the mental model, the conventions every tab follows, and the specific mistakes
that have already been made and fixed once — don't reintroduce them.

## What this is

A no-build, fully-offline browser app — a digital dice-tray for the
*Mythic One-Page GM Emulator* suite of tabletop-RPG tools: Game Master
(Ask the GM / Discover Meaning / Random Events), Adventure Crafter, Location
Crafter, Creature Crafter, Character Crafter, and Mystery Matrix — plus a
Quick Note editor and a combined Campaign Log, both always visible below the
active tab. State is organized into "campaigns," switchable from a dropdown
in the header, with export/import to JSON.

**Hard constraint: this must keep working fully offline with no build step.**
No CDN links, no external fetches, no bundler, no transpile. It used to be a
single self-contained `.html`; it is now split across plain files (`index.html`
+ `css/` + `js/`) that the browser loads directly over `file://`. Vendor
libraries are still fetched once (via npm) and their minified source saved
verbatim under `js/vendor/` — never add a `<script src="https://...">`.

There is still no package.json and no bundler. There **is** now a test suite
(`tests/`), but it too is dependency-free — see "Testing" below.

### Why it's still not a module system

`js/app/*.js` are **classic (non-module) scripts sharing one global scope**,
loaded in numbered order by `index.html`. That's deliberate: the old
single-file code was one flat script, so every `function`/`const`/`let` was
already a global and the tabs cross-reference each other freely
(`renderActive()` dispatches to every `renderX`, `addLog()` calls
`renderLogSection()`, etc.). Keeping them as ordered plain scripts made the
split a pure cut-and-paste with zero behaviour change. Consequences to respect:

- **Load order matters.** A file may only run top-level code that depends on
  an *earlier* file. `03-state-persistence.js` ends with `let STORE = loadStore();`
  which runs immediately — anything it needs must already be defined.
- **No name may be declared in two files** (`let`/`const` redeclaration across
  classic scripts is a load-time `SyntaxError`).
- If you add a file, insert its `<script>` in `index.html` **and**
  `tests/tests.html` at the same position, and give it a `NN-` prefix that
  keeps the order obvious.

## File map

```
index.html                  shell only: <head> links + the body skeleton
                            (header/.campaign-bar, nav#tabNav, main#panelHost,
                            section#noteSection, section#logSection) + the
                            ordered <script> list.
css/
  vendor-easymde.css        vendor CSS (EasyMDE + CodeMirror)
  app.css                   app CSS: :root design tokens + every component
js/vendor/
  marked.min.js             marked.js 18.0.11 (MIT)
  dompurify.min.js          DOMPurify 3.4.14 (Apache-2.0 / MPL-2.0)
  easymde.min.js            EasyMDE 2.21.0 (MIT, bundles CodeMirror 5)
js/app/                     the app, one file per former `===== SECTION =====`
                            banner (the banner is still at the top of each file):
```

| File (`js/app/`)                 | Contents |
|---|---|
| `01-data-tables.js`              | Every table transcribed from the cheat sheet: `DISCOVER_ACTION/DESC`, `ASK_ODDS`, `PLOT_ROWS`/`THEMES`, `LOCATION_DESCRIPTORS`/`areaElement()`, `CREATURE_DESCRIPTORS`/`ABILITY_WORDS`/behavior tables, `CHARACTER_DESCRIPTORS`/`NPC_STAT_MOD`/`behaviorContext()`, `MYSTERY_DESCRIPTORS`/`mysteryElement()`/`pickDie()` |
| `02-dice-markdown-utils.js`      | `rollDie`, `timestamp`, `escapeMd` (Markdown-table-safe only), `escapeAttr` (HTML-attribute-safe) |
| `03-state-persistence.js`        | `STORAGE_KEY`, `freshCampaign()`, `sanitizeBox()`/`sanitizeCampaign()` (import validation), `loadStore()`/`saveStore()`, `STORE`, `campaign()`, `persist()`, `addLog()` |
| `04-tab-render-scaffolding.js`   | `TABS`, `currentTab`, `renderTabNav()`, `renderActive()`, `wireActive()` |
| `05-campaign-bar.js`             | `renderCampaignBar()`, `clearNoteDraft()`, `wireCampaignBar()` (New/Rename/Delete/Export/Import) |
| `06-tab-game-master.js`          | `renderGM()` / `wireGM()`; `randomEventWords()` — a Discover Meaning Action+Description pair, shared with the Mythic GME tab's Interrupt Scene |
| `07-tab-adventure-crafter.js`    | `renderAdventure()` / `wireAdventure()` |
| `08-tab-location-crafter.js`     | `REGION_START_PP`, `renderLocation()` / `wireLocation()` |
| `09-tab-creature-crafter.js`     | `renderCreature()` / `wireCreature()` |
| `10-tab-character-crafter.js`    | `CHAR_CATEGORIES`, `renderCharacter()` / `wireCharacter()` |
| `11-tab-mystery-matrix.js`       | `boxByUid`, `renderMatrixTable()`, `renderMystery()`, `addBox`, `rollMysteryWords`, `toggleConnection`, `connectionExists`, `checkClincherByConnections`, `rollMatrixTarget`, `wireMystery()` |
| `12-quick-note.js`              | `noteMDE`, `renderNoteSection()` / `wireNoteSection()` |
| `13-campaign-log.js`            | `buildLogMarkdown()` (raw MD, source of truth), `renderLogHtml()` (MD→sanitized HTML for display only), `renderLogSection()` / `wireLogSection()` |
| `14-tab-mythic-gme.js`         | **Full Mythic GME 2e** tab — **first in `TABS`, the default landing tab** (the others are One-Page Mythic): `discoveryCheckResult()`, `DISCOVERY_ODDS`, `sceneAdjustment()` / `SCENE_ADJUSTMENTS`, `rollEventFocus()`, `oneMeaningWord()`, `renderMythicGME()` / `wireMythicGME()`. Threads/Characters Lists, Chaos Factor, Expected-Scene test (Altered → Scene Adjustment + word; Interrupt → editable Event Focus table + word), collapsible Thread Progress Tracks, collapsible editable Random Event Focus Table. Fate Questions here call `askTheGM()` from the GM tab. |
| `15-tab-published-adventures.js` | **Published Adventures** tab (2nd in `TABS`) — "Deconstruct The Known" (Mythic Magazine #50). **Shares `gme.chaosFactor` / `sceneNumber` / `expectedScene` / lists / `eventFocusTable`** with the Mythic GME tab; its own state is `gme.deconstructed`. `ADVENTURE_DIE_BANDS` / `adventureDieOptions()` / `rollAdventureDie()`, `PAGE_SECTIONS`, `crisisElement()` (Crisis Scene Element Table), `specialElement()` (Special Elements Table), `rollAdventureElement()` (page counter + wrap), `renderPublished()` / `wirePublished()`, plus a collapsible `PUB_FLOW_HTML` "How it works" flowchart. Its scene test is the Deconstructed variant: `>CF & odd → Expected`, `>CF & even → Crisis Scene`, `≤CF → Altered (odd, +Adventure Element) / Interrupt (even, +Event Focus +Adventure Element)`. |
| `16-init.js`                    | `DOMContentLoaded` handler that kicks everything off |

## The render/wire convention (every tab follows this — keep it consistent)

Each tab is a pair of functions named `render<Tab>()` and `wire<Tab>()`,
registered in two dispatch objects inside `renderActive()`/`wireActive()`:

```js
const renderers = { gm:renderGM, adventure:renderAdventure, ... };
const wirers    = { gm:wireGM,   adventure:wireAdventure,   ... };
```

- `render<Tab>()` returns an HTML string (template literal) built from
  current campaign state. It is pure-ish: read `campaign()`, return markup.
- `wire<Tab>()` runs immediately after that markup is injected via
  `host.innerHTML = ...`. It attaches every event listener for the tab by
  querying the DOM it just created.
- Switching tabs (`renderTabNav` click handler) calls `renderActive()`,
  which nukes and rebuilds `#panelHost` from scratch and re-runs `wire*`.

**If you add a new tool/tab:** add an entry to `TABS`, write
`renderX`/`wireX`, register both in the two dispatch objects, and add any
persisted state to `freshCampaign()` **and** to `sanitizeCampaign()` (see
below — anything not sanitized on import will silently vanish or crash on a
malformed file).

## Gotcha: re-rendering wipes transient result displays

`renderActive()` replaces the *entire* tab's HTML. Any "last roll result"
shown in a `<div id="...Result">` that was set via a direct
`document.getElementById(...).innerHTML = ...` gets destroyed the next time
something in the *same tab* calls `renderActive()` for an unrelated reason
(e.g. adjusting Progress Points also refreshes the Location tab, which would
otherwise blank out the last Explore Area result).

The fix used throughout: cache the result HTML in a **module-level `let`**
(e.g. `lastAreaResultHtml`, `lastTurningPointHtml`, `lastSinglePlotHtml`,
`lastDiscoveryHtml`) and interpolate that variable back into the `render*()`
template. Any new "show the result of the last action" UI needs the same
pattern — don't just `.innerHTML =` it and assume it survives.

## State model

```
STORE = {
  campaigns: { "<name>": <campaign>, ... },
  current: "<name>"
}
<campaign> = {
  location:  { pp, regionSize, areaCount, complete, ppSetupDone },
  adventure: { mainTheme },
  mystery:   { boxes: [{uid, type:'C'|'S', label, connections:[uid,...]}], nextUid, solvedBoxUid },
  gme:       { chaosFactor(1-9), sceneNumber, expectedScene,
               threads:[str], characters:[str],   // duplicates allowed = weighting
               tracks: [{id, focus, size:10|15|20, points, flashpoints:[bool], concluded, collapsed}],
               nextTrackId,
               eventFocusTable: [{max, result}],   // editable Random Event Focus Table (1d100 bands)
               deconstructed: {                     // Published Adventures tab (Mythic Mag #50)
                 title, pageCount, adventureDie, latestPage, pageHistory:[int],
                 firstSceneConcept, meaningList:[str]<=20, crisisPP, diminisher } },
  log:       [{ts, section, md}]
}
```

`gme` is the "full Mythic" tab's state. `TRACK_SIZES` / `trackFlashphases(size)`
(= `size/5 - 1`, the number of Flashpoint checkpoints) and `DEFAULT_EVENT_FOCUS`
/ `defaultEventFocus()` live in `03-state-persistence.js` next to
`sanitizeTrack()`. Scene-test outcomes: **Expected** = start as imagined;
**Altered** = roll `sceneAdjustment()` (Scene Adjustment Table, 1d10) + one
Meaning word; **Interrupt** = `rollEventFocus()` against `gme.eventFocusTable`
(the editable 1d100 table) + one Meaning word. Those three helpers are in
`14-tab-mythic-gme.js`.

`gme.deconstructed` is the Published Adventures tab's own state; `freshDeconstructed()`
/ `sanitizeDeconstructed()` / `ADVENTURE_DICE` / `DIMINISHER_VALUES` are in
`03-state-persistence.js`. That tab deliberately reads and writes the *shared*
`gme.chaosFactor` / `sceneNumber` / `expectedScene` / `threads` / `characters` /
`eventFocusTable` (same campaign, one scene clock) and adds only the
deconstructed-specific panels on top.

- `campaign()` returns the currently-selected campaign object; almost every
  handler mutates fields on it directly, then calls `persist()`.
- `persist()` writes the whole `STORE` to `sessionStorage` under
  `mythicToolkit_v1`. This is **session-only** — it clears when the browser
  tab closes. That's a deliberate tradeoff already communicated to the user,
  not a bug to silently "fix" by switching to `localStorage` without asking.
- Export/Import (campaign bar) round-trip a campaign through JSON. Imported
  data always goes through `sanitizeCampaign()`/`sanitizeBox()` before being
  accepted — never assign parsed JSON straight into `STORE.campaigns`.

### `sanitizeCampaign()` invariants — preserve these if you touch it

- Every field falls back to `freshCampaign()`'s default if missing/invalid
  (wrong type, out-of-enum, non-finite number).
- `location.areaCount` is clamped to `>= 0`.
- `adventure.mainTheme` must be one of `THEMES`, else `null`.
- Mystery boxes: duplicate `uid`s are deduped (first occurrence wins).
- **A connection is only ever valid between one `'C'` box and one `'S'` box.**
  Any clue→clue or suspect→suspect "connection" in imported data is dropped.
  This mirrors the same invariant enforced at runtime in `toggleConnection()`.
- Connections are re-symmetrized (if A lists B, B is made to list A) in case
  the source file wasn't.
- `mystery.nextUid` is forced to be greater than the highest surviving `uid`.
- `mystery.solvedBoxUid` is nulled out if it doesn't point at a real box.

If you extend the data model, extend this sanitizer in the same style —
default-first, then narrow. A hand-edited or corrupted import file should
never be able to crash the app or leave it in an inconsistent state.

## The log: Markdown is the source of truth, HTML is a view

`campaign().log` stores raw Markdown strings. `buildLogMarkdown()` just
concatenates them under a header — that's what **Copy** and **Download**
export verbatim. `renderLogHtml()` runs that same Markdown through
`marked.parse()` then `DOMPurify.sanitize()` purely for on-screen display
in `#logSection`. **Never** let the sanitized-HTML path become the stored
representation — always append to `campaign().log` as Markdown via
`addLog(section, md)`, and only convert to HTML at render time.

Sanitizing with DOMPurify matters because Quick Note content is
free-typed by the user and gets rendered as HTML; without it, typing raw
`<script>` into a note would execute it.

## Vendor libraries (saved under `js/vendor/`, do not add via CDN)

| Library | Version | License | Purpose |
|---|---|---|---|
| marked.js | 18.0.11 | MIT | Markdown → HTML for the Campaign Log display |
| DOMPurify | 3.4.14 | Apache-2.0 / MPL-2.0 | Sanitizes marked's HTML output before `innerHTML` |
| EasyMDE | 2.21.0 (bundles CodeMirror 5) | MIT | Rich Markdown editor toolbar for Quick Note |

To update or add a library: `npm install <pkg>` in a scratch dir, locate its
UMD/minified dist file, and save it verbatim as `js/vendor/<name>.min.js`,
then add a `<script src>` for it in `index.html` **and** `tests/tests.html`
(before the `js/app/*` scripts). Re-run the tests afterward.

### EasyMDE gotcha that already caused one bug — don't re-break this

EasyMDE's toolbar button DOM structure is **not** what you'd guess:

```js
// inside easymde's minified bundle, roughly:
l.className = c + e.name;              // the <button> itself gets the item's NAME as its class
// ...any class matching /^fa([srlb]|(-[\w-]*)|$)/ (i.e. Font Awesome classes)...
g = document.createElement("i");       // ...goes on a *child* <i> instead
l.appendChild(g);
```

So the button for the "bold" toolbar item has class `bold` (not `fa-bold`),
and the `fa fa-bold` classes live on an inner, empty `<i>` (empty because we
don't bundle Font Awesome — `autoDownloadFontAwesome:false` is set on
purpose to stay offline). Our custom icon glyphs are therefore CSS `::before`
content keyed to the **button's own class = the toolbar item's `name`**:

```css
.editor-toolbar button.bold:before{content:"B"; font-weight:800;}
.editor-toolbar button.italic:before{content:"I"; font-style:italic;}
/* ...one per name in the `toolbar:` array passed to `new EasyMDE({...})` */
.editor-toolbar button i{display:none;} /* hide the empty fa icon container */
```

If you add a toolbar button, add its glyph rule keyed by **name**, not by
`fa-*`. Selecting `.editor-toolbar button.fa-bold` looks reasonable but
silently matches nothing.

Also: `noteMDE.codemirror.setOption("extraKeys", {...})` **replaces** the
whole extraKeys map. To add a keybinding (as Quick Note does for
Enter-to-submit) without losing EasyMDE's built-in shortcuts (Cmd/Ctrl-B for
bold, etc.), read the existing map first and merge:

```js
const existingKeys = noteMDE.codemirror.getOption("extraKeys") || {};
noteMDE.codemirror.setOption("extraKeys", Object.assign({}, existingKeys, { "Enter": ... }));
```

### CodeMirror selection-color gotcha

EasyMDE's bundled CSS sets text-selection background via a rule with real
specificity: `.EasyMDEContainer .CodeMirror-focused .CodeMirror-selected`
(3 chained classes). A simpler override like `.EasyMDEContainer
.CodeMirror-selected{...}` (2 classes) loses to it while the editor is
focused — which is exactly when selection is visible. Any future re-theming
of the editor needs to match or exceed that specificity (the current fix
uses `!important` on the matching selector plus the native
`::selection`/`::-moz-selection` variants).

## Editable text: use `<input>`, not `contenteditable`

The Mystery Matrix row/column header labels were originally
`contenteditable="true"` `<div>`s (mirroring an earlier card-based layout).
After the matrix was rebuilt as a table, that stopped reliably entering edit
mode on click. Rather than keep debugging contenteditable quirks inside a
`<th>`, they were replaced with real `<input type="text">` elements
(`.col-lbl` / `.row-lbl`), which are unambiguous to focus and edit. Prefer
`<input>` over `contenteditable` for any future inline-editable label.

Two escaping helpers exist for two different jobs — don't cross them:

- `escapeMd(s)` — escapes only `|` so a label is safe to drop into a
  Markdown table cell in the log. **Not** safe for HTML attribute values.
- `escapeAttr(s)` — escapes `& " < >` for safe use inside an HTML attribute
  (e.g. `value="${escapeAttr(label)}"`, `title="${escapeAttr(label)}"`).

Using `escapeMd` where an attribute value was needed previously produced
malformed HTML (a label containing `"` broke the tag) — this was caught by
testing, which is why the testing section below matters. There is now a
regression test for exactly this (`tests/specs/02-utils.spec.js`).

## Testing

There is a dependency-free browser test suite in `tests/` — see
`tests/README.md`. It drives the real app (real DOM, real EasyMDE, real
`sessionStorage`), clicking buttons and asserting on both the rendered
output and the Campaign Log entry each action produces.

**Run it after any change:**

```
node tests/run.mjs        # headless Edge/Chrome; exit 0 = pass
```

or open `tests/tests.html` in a browser.

Also still worth doing on a quick edit:

- **Syntax-check the file(s) you touched:** `node --check js/app/NN-*.js`.
  Because the app files are separate classic scripts, each one checks on its
  own — a stray brace fails fast and locally.
- **Brace-balance the CSS** you edited (`{` count == `}` count).

When you add behaviour, add an `it()` to the matching spec (or a new spec
file + a `<script>` line in `tests/tests.html`). The pure-logic specs
(`01`–`03`) already spot-check the data-table transcriptions against the
cheat sheet and every documented `sanitizeCampaign()` invariant; the
UI specs (`04`–`12`) cover each tab's roll buttons, the "last result survives
re-render" cache pattern, Mystery Matrix connection/Clincher logic, the
Quick Note → Log → sanitised-HTML pipeline, (`11`) the Mythic GME tab —
Chaos Factor clamp, Expected-Scene test (Altered → Scene Adjustment + word,
Interrupt → Event Focus + word) with `sceneAdjustment()` / `rollEventFocus()`
unit tests, the collapsible editable Event Focus Table, list add/dupe/remove/roll,
Progress Track progress / auto-Flashpoint / Conclusion / Discovery Check /
collapse toggle — and (`12`) the Published Adventures tab —
`adventureDieOptions` / `rollAdventureDie` / `crisisElement` / `specialElement`
tables, the running page counter + wrap, the Deconstructed scene test's four
outcomes (incl. Crisis Scene generation and its Crisis PP maths), the shared
Chaos Factor / End Scene, the Adventure Meaning List, the Diminisher helper,
and `sanitizeDeconstructed()`.

Note the harness still can't catch everything: subtle real-browser
click/focus/paint behaviour (the kind that broke contenteditable and the
EasyMDE toolbar) is only partially exercised — when in doubt about paint or
native focus, say so rather than asserting from code inspection.

## Design system quick reference

Dark, restrained "case-file" theme; CSS custom properties in `:root`
(`--ink`, `--panel`, `--moss` = clue/confirm green, `--rust` = suspect/danger
red, `--gold` = highlight/solved accent, `--font-display` = serif for
labels/headings, `--font-mono` for numbers/dice/log). Reuse these tokens
for any new UI rather than hardcoding colors — the whole point of the
tokens is that a future re-theme only touches `:root`.

## Things intentionally left as-is (don't "fix" without being asked)

- ~370 KB of vendored EasyMDE/CodeMirror/marked/DOMPurify under `js/vendor/`.
  This is the cost of "rich editor, still fully offline." Don't try to slim it.
- `sessionStorage`, not `localStorage` — data doesn't survive closing the
  tab. Export/Import exists specifically to work around this.
- No build step and no minification of the app's own code. The `js/app/*`
  files are plain ordered `<script>`s sharing global scope, **not** ES
  modules — see "Why it's still not a module system" above. Converting them
  to `import`/`export` is a real change, not a tidy-up; don't do it unasked.
- A handful of automation judgment calls on ambiguous parts of the source
  rules (e.g. Location Crafter's "Expected, PP-6" repeat handling, Mystery
  Matrix's die-size table for box counts the cheat sheet doesn't give
  examples for, over-roll "choose most likely" auto-resolution) are logged
  transparently to the Campaign Log at the moment they fire, so the GM can
  see and override them — that's the intended behavior, not a shortcut to
  clean up.

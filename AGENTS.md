# AGENTS.md — Mythic Toolkit

Orientation doc for any agent (human or AI) that needs to review, fix, or extend
this project. `index.html` is the entry point; the code lives in `css/` and
`js/` beside it (see "File map"). Read this before touching anything. It explains
the mental model, the conventions every tab follows, and the specific mistakes
that have already been made and fixed once — don't reintroduce them.

## License (read before adding content)

The repo is public and licensed CC BY-NC 4.0 (`LICENSE`; attribution in
`NOTICE.md`). Word Mill Games licenses the *text* of the Mythic books under
CC BY-NC 4.0, so transcribed tables and adapted rules are allowed with
credit. Never commit source PDFs, scans, art, or logos (`*.pdf` is
git-ignored for this reason). A new tool from another source needs a
license check and a credit in `NOTICE.md`, the Help overlay, and the footer.

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

**One opt-in exception: Dropbox sync** (`js/app/19-dropbox-sync.js`, see
"Dropbox sync" below). When the user turns it on, the app calls the Dropbox
HTTP API (`api.dropboxapi.com`, `content.dropboxapi.com`) with `fetch`. It
loads no third-party script. Nothing goes to the network until the user
clicks **Connect**, and the app still works offline without it. Don't add
other runtime network dependencies on the back of this one.

There is still no package.json and no bundler. There **is** now a test suite
(`tests/`), but it too is dependency-free — see "Testing" below.

The *app* still has no build step. There is one **optional, dependency-free
packaging script** — `scripts/build-singlefile.mjs` — that inlines every
stylesheet and `<script src>` from `index.html` (vendored libs included) into a
lone `dist/mythic-toolkit.html` for download. It reads `index.html` for load
order, so a new `css/`/`js/` file is picked up automatically. The
`.github/workflows/release.yml` action runs it on every push to `main`/`master`
and publishes the result as a GitHub Release asset, versioned `v1`, `v2`, …
(plain incrementing integers — the next number is `max(existing v-tags) + 1`;
a commit already carrying a `vN` tag is skipped). `dist/` and `out/` are
git-ignored.

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
                            (header/.campaign-bar incl. the "☁ Dropbox"
                            button#btnDropbox and the "?" Help button,
                            nav#tabNav, div#panelSplit > main#panelHost +
                            aside#panelHostRight, section#noteSection,
                            section#logSection, footer.site-footer
                            (license + attribution line), div#helpOverlay,
                            div#dropboxOverlay, div#dropboxModal) + the
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
| `04-tab-render-scaffolding.js`   | `TABS`, `currentTab`, `rightTab` (split-right pane, see "Split view" below), `renderTabNav()`, `renderActive()`, `wireActive()`, `tabRenderers()`/`tabWirers()` (lazy lookups, safe to call only after every file has loaded) |
| `05-campaign-bar.js`             | `renderCampaignBar()`, `clearNoteDraft()`, `wireCampaignBar()` (New/Rename/Delete/Export/Import) |
| `06-tab-game-master.js`          | `renderGM()` / `wireGM()`; `randomEventWords()` — a Discover Meaning Action+Description pair, shared with the Mythic GME tab's Interrupt Scene; `rollInspirationSource()` — weighted roll on Discover Meaning's editable Random Inspiration Source list |
| `07-tab-adventure-crafter.js`    | `renderAdventure()` / `wireAdventure()` |
| `08-tab-location-crafter.js`     | `REGION_START_PP`, `renderLocation()` / `wireLocation()` |
| `09-tab-creature-crafter.js`     | `renderCreature()` / `wireCreature()` |
| `10-tab-character-crafter.js`    | `CHAR_CATEGORIES`, `renderCharacter()` / `wireCharacter()` |
| `11-tab-mystery-matrix.js`       | `boxByUid`, `renderMatrixTable()`, `renderMystery()`, `addBox`, `rollMysteryWords`, `toggleConnection`, `connectionExists`, `checkClincherByConnections`, `rollMatrixTarget`, `wireMystery()` |
| `12-quick-note.js`              | `noteMDE`, `renderNoteSection()` / `wireNoteSection()` |
| `13-campaign-log.js`            | `buildLogMarkdown()` (raw MD, source of truth), `renderLogHtml()` (MD→sanitized HTML for display only), `renderLogSection()` / `wireLogSection()` |
| `14-tab-mythic-gme.js`         | **Full Mythic GME 2e** tab — **first in `TABS`, the default landing tab** (the others are One-Page Mythic): `discoveryCheckResult()`, `DISCOVERY_ODDS`, `sceneAdjustment()` / `SCENE_ADJUSTMENTS`, `rollEventFocus()`, `oneMeaningWord()`, `renderMythicGME()` / `wireMythicGME()`. Threads/Characters Lists, Chaos Factor, Expected-Scene test (Altered → Scene Adjustment + word; Interrupt → editable Event Focus table + word), collapsible Thread Progress Tracks, collapsible editable Random Event Focus Table. Fate Questions here call `askTheGM()` from the GM tab. |
| `15-tab-published-adventures.js` | **Published Adventures** tab (2nd in `TABS`) — "Deconstruct The Known" (Mythic Magazine #50). **Shares `gme.chaosFactor` / `sceneNumber` / `expectedScene` / lists / `eventFocusTable`** with the Mythic GME tab; its own state is `gme.deconstructed`. `ADVENTURE_DIE_BANDS` / `adventureDieOptions()` / `rollAdventureDie()`, `PAGE_SECTIONS`, `crisisElement()` (Crisis Scene Element Table), `specialElement()` (Special Elements Table), `rollAdventureElement()` (page counter + wrap), `renderPublished()` / `wirePublished()`, plus a collapsible `PUB_FLOW_HTML` "How it works" flowchart. Its scene test is the Deconstructed variant: `>CF & odd → Expected`, `>CF & even → Crisis Scene`, `≤CF → Altered (odd, +Adventure Element) / Interrupt (even, +Event Focus +Adventure Element)`. |
| `16-tab-player-emulator.js`      | **Player Emulator** tab (last in `TABS`) — a solo "player emulator" from *Cloud Empress: Solo Protocol*. `PE_RESPONSE_TYPES` (Character Response Types re-sorted **most-minus → most-plus**, 50 rows / 1d100) + `peResponseType()`; `PE_NPC_MOODS` (1d10) + `peNpcMood()`; `PE_OUTLOOKS` (1d10, roll-and-display only — `PE_WILDCARD_OUTLOOK` is the one that changes a roll); `peRatingLabel()` / `peRatingClass()`; `peBiasedRoll(sides, mode)` (Adv = keep lowest, Dis = keep highest) with `peRollType(mode)` = 1d100 for a Character Type and `peRollMood(mode)` = 1d10 for an NPC mood (the add-NPC dropdown, persisted as `npcMoodMode`); `peBuildChart(mode)` (weighted 10-segment Response Chart); `peChartResponseAt()`; `pePcResponse()`; `renderPlayerEmu()` / `wirePlayerEmu()`. Generates a whole encounter's mood at once: every tracked PC responds (1d10 on their chart, or a fresh 1d100 on the full table if their Outlook is Wild card), every NPC has one mood, and all conflict ratings plus a manual adjustment are summed — total ≥ +4 ⇒ a violent encounter begins. The per-PC "Roll response" button caches its result in module-level `peLastResponse` / `peResponseHtml` (both cleared on PC removal or chart rebuild); the encounter generator's `useHeldResponses` checkbox (default on) reuses that held response instead of re-rolling, and writes any fresh rolls back so the PC cards stay in sync. |
| `17-tab-three-act-story.js`      | **3-Act Story** tab (3rd in `TABS`, right after Published Adventures) — the "Mythic 3-Act Story Structure" worksheet (Mythic Magazine #42), a screenwriting Setup/Conflict/Resolution overlay on normal Mythic play. **Shares `gme.chaosFactor` / `sceneNumber` / `threads` / `characters` / `eventFocusTable`** with the Mythic GME tab; its own state is `gme.threeAct`. Each Act has an **outer** circle track (`THREE_ACT_BEATS`, 4 slots, the 4th ends the Act — mark one per distinct Story Beat achieved in a Scene) and an **inner** circle track (`THREE_ACT_INNER_EVENTS`, uncapped — mark one whenever a Scene has no Story Beat; `threeActInnerEvent()` looks up which Act Event fires, cycling the last entry once the list is exhausted). `fireThreeActEvent()` resolves one triggered Act Event: rolls dice per the rules (Story Thread Activity / Conflict / Twist? / New Conflict? — the last recurses into Conflict), skips the one-time Incident Scene / Introduce NPC events once their condition is already met, and rolls a Meaning word pair (`randomEventWords()`, from the Game Master tab) for flavor. A Conflict roll of 8-10 surfaces a suggested new blocking Thread with an inline "Add to Threads List" button. `renderThreeAct()` / `wireThreeAct()`; an optional "Start In Media Res" button (Act 1, before anything happens) fires all three opening Act Events at once; phases progress `acts → resolution → closing → done` as Act 3's outer track completes, mirroring the worksheet's Resolution/Closing Scenes; a collapsible `THREE_ACT_FLOW_HTML` "How it works" flowchart matches the Published Adventures tab's pattern. The circle counts/order were read off the worksheet graphic itself (the PDF's extracted text scrambles the spiral layout). |
| `18-help.js`                    | Help overlay ("?" button in the campaign bar) — `HELP_OVERVIEW_SVG` (inline SVG map of how the tools connect), `renderHelpContent()` / `openHelp()` / `closeHelp()` / `wireHelp()`. Pure informational content, no persisted state. Its last section (`#help-credits`) holds the license and attribution — keep it in step with `NOTICE.md` and the `footer.site-footer` in `index.html`. Its Published Adventures section embeds that tab's own `PUB_FLOW_HTML` verbatim (see file 15) rather than restating it, so the two can't drift apart. |
| `19-dropbox-sync.js`            | Optional **Dropbox sync** of every campaign — ported from the osr_keeper project's `js/dropbox.js`. PKCE sign-in (`dropboxConnect()` / `dropboxFinishConnect()`), token refresh, `dropboxDecideSync()`, `dropboxSyncNow()`, `dropboxNoteSave()` (called by `persist()`), the conflict dialog (`openDropboxModal()`, `dropboxUseRemoteCopy()` / `dropboxUseLocalCopy()`), and the panel (`renderDropbox()`, `wireDropbox()`, `initDropbox()`). See "Dropbox sync" below. |
| `20-init.js`                    | `DOMContentLoaded` handler that kicks everything off (incl. `wireHelp()`, then `wireDropbox()` + `initDropbox()` last) |

## The render/wire convention (every tab follows this — keep it consistent)

Each tab is a pair of functions named `render<Tab>()` and `wire<Tab>()`,
registered in two dispatch objects inside `renderActive()`/`wireActive()`:

```js
function tabRenderers(){ return { gm:renderGM, adventure:renderAdventure, ... }; }
function tabWirers(){    return { gm:wireGM,   adventure:wireAdventure,   ... }; }
```

(These are functions, not top-level object literals, because `04-tab-render-scaffolding.js`
loads before the tab files that define `renderGM` etc. — see "Load order matters"
above. They're only ever called from inside `renderActive()`/`wireActive()`,
i.e. after every file has loaded.)

- `render<Tab>()` returns an HTML string (template literal) built from
  current campaign state. It is pure-ish: read `campaign()`, return markup.
- `wire<Tab>()` runs immediately after that markup is injected via
  `host.innerHTML = ...`. It attaches every event listener for the tab by
  querying the DOM it just created.
- Switching tabs (`renderTabNav` click handler) calls `renderActive()`,
  which nukes and rebuilds `#panelHost` from scratch and re-runs `wire*`.
  If a tab is pinned to the split-right pane (see below), `renderActive()`
  also rebuilds `#panelHostRight` the same way, every time — for either pane,
  not just the one that changed. That's deliberate: a tab's own
  `render<Tab>()` only reads `campaign()` plus its own module-level "last
  result" cache (see the re-render gotcha below), so redundantly rebuilding
  the *other* pane just reproduces what was already there — cheap, and
  simpler than tracking which pane needs refreshing.

**If you add a new tool/tab:** add an entry to `TABS`, write
`renderX`/`wireX`, register both in `tabRenderers()`/`tabWirers()`, and add
any persisted state to `freshCampaign()` **and** to `sanitizeCampaign()` (see
below — anything not sanitized on import will silently vanish or crash on a
malformed file).

## Split view (right-click a tab)

Right-clicking a tab button in `#tabNav` pins that tab to a second pane on
the right (`aside#panelHostRight`, inside the `div#panelSplit` wrapper),
alongside whatever the main pane (`#panelHost`) is already showing — a CSS
grid split by a vertical divider (`.panel-split.split` in `app.css`).
Left-clicking a tab behaves as before: it becomes the main pane's tab.

State is two module-level `let`s in `04-tab-render-scaffolding.js`:
`currentTab` (main pane) and `rightTab` (split-right pane, `null` when
unsplit). **Neither is persisted** — same as `currentTab` always was, a
reload lands back on the default tab, unsplit. This is a deliberate,
matching choice, not an oversight.

**Invariant: `currentTab` and `rightTab` are never equal.** Every tab's
`render<Tab>()`/`wire<Tab>()` pair uses hardcoded, page-unique DOM ids
(`#gmResult`, `#eventResult`, etc. — see the render/wire convention above);
showing the same tab in both panes at once would duplicate those ids and
break `document.getElementById()` lookups and event wiring. `renderTabNav()`
enforces the invariant on every click:

- **Left-click** a tab already pinned right → un-pins it (closes the split)
  and makes it the main tab. Left-click any other tab → the usual tab switch.
- **Right-click** the tab already pinned right → toggles the split closed.
  Right-click the tab currently shown in the main pane → bumps the main pane
  to a different tab first (so the two never collide), then pins the
  right-clicked one to the right. Right-click any other tab → moves the
  split pane to it. The right pane also has its own close (×) button,
  wired fresh on every `renderActive()`.

A tab pinned right is marked in the nav with a `.split-right` class (a gold
top accent) independent of `.active` (which still marks the main tab).

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
  gm:        { inspiration: { enabled, entries:[{label, weight:1-100}] } },  // Game Master tab,
                                                                              // Discover Meaning's Random Inspiration Source
  playerEmu: { pcs:[{id, name, outlook:1-10|null, chartMode:'normal'|'adv'|'dis',
                     chart:[{name, rating:-4..4, segments:1-10}]}],   // Player Emulator tab
               nextPcId,
               npcs:[{id, name, mood:1-10}], nextNpcId,   // NPCs in the current encounter
               adjust,                                    // manual conflict modifier (-20..20)
               npcMoodMode:'normal'|'adv'|'dis',           // Adv/Disadv for NPC mood rolls
               useHeldResponses },                         // reuse each PC's last rolled response in an encounter (default true)
  gme:       { chaosFactor(1-9), sceneNumber, expectedScene,
               threads:[str], characters:[str],   // duplicates allowed = weighting
               tracks: [{id, focus, size:10|15|20, points, flashpoints:[bool], concluded, collapsed}],
               nextTrackId,
               eventFocusTable: [{max, result}],   // editable Random Event Focus Table (1d100 bands)
               deconstructed: {                     // Published Adventures tab (Mythic Mag #50)
                 title, pageCount, adventureDie, latestPage, pageHistory:[int],
                 firstSceneConcept, meaningList:[str]<=20,
                 pendingWords,   // Adventure Elements still owed a Meaning List word
                 crisisPP, diminisher },
               threeAct: {                           // 3-Act Story tab (Mythic Mag #42)
                 storyThread, act:1|2|3, phase:'acts'|'resolution'|'closing'|'done',
                 outer:[0-4,0-4,0-4], inner:[int,int,int], npcIntroduced, pcProtected } },
  log:       [{ts, section, md}]
}
```

`gm.inspiration` is the Game Master tab's own state — a user-editable weighted
list under Discover Meaning, collapsed behind a checkbox (`enabled`) and, when
open, an "Edit list" toggle (mirroring the Random Event Focus Table pattern
below). `freshInspirationEntries()` (the 5 defaults) and `freshGm()` /
`sanitizeGm()` live in `03-state-persistence.js`; `rollInspirationSource()`
(weighted 1..totalWeight pick, walking the list in order) is in
`06-tab-game-master.js`, next to `randomEventWords()`.

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
`03-state-persistence.js`. Every Adventure Element rolled (except an "Unusable page — roll
again" reroll) adds 1 to `pendingWords`; every word added to the Meaning List
removes 1. It never exceeds the free list slots (`20 - meaningList.length`).
The tab's result HTML escapes user text (Expected Scene, Meaning words, Event
Focus rows) before it applies the `**bold**` / `*italic*` markers. That tab deliberately reads and writes the *shared*
`gme.chaosFactor` / `sceneNumber` / `expectedScene` / `threads` / `characters` /
`eventFocusTable` (same campaign, one scene clock) and adds only the
deconstructed-specific panels on top.

`gme.threeAct` is the 3-Act Story tab's own state; `freshThreeAct()` /
`sanitizeThreeAct()` are in `03-state-persistence.js`. That tab also reads
and writes the *shared* `gme.threads` (its Story Thread and any Conflict-
triggered blocking Threads get added there) but keeps its own Act/outer/inner
progress separate from the Mythic GME tab's Scene clock — the worksheet's
Acts don't map onto Scene numbers 1:1. `THREE_ACT_BEATS` / `THREE_ACT_INNER_EVENTS`
/ `threeActInnerEvent()` / `fireThreeActEvent()` are in `17-tab-three-act-story.js`.

`playerEmu` is the Player Emulator tab's state. `freshPlayerEmu()` /
`sanitizePlayerEmu()` (with `sanitizePlayerEmuPc()` / `sanitizePlayerEmuNpc()` /
the shared `reindexById()` id-backfill helper) live in `03-state-persistence.js`;
each PC's chart is stored as plain `{name, rating, segments}` rows (rating copied
in, clamped to ±4) so file 03 needs nothing from the later tab file. The tables
and roll helpers (`PE_RESPONSE_TYPES`, `peBuildChart()`, `pePcResponse()`, …) are
in `16-tab-player-emulator.js`.

- `campaign()` returns the currently-selected campaign object; almost every
  handler mutates fields on it directly, then calls `persist()`.
- `persist()` writes the whole `STORE` to `sessionStorage` under
  `mythicToolkit_v1`. This is **session-only** — it clears when the browser
  tab closes. That's a deliberate tradeoff already communicated to the user,
  not a bug to silently "fix" by switching to `localStorage` without asking.
  The optional Dropbox sync is the supported way to keep campaigns across
  tabs. `saveStore()` returns `false` when the browser refuses the write.
  After a successful write, `persist()` calls `dropboxNoteSave()` (a no-op
  while Dropbox sync is off).
- Export/Import (campaign bar) round-trip a campaign through JSON. Imported
  data always goes through `sanitizeCampaign()`/`sanitizeBox()` before being
  accepted — never assign parsed JSON straight into `STORE.campaigns`.
  Import also reads the Dropbox sync file (`{ mythicToolkitSync: 1,
  campaigns }`) and adds every campaign in it; `importCampaign()` /
  `finishImport()` in `05-campaign-bar.js` do the renaming and re-render for
  both shapes.

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

## Dropbox sync (`js/app/19-dropbox-sync.js`)

Optional, off by default. Ported from the osr_keeper project's
`js/dropbox.js`, with the same sign-in, API calls, sync decision, and
conflict dialog. It stores every campaign in `STORE` as one JSON file in the
user's Dropbox and keeps it in sync. There is no backend, so:

- **Sign-in is OAuth 2 with PKCE and no redirect URI.** `dropboxConnect()`
  opens a blank tab inside the click (so pop-up blockers allow it), makes a
  verifier with `dropboxPkcePair()` (S256 with `crypto.subtle`, else
  `plain`), and sends the tab to `/oauth2/authorize` with
  `token_access_type=offline`. Dropbox shows a code. The user pastes it into
  `#dbxCode`, and `dropboxFinishConnect()` trades it at `/oauth2/token` for a
  4-hour access token and a refresh token that does not expire.
  `dropboxAccessToken()` refreshes by itself (`grant_type=refresh_token`,
  app key only, no secret; concurrent callers share one refresh). Nothing
  redirects back, so it works from `file://` and from the single-file
  release. `#dbxOpen` links the same URL when the tab was blocked.
- **The app is a Dropbox "App folder" app** with `files.content.read` and
  `files.content.write`. It sees only `Apps/<app name>/`. The file is
  `DBX_FILE_PATH` (`/Mythic Toolkit campaigns.json`). `dropboxFindRemote()`
  first tries the file id it synced with, then the path, so a rename or move
  inside the app folder doesn't break it. The app key comes from the panel's
  Setup (`dbxConfig.appKey`) or `DBX_DEFAULT_APP_KEY`. It is not a secret;
  never put the app secret in the code.
- **The synced file** is `dropboxSyncText()`:
  `{ "mythicToolkitSync": 1, "campaigns": STORE.campaigns }`. It leaves out
  `STORE.current`, so switching campaigns in one tab is not a change to sync.
- **API calls** are plain `fetch` (`dropboxFetch()` adds the bearer token and
  always uses `POST`). A 401 refreshes once and retries; a second 401, or a
  refused refresh, drops the tokens and sets the status to `signed-out`.
  Errors carry Dropbox's `error_summary` (`e.summary`). `files/download` asks
  for `rev:<rev>`, so the text always matches the metadata. `files/upload`
  uses `mode: add` to create and `mode: update` with the rev to replace:
  Dropbox refuses (409 `path/conflict`) if another device wrote in between,
  and the next pass then sees the change. `dropboxHeaderJson()` escapes
  non-ASCII in the `Dropbox-API-Arg` header.
- **Per-device data stays out of `STORE`**, in three keys:
  - `localStorage['mythicToolkit_dropbox_v1']` = `dbxConfig`
    (`enabled`, `appKey`). It survives closing the tab.
  - `localStorage['mythicToolkit_dropbox_token']` (`token`, `expiresAt`,
    `refresh`, `appKey`).
  - `sessionStorage['mythicToolkit_dropbox_sync']` = `dbxSync`
    (`fileId`, `remoteHash`, `syncedHash`, `lastSync`, `base`). `base` is
    the per-campaign merge base: `{ "<name>": { local, remote } }`, the hash
    of each campaign in this tab and in the Dropbox file at the last sync
    (`dropboxBaseOf()`). They differ when `sanitizeCampaign()` changed a
    pulled campaign.

  **The sync bookkeeping is session-only on purpose — this is the one real
  difference from osr_keeper.** It describes the `STORE` in this tab's
  `sessionStorage`. A new tab starts with an empty `STORE`. If the
  bookkeeping were in `localStorage`, the new tab would see "only local
  changed" and upload its empty campaign over the Dropbox copy.
- **One sync pass** (`dropboxSyncNow()`), in order:
  1. Hash the local state: `dropboxHash(dropboxSyncText())`, FNV-1a plus the
     length.
  2. Read the Dropbox file's metadata (`dropboxFindRemote()`).
  3. `dropboxDecideSync(remote, dbxSync, hash)` returns `create` (no file
     yet), `link` (a file this tab never synced with), `noop`, `upload` (only
     local changed), `pull` (only Dropbox changed), or `conflict` (both
     changed).
  4. `create`/`upload` sends the text. `pull` downloads the file and runs
     `dropboxApplyRemote()`, unless the local state changed during the
     download: then it is a `conflict`. A `link` from a tab that holds only
     the untouched "Campaign 1" (`dropboxIsPristine()`) is a `pull` too — so
     a new tab loads the Dropbox campaigns without asking. Any other `link`
     or `conflict` downloads the file: if it is the same text, it only
     records it; otherwise it merges **campaign by campaign** (step 5).
  5. `dropboxMergePlan(raw, STORE.campaigns, base)` compares each campaign
     with `dbxSync.base` (`null` for a `link`, so no side counts as older):
     a campaign that only one side changed takes that side's copy; a delete
     on one side wins only when the other side did not change the campaign
     (an edit is never lost to a delete); a campaign that only one side has
     is added. Without a base, an untouched `freshCampaign()` on one side
     gives way to the other. Only a campaign that **both** sides changed to
     different content is a conflict. No conflict: `dropboxApplyMerge()`
     puts the merge in this tab, records the Dropbox file as the new base,
     and uploads the merge by rev (a 409 means the next pass merges again).
     A conflict opens `#dropboxModal` and changes nothing until the answer.
     This is the osr_keeper rule (each document is its own file there, so
     only a document both devices changed is a question), kept inside one
     file here because campaigns are keyed by name.

  `dropboxApplyRemote()` runs every campaign through `sanitizeCampaign()`,
  keeps `STORE.current` when that campaign still exists, writes with
  `saveStore()` (not `persist()`, so a pull is not queued as an upload), and
  re-renders. It records the hash of the state *after* sanitizing, so a
  cleaned copy isn't uploaded back. It writes no log line: two devices would
  otherwise pull each other's log line forever. If the browser storage is
  full, it throws instead of recording the sync.
- **When it runs**: `dropboxNoteSave()` (from every `persist()`) debounces an
  upload by `DBX_UPLOAD_DELAY` (4 s), but never longer than `DBX_MAX_WAIT`
  (30 s) after the first unsynced save. `initDropbox()` (last in
  `20-init.js`) syncs at boot. The tab returning to the foreground re-checks
  Dropbox (at most once a minute), and going to the background flushes a
  pending upload. The `online` event also syncs. While `#dropboxModal` is
  open (status `conflict`), saves don't sync. The dialog names only the
  conflicting campaigns. The user chooses **Keep both** (primary for a
  `conflict`: this tab's copy keeps the name, the Dropbox copy is added as
  "<name> (Dropbox)"), **Use the Dropbox copy** (primary for a `link`),
  **Keep this tab's copy**, **Export**, or **Decide later** (Escape too).
  Each answer is `dropboxResolveConflict(choice)` → `dropboxApplyMerge()`,
  and applies only to the conflicting campaigns; the others are merged as in
  step 5. The plan is made again from `dbx.conflict.text` and the current
  `STORE.campaigns` at each use, so an edit made while the dialog waits is
  kept. The campaign-bar button and the panel's **Resolve** reopen it. A
  window `focus` also re-checks Dropbox (at most once a minute), because a
  window that stays visible next to another app gets no `visibilitychange`.
  **Disconnect** revokes the token (best effort) and forgets it, and keeps
  the app key.
- **UI**: `#btnDropbox` in the campaign bar shows the status (`Dropbox`,
  `Synced`, `Saving…`, `Reconnect`, `Resolve`, `Sync error`) and opens
  `#dropboxOverlay` (the panel). `wireDropbox()` builds the panel and modal
  markup **once**; `renderDropbox()` only toggles and fills it. So a status
  change never wipes a half-typed code or app key. This is a deliberate
  exception to the render/wire "rebuild the HTML" convention.

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
Chaos Factor / End Scene, the Adventure Meaning List and its `pendingWords`
counter, the "Unusable page" reroll, HTML escaping of user text in results,
the Diminisher helper, and `sanitizeDeconstructed()` — and (`13`) the Player Emulator tab — the
re-sorted `PE_RESPONSE_TYPES` / `peResponseType` mapping, `PE_NPC_MOODS` /
`PE_OUTLOOKS`, `peRatingLabel`, `peBiasedRoll` / `peRollType` / `peRollMood`
Advantage/Disadvantage, the 10-segment `peBuildChart` / `peChartResponseAt`,
`sanitizePlayerEmu` (junk PCs dropped, chart trimmed to 10 segments, `adjust`
clamped, `npcMoodMode` enum-guarded, `useHeldResponses` boolean-guarded,
`sanitizeCampaign(null)` still deep-equals `freshCampaign()`), and the tab UI
(add PC, roll Outlook, build chart, add NPC, NPC-mood Adv/Disadv dropdown,
generate encounter mood verdict, the reuse-held-responses checkbox, Wild card
path, reference-table toggle, remove PC). Spec `05` also covers the Game
Master tab's Random Inspiration Source: `sanitizeGm()` / `freshGm()` (in `03`)
— default-list fallback on junk input, weight clamped 1-100, label
trimmed/truncated — plus the tab UI: the enable checkbox showing/hiding the
section, a weighted roll via `rollInspirationSource()`, the "last result
survives re-render" cache when the editor is toggled, editing a label/weight,
add/remove entries (remove disabled at 1 remaining), and Reset to default.
Spec `04` also covers the split view (right-click a tab): unsplit by default,
right-click pins a tab right without disturbing the main tab, right-clicking
a different tab moves the split, right-clicking the pinned tab again (or its
own close button) closes it, the `currentTab`/`rightTab` invariant holds even
when you right-click the tab currently shown on the left, left-clicking a
pinned tab reclaims it into the main pane, an action inside the right pane
updates only that pane's own content, and the split survives an unrelated
global re-render (e.g. switching campaigns). `tests/helpers.js` has
`rightClickTab(id)` for dispatching the `contextmenu` event, and `showTab()`
mirrors the same currentTab/rightTab invariant the real click handler
enforces. Spec `14` covers the Help overlay ("?" button) — opens with a
section for every tool, embeds the Published Adventures tab's own
`PUB_FLOW_HTML` verbatim, its table-of-contents links all resolve to real
section ids, and it closes via its own close button, a backdrop click,
or Escape (but not a click inside the panel). Spec `15` covers the 3-Act
Story tab — `threeActInnerEvent()`'s Act 1/2/3 sequences (incl. cycling past
the end), `fireThreeActEvent()`'s dice thresholds and one-time-condition
skips (Incident Scene / Introduce NPC) for every Act Event including New
Conflict?'s recursion into Conflict, `sanitizeThreeAct()`, and the tab UI —
recording a Scene with/without a Story Beat (outer vs inner marks), an Act
auto-advancing at its 4th outer circle, Act 3 completing into the
Resolution/Closing/Done phases and back via reset, In Media Res, and the
Conflict 8-10 "Add to Threads List" suggestion. Spec `16` covers Dropbox
sync against two fakes: a `window.open` that records the consent URL, and a
`window.fetch` fake Dropbox (token endpoint + `files/*` calls, in memory,
with real revs and real `content_hash` values via `crypto.subtle`). It
covers `dropboxDecideSync()`, `dropboxPkcePair()`, connect + create +
debounced upload, a wrong code, token refresh and a revoked refresh token,
pull, an edit during a pull (merged), a rev conflict on upload (merged on
the next pass), different campaigns changed on each side (merged without a
question), deletes against edits, `dropboxMergePlan()` /
`dropboxResolvePlan()` rules, the same campaign changed on both sides (the
dialog names it) with each of Keep both / Use the Dropbox copy / Keep this
tab's copy / Decide later, a new tab loading the Dropbox copy, a
non-pristine link asking only about a campaign both sides have (and adding
the others), a renamed file, Disconnect, the `sanitizeCampaign()` pass on pull,
and Import of the sync file. `tests/tests.html` sets
`window.MYTHIC_DROPBOX_KEY_PREFIX` before the app scripts, so the test run
uses its own `localStorage` keys: all `file://` pages share one
`localStorage`, and a test run must not disconnect the real app.
`resetApp()` clears those keys and resets `dbxConfig` / `dbxSync` / `dbx`.
Not covered: the real Dropbox consent page. Check it by hand with a real app
key.

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
  tab. Export/Import and the optional Dropbox sync exist to work around this.
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

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
The Triple-O tab is the one exception to the license: Triple-O's text is
CC BY-SA 4.0, so its tables (`01b-triple-o-tables.js`) and rule summaries
(`17c-tab-triple-o.js`) are shared under CC BY-SA 4.0 (see `NOTICE.md`).

## What this is

A no-build, fully-offline browser app — a digital dice-tray for the
*Mythic One-Page GM Emulator* suite of tabletop-RPG tools: Game Master
(Ask the GM / Discover Meaning / Random Events), Adventure Crafter, Location
Crafter, Creature Crafter, Character Crafter, and Mystery Matrix — plus tabs
for full Mythic GME 2e and several Mythic Magazine variants (Published
Adventures, 3-Act Story, Node Narratives) and a Player Emulator — plus a
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
                            (header/.campaign-bar incl. the "⚙ Settings"
                            button#btnSettings (with the span#dbxStatus Dropbox
                            badge) and the "?" Help button,
                            nav#tabNav, div#panelSplit > main#panelHost +
                            aside#panelHostRight, section#noteSection,
                            section#logSection, footer.site-footer
                            (license + attribution line), div#helpOverlay,
                            div#settingsOverlay, div#dropboxModal) + the
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
| `01-data-tables.js`              | Every table transcribed from the cheat sheet: `DISCOVER_ACTION/DESC`, `ASK_ODDS`, `PLOT_ROWS`/`THEMES`, `LOCATION_DESCRIPTORS`/`areaElement()`, `CREATURE_DESCRIPTORS`/`ABILITY_WORDS`/behavior tables, `CHARACTER_DESCRIPTORS`/`NPC_STAT_MOD`/`behaviorContext()`, `MYSTERY_DESCRIPTORS`/`mysteryElement()`/`pickDie()`, `SCENE_ADJUSTMENTS`, `BEHAVIOR_CONTEXT`. Ends with the **editable random tables** registry: `RANDOM_TABLES` / `RANDOM_TABLE_BY_KEY`, `cleanTableRow()` / `cleanTableRows()`, `tableList(key)` / `tableEntry(key, roll)` (see "Editable random tables") |
| `01b-triple-o-tables.js`         | **Triple-O tables (CC BY-SA 4.0)** — the 14 d66 tables of *Triple-O* v1.0.2: spark (`TRIPLE_O_ACTION`, `_FOCUS`, `_METHOD`, `_DISPOSITION`, `_MOTIVATION`, `_DYNAMICS`, `_APPROACHES`) and specific (`_COMBAT`, `_SOCIAL`, `_EXPLORATION`, `_DELVING`, `_INTERPRETATION`, `_DOWNTIME`, `_PLANNING`), 36 rows each in d66 order. `TRIPLE_O_TABLES` / `TRIPLE_O_TABLE_BY_KEY` (keys `toAction` … `toPlanning`). The file pushes each table into `RANDOM_TABLES` / `RANDOM_TABLE_BY_KEY` (group "Triple-O", `sides: 36`), so they are editable in Settings; it must load after 01 and before 03. `tripleOIndex(tens, ones)` turns a d66 into 1..36. |
| `02-dice-markdown-utils.js`      | `rollDie`, `timestamp`, `escapeMd` (Markdown-table-safe only), `escapeAttr` (HTML-attribute-safe) |
| `03-state-persistence.js`        | `STORAGE_KEY`, `freshCampaign()`, `newCampaign()` (a fresh campaign with `createdAt` = now), `freshUi()` / `sanitizeUi()`, `sanitizeBox()`/`sanitizeCampaign()` (import validation), `loadStore()`/`saveStore()`, `STORE`, `campaign()`, `persist()`, `addLog()` |
| `04-tab-render-scaffolding.js`   | `TABS`, `currentTab`, `rightTab` (split-right pane, see "Split view" below), `renderTabNav()`, `renderActive()`, `wireActive()`, `tabRenderers()`/`tabWirers()` (lazy lookups, safe to call only after every file has loaded); `applyCampaignView()` / `liveView()` / `saveView()` / `restoreViewTabs()` / `switchCampaignView()` (the UI state saved in the campaign, see "Split view"); `tabHeader(title, descHtml)` + `isIntroOpen()` / `setIntroOpen()` (the shared tab-intro toggle, see "Collapsible cards"); `editListEntry()` (the inline Edit of a `.gme-list` row, see "List rows") |
| `05-campaign-bar.js`             | `renderCampaignBar()`, `clearNoteDraft()`, `wireCampaignBar()` (New/Rename/Delete/Export/Import); `HINT_MAX_AGE` / `campaignIsNew()` / `updateHints()` (hint text only in a campaign less than a day old, see "State model") |
| `06-tab-game-master.js`          | `renderGM()` / `wireGM()`; `randomEventWords()` — a Discover Meaning Action+Description pair, shared with the Mythic GME tab's Interrupt Scene; `rollInspirationSource()` — weighted roll on Discover Meaning's editable Random Inspiration Source list |
| `07-tab-adventure-crafter.js`    | `renderAdventure()` / `wireAdventure()` |
| `08-tab-location-crafter.js`     | `REGION_START_PP`, `renderLocation()` / `wireLocation()`; `locSetupOpen` (collapsible Region Setup card) |
| `09-tab-creature-crafter.js`     | `renderCreature()` / `wireCreature()` |
| `10-tab-character-crafter.js`    | `CHAR_CATEGORIES`, `renderCharacter()` / `wireCharacter()` |
| `11-tab-mystery-matrix.js`       | `boxByUid`, `renderMatrixTable()`, `renderMystery()`, `addBox`, `rollMysteryWords`, `toggleConnection`, `connectionExists`, `checkClincherByConnections`, `rollMatrixTarget`, `wireMystery()` |
| `12-quick-note.js`              | `noteMDE`, `renderNoteSection()` / `wireNoteSection()` |
| `13-campaign-log.js`            | `buildLogMarkdown()` (raw MD, source of truth), `renderLogHtml()` (MD→sanitized HTML for display only), `renderLogSection()` / `wireLogSection()` |
| `14-tab-mythic-gme.js`         | **Full Mythic GME 2e** tab — **first in `TABS`, the default landing tab** (the others are One-Page Mythic): `discoveryCheckResult()`, `DISCOVERY_ODDS`, `sceneAdjustment()` (rows 1-6 from the editable `sceneAdjustments` table), `rollEventFocus()`, `oneMeaningWord()`, `renderMythicGME()` / `wireMythicGME()`. Threads/Characters Lists, Chaos Factor, Expected-Scene test (Altered → Scene Adjustment + word; Interrupt → editable Event Focus table + word), collapsible Thread Progress Tracks. The Random Event Focus Table is edited only in the Settings modal (file 21); the tab has no card for it. Fate Questions here call `askTheGM()` from the GM tab. |
| `15-tab-published-adventures.js` | **Published Adventures** tab (2nd in `TABS`) — "Deconstruct The Known" (Mythic Magazine #50). **Shares `gme.chaosFactor` / `sceneNumber` / `expectedScene` / lists / `eventFocusTable`** with the Mythic GME tab; its own state is `gme.deconstructed`. `ADVENTURE_DIE_BANDS` / `adventureDieOptions()` / `rollAdventureDie()`, `PAGE_SECTIONS`, `crisisElement()` (Crisis Scene Element Table), `specialElement()` (Special Elements Table), `rollAdventureElement()` (page counter + wrap), `renderPublished()` / `wirePublished()`, plus a `PUB_FLOW_HTML` "How it works" flowchart, shown with the tab intro by the **?** button (`tabHeader()`, see "Collapsible cards"). Its scene test is the Deconstructed variant: `>CF & odd → Expected`, `>CF & even → Crisis Scene`, `≤CF → Altered (odd, +Adventure Element) / Interrupt (even, +Event Focus +Adventure Element)`. |
| `16-tab-player-emulator.js`      | **Player Emulator** tab (just before Triple-O in `TABS`) — a solo "player emulator" from *Cloud Empress: Solo Protocol*. `PE_RESPONSE_TYPES` (Character Response Types re-sorted **most-minus → most-plus**, 50 rows / 1d100) + `peResponseType()`; `PE_NPC_MOODS` (1d10) + `peNpcMood()`; `PE_OUTLOOKS` (1d10, roll-and-display only — `PE_WILDCARD_OUTLOOK` is the one that changes a roll); `peRatingLabel()` / `peRatingClass()`; `peBiasedRoll(sides, mode)` (Adv = keep lowest, Dis = keep highest) with `peRollType(mode)` = 1d100 for a Character Type and `peRollMood(mode)` = 1d10 for an NPC mood (the add-NPC dropdown, persisted as `npcMoodMode`); `peBuildChart(mode)` (weighted 10-segment Response Chart); `peChartResponseAt()`; `pePcResponse()`; `renderPlayerEmu()` / `wirePlayerEmu()`. Generates a whole encounter's mood at once: every tracked PC responds (1d10 on their chart, or a fresh 1d100 on the full table if their Outlook is Wild card), every NPC has one mood, and all conflict ratings plus a manual adjustment are summed — total ≥ +4 ⇒ a violent encounter begins. The per-PC "Roll response" button caches its result in module-level `peLastResponse` / `peResponseHtml` (both cleared on PC removal or chart rebuild); the encounter generator's `useHeldResponses` checkbox (default on) reuses that held response instead of re-rolling, and writes any fresh rolls back so the PC cards stay in sync. |
| `17-tab-three-act-story.js`      | **3-Act Story** tab (3rd in `TABS`, right after Published Adventures) — the "Mythic 3-Act Story Structure" worksheet (Mythic Magazine #42), a screenwriting Setup/Conflict/Resolution overlay on normal Mythic play. **Shares `gme.chaosFactor` / `sceneNumber` / `threads` / `characters` / `eventFocusTable`** with the Mythic GME tab; its own state is `gme.threeAct`. Each Act has an **outer** circle track (`THREE_ACT_BEATS`, 4 slots, the 4th ends the Act — mark one per distinct Story Beat achieved in a Scene) and an **inner** circle track (`THREE_ACT_INNER_EVENTS`, uncapped — mark one whenever a Scene has no Story Beat; `threeActInnerEvent()` looks up which Act Event fires, cycling the last entry once the list is exhausted). `fireThreeActEvent()` resolves one triggered Act Event: rolls dice per the rules (Story Thread Activity / Conflict / Twist? / New Conflict? — the last recurses into Conflict), skips the one-time Incident Scene / Introduce NPC events once their condition is already met, and rolls a Meaning word pair (`randomEventWords()`, from the Game Master tab) for flavor. A Conflict roll of 8-10 surfaces a suggested new blocking Thread with an inline "Add to Threads List" button. `renderThreeAct()` / `wireThreeAct()`; an optional "Start In Media Res" button (Act 1, before anything happens) fires all three opening Act Events at once; phases progress `acts → resolution → closing → done` as Act 3's outer track completes, mirroring the worksheet's Resolution/Closing Scenes; a `THREE_ACT_FLOW_HTML` "How it works" flowchart is shown with the tab intro by the **?** button, the same as the Published Adventures tab. The circle counts/order were read off the worksheet graphic itself (the PDF's extracted text scrambles the spiral layout). |
| `17b-tab-node-narratives.js`    | **Node Narratives** tab (4th in `TABS`, right after 3-Act Story) — "Node Based Narratives" (Mythic Magazine #71). A **Node Sheet** (`gme.nodeSheet`) replaces the Threads/Characters Lists for this tab: Scene / Event / Thread / Character Nodes, each with 8 numbered Connection points (1 = top right, then clockwise), joined by Connections `{a, as, b, bs}`. **Shares `gme.chaosFactor` / `sceneNumber` / `expectedScene` / `eventFocusTable`** with the Mythic GME tab. Pure sheet helpers take the sheet `s`: `nodeLinksOf()`, `nodeFreeSlots()`, `nodeSceneNode()` / `nodePrevScene()`, `nodeFreeCellNear()`, `nodePickSlot()` (nearest free point, or the d8 "Node Choice Or Not" rule), `nodeConnectError()` / `nodeConnect()`, `nodeAdd()` (adds the **Origin Connection**: a Scene to the previous Scene Node, any other Node to the current Scene Node, made first if missing), `nodeEnsureScene()`, `nodeDuplicate()`, `nodeEliminate()` (Thread/Character only; removes its Connections), `nodeDelete()`, `nodeMove()`. `nodeWalk(s, startId, steps, roll)` finds the **Influence Node**: one usable Connection → follow it; more → d8 and count clockwise to the first Connected point; a Connection back to the start Node is never usable; doubling back is allowed; a Node with no usable Connection ends the walk there (a judgment call, written to the log). `NODE_FOCUS_TABLE` / `nodeFocusResult()` (the Node Random Event Focus Table, or the campaign table with its NPC/Thread rows read as Influence Node), `nodeMovementDie()` (d4, or the Dynamic Node Die Range). `renderNodeBoard()` draws the sheet: absolutely placed boxes on a 4-column grid (32 boxes = one "Sheet"), Connections as an SVG layer under them; the last Influence Node path is highlighted (`nodeLastWalk`). Click a Node to select it (`nodeSelectedId`, the "Selected Node" panel); click a point, then a point on another Node, to Connect those exact points (`nodePendingSlot`); drag a Node, or click an empty box while one is selected, to move it. `NODE_FLOW_HTML` is the "How it works" flowchart behind the **?**, embedded in Help too. |
| `17c-tab-triple-o.js`           | **Triple-O** tab (last in `TABS`) — *Triple-O: The Player Character Emulator* by Cezar Capacle: you play the GM, the dice decide what the player characters do. State is `campaign().tripleO` (`chars` = Trait Sheets, `party` = party Traits, `draft` = the Check being set up; `freshTripleO()` / `sanitizeTripleO()` in 03). The **Triple-O Check** card has four modes (`TRIPLE_O_MODE_INFO`: `action`, `question`, `group`, `check`), three entries (Obvious / Option / Odd; blanks allowed), and **Double-Down** (2d6: `toPending` waits for the user to keep one die, unless both dice give the same result; doubles show a follow-up: mark a Trait Prevalent / add a Trait / add a party Trait / add a Temporary `CN` Trait). `tripleOBand(d)` (4-6 obvious, 2-3 option, 1 odd). Group mode has **Rank by dice** (`tripleORank()`: 1d6 per course, highest = Obvious; ties roll all three again, logged as a judgment call). `tripleORoll(key)` (one d66 roll with the "opposite combination") and `tripleOSpark(id)` (a table or a `TRIPLE_O_COMBOS` combo: Action + Focus / Method / Motivation, Improvise an NPC); a spark result can fill an entry or become a Trait. Card order: Triple-O Check, Trait Sheets, Random tables, Reference tables. The Check card lists every character one under the other (`button.to-who[data-to-who]`: a click picks `draft.who`, a second click clears it; in group mode the rows only show Traits, under a party row), each with its Trait chips. The entries stack below 620px of card width (container query on `.to-check`). **Trait Sheets**: per character a name, details and up to `TRIPLE_O_MAX_TRAITS` (12) Traits `{text, status, category}`; a closed sheet is one compact row (`.to-sheet-row`: name, details, counts), **Edit sheet** (`toEditChars`) shows the editable rows, whose text fields save on `change` without a re-render. Results render from module-level state (`toResult`, `toPending`, `toRankHtml`, `toSpark`), not cached HTML. `TRIPLE_O_FLOW_HTML` is the "How it works" flowchart behind the **?**, embedded in Help too. |
| `18-help.js`                    | Help overlay ("?" button in the campaign bar) — `HELP_OVERVIEW_SVG` (inline SVG map of how the tools connect), `renderHelpContent()` / `openHelp()` / `closeHelp()` / `wireHelp()`. Pure informational content, no persisted state. Its last section (`#help-credits`) holds the license and attribution — keep it in step with `NOTICE.md` and the `footer.site-footer` in `index.html`. Its Published Adventures section embeds that tab's own `PUB_FLOW_HTML` verbatim (see file 15) rather than restating it, so the two can't drift apart. |
| `19-dropbox-sync.js`            | Optional **Dropbox sync** of every campaign — ported from the osr_keeper project's `js/dropbox.js`. PKCE sign-in (`dropboxConnect()` / `dropboxFinishConnect()`), token refresh, `dropboxDecideSync()`, `dropboxSyncNow()`, `dropboxNoteSave()` (called by `persist()`), the conflict dialog (`openDropboxModal()`, `dropboxUseRemoteCopy()` / `dropboxUseLocalCopy()`), and the panel (`renderDropbox()`, `wireDropbox()`, `initDropbox()`). See "Dropbox sync" below. |
| `20-themes.js`                  | Color + font themes — `UI_THEMES` (`classic` = "Case file", `fantasy`, `sf`, `horror`), `THEME_KEY`, `loadTheme()` / `applyTheme()` / `setTheme()` / `wireTheme()`. A theme is only `<html data-theme="…">`; `css/app.css` redefines the `:root` tokens per theme. The file applies the saved theme at load, before the first render. See "Design system quick reference". |
| `21-settings.js`                | **Settings modal** ("⚙ Settings" in the campaign bar, `div#settingsOverlay`) — `settingsOpen`, `settingsTablesOpen`, `wireSettings()` (builds the shell once: Theme section with `#themeSelect`, Dropbox section `#settingsDropbox`, Random tables section `#settingsTables`; owns the Escape key for Settings and the Dropbox conflict dialog), `openSettings(table)` / `closeSettings()`, `renderSettingsTables()` / `wireSettingsTables()` — collapsible `<details>` editors for the Random Event Focus Table (`gme.eventFocusTable`) and the Random Inspiration Source (`gm.inspiration.entries`). See "Settings modal" below. |
| `22-init.js`                    | `DOMContentLoaded` handler that kicks everything off: `restoreViewTabs()` first, then `updateHints()`, then the renders, `wireHelp()`, `wireSettings()`, `wireTheme()`, `wireDropbox()`, the scroll restore, and `initDropbox()` last |

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
unsplit), plus `introOpen` (the open **?** intros, see "Collapsible cards").
**They are the campaign's UI state**, saved in `campaign().ui`
(`{ currentTab, rightTab, intros, at }`, `freshUi()` / `sanitizeUi()` in
03). So they survive a reload, and they are exported and synced with the
campaign:

- `saveView()` writes the live view to `campaign().ui` (with `at` =
  `Date.now()`) after every tab or intro change and on `pagehide`. It calls
  `persist()` only when the UI state really changed.
- `applyCampaignView()` puts `campaign().ui` in the live view. It drops
  unknown tab ids and a `rightTab` equal to `currentTab`, and gives a
  campaign without `ui` a fresh one. `restoreViewTabs()` (first in
  `22-init.js`) calls it before the first render. `switchCampaignView()`
  calls it and redraws the tab nav on a campaign switch (campaign bar,
  Import, Delete, a Dropbox pull that changes the selected campaign).
- **New** campaign starts with the view on screen (`liveView()`).
- A Dropbox pull does not move what you look at: it stores the pulled
  `ui`, but the live view changes only when the selected campaign changes,
  or when a new tab loads the Dropbox copy (`dropboxApplyRemote(…, true)`).

Only the window scroll position stays in
`sessionStorage[VIEW_KEY]` (`mythicToolkit_view`, `{ scrollY }`): the init
handler scrolls to it on the next frame (`history.scrollRestoration =
'manual'`, because the browser's own restore runs before the script renders
the page). The Settings modal's open state is not saved.

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
While split, `renderActive()` sets `body.split-view`, and `app.css` widens
`.wrap` from 1180px to 1480px. `.wrap` keeps `margin:0 auto`, so the wider
container stays centered.

## Collapsible cards

Cards that you set once, or read only now and then, collapse behind a
**Show / Hide** button (`btn small`, in the card's title row). The open
state is a module-level `let`, read by `render<Tab>()` and flipped by a
click handler that calls `renderActive()`. While a card is collapsed, its
fields are not in the DOM, so `wire<Tab>()` guards each lookup with
`if(el)`. A collapsed card shows one `small-note` line with its current
values. These states are not saved: a reload collapses them again.

| Card | Tab (file) | State | Collapsed line |
|---|---|---|---|
| The Prepared Adventure | Published Adventures (15) | `pubPreparedOpen` | title, page count, Adventure Die |
| Diminisher Value | Published Adventures (15) | `pubDimOpen` | current Diminisher |
| The Story Thread | 3-Act Story (17) | `threeActThreadOpen` (`null` = open until a Story Thread is set) | Story Thread, PC protected |
| Region Setup | Location Crafter (08) | `locSetupOpen` | region size |
| Reference tables | Player Emulator (16) | `peRefOpen` | short description |
| Options | Node Narratives (17b) | `nodeOptionsOpen` | movement die, point rule, focus table |

**Tab intros.** Every tab starts with `tabHeader(title, descHtml, moreHtml)`
(04): the `h2.tool-title` plus a round **?** button right after it
(`.intro-toggle[data-intro-toggle]`, `aria-expanded`, gold `.open` state). The intro paragraph (`p.tool-desc`) shows only
while it is open. Each tab has its own open state, so the **?** in one pane
does not open the other pane's intro. `renderActive()` renders each pane
through `renderTab(id)`, which sets `introTab` so `tabHeader()` knows its
tab. Every intro is collapsed by default; the open tab ids are kept in
the campaign's UI state (`campaign().ui.intros`, see "Split view").
`setIntroOpen()` calls `saveView()`. `wireActive()` wires the button, so a tab's own `wire<Tab>()` does
nothing for it. The Published Adventures and 3-Act Story tabs pass their
"How it works" flowchart (`PUB_FLOW_HTML` / `THREE_ACT_FLOW_HTML`) as
`moreHtml`, so the **?** shows it below the intro (`.tool-intro-more`); they
have no separate "How it works" card. The tab header CSS (`.tool-head`,
`.intro-toggle`) is in the base styles next to `h2.tool-title`, not in a
theme block.
`resetApp()` (tests) closes every one of these.

## List rows (`.gme-list`)

The Threads and Characters Lists (Mythic GME, 14), the Adventure Meaning
List (Published Adventures, 15), the NPC list (Player Emulator, 16) and the
Selected Node's Connections (Node Narratives, 17b) are `ul.gme-list` rows.
A row's buttons show only on hover or keyboard focus (`:focus-within`), and
always on a touch screen (`@media (hover:none)`). Every text list has an
**Edit** button (`data-edit`, `data-mn-edit`, `data-npc-edit`). It calls
`editListEntry(btn, value, save)` (04): the row's `.txt` becomes an
`input.list-edit`; Enter or leaving the field saves a changed, non-empty
value and calls `renderActive()`; Escape cancels. A Thread, Character or
Meaning List edit writes a log line; an NPC rename does not (an NPC add or
remove does not either).

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
  tripleO:   { chars:[{id, name, details, traits:[{text, status:'default'|'prevalent'|'temporary', category}]<=12}]<=20,
               nextCharId, party:[trait]<=12,                // Triple-O tab: Trait Sheets + party Traits
               draft:{ mode:'action'|'question'|'group'|'check', who:charId|null,
                       question, obvious, option, odd, doubleDown } },   // the Check being set up
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
                 outer:[0-4,0-4,0-4], inner:[int,int,int], npcIntroduced, pcProtected },
               nodeSheet: {                          // Node Narratives tab (Mythic Mag #71)
                 title,
                 nodes:[{id, type:'scene'|'event'|'thread'|'character', text, scene:int|null,
                         cell:int (box on the sheet grid), eliminated}],
                 links:[{a, as:1-8, b, bs:1-8}],      // Connections: Node ids + their points
                 nextId, dynamicDie, randomSlots, alteredInfluence, focusMode:'node'|'campaign' } },
  tables:    { <RANDOM_TABLES key>: [str] },  // only the random tables this campaign edited
  log:       [{ts, section, md}],          // oldest first; the screen shows it newest first
  createdAt: ms|null,                      // null = from before the field (counts as old)
  ui:        { currentTab, rightTab, intros:[tabId], at }   // UI state, see "Split view"
}
```

`createdAt` is set by `newCampaign()` (03) for every campaign the app
creates: the first "Campaign 1" of a tab, **New**, and the fallback of a
Dropbox merge. `freshCampaign()` keeps it `null`, so `sanitizeCampaign(null)`
still deep-equals `freshCampaign()`. `updateHints()` (05) sets
`<html class="no-hints">` when the current campaign is a day old or more
(`HINT_MAX_AGE`), or has no `createdAt`; `app.css` then hides every
`::placeholder` and the Quick Note placeholder (`.CodeMirror-placeholder`).
It runs at boot and on every campaign switch.

`gm.inspiration` is the Game Master tab's own state — a user-editable weighted
list under Discover Meaning, collapsed behind a checkbox (`enabled`). The
list is edited only in the Settings modal (`21-settings.js`); the tab has no
Edit button. `freshInspirationEntries()` (the 5 defaults) and `freshGm()` /
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

`gme.nodeSheet` is the Node Narratives tab's own state; `freshNodeSheet()` /
`sanitizeNodeSheet()` / `nodeCanConnect()` / `NODE_TYPES` are in
`03-state-persistence.js`. The sanitizer drops a Node with an unknown type,
dedupes ids (`reindexById()`) and boxes, and drops every Connection the
rules do not allow: a missing or eliminated Node, a point outside 1-8, a
point already used, a second Connection between the same two Nodes, or a
Thread/Character-to-Thread/Character Connection. A campaign in
`sessionStorage` from before the tab existed has no `nodeSheet`;
`nodeSheet()` (17b) adds a fresh one on first use. The tab keeps its own
Scene Nodes and does not touch `gme.threads` / `gme.characters`.

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
     a campaign that only one side changed takes that side's copy (the
     comparison leaves out `ui`: `dropboxContentJson()` /
     `dropboxCampaignHash()`, so a UI-only difference is no change and no
     conflict, and `dropboxWithNewerUi()` keeps the newer `ui` by `ui.at`
     on the copy it picks); a delete
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
  `22-init.js`) syncs at boot. The tab returning to the foreground re-checks
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
  kept. The panel's **Resolve** button reopens it. A
  window `focus` also re-checks Dropbox (at most once a minute), because a
  window that stays visible next to another app gets no `visibilitychange`.
  **Disconnect** revokes the token (best effort) and forgets it, and keeps
  the app key.
- **UI**: the panel is the Dropbox section of the Settings modal
  (`#settingsDropbox`, see "Settings modal" below). The `#dbxStatus` badge
  inside the campaign bar's `#btnSettings` shows the status (`Synced`,
  `Saving…`, `Reconnect`, `Resolve`, `Sync error`); it is hidden while sync
  is off. `wireDropbox()` builds the panel and modal markup **once**;
  `renderDropbox()` only toggles and fills it. So a status
  change never wipes a half-typed code or app key. This is a deliberate
  exception to the render/wire "rebuild the HTML" convention.

## Settings modal (`js/app/21-settings.js`)

Every per-device or per-campaign setting is in one modal, opened by
`#btnSettings` in the campaign bar. `wireSettings()` builds the shell once,
before `wireTheme()` and `wireDropbox()` fill their sections. Sections, in
order:

1. **Theme** — `#themeSelect` (20-themes.js).
2. **Dropbox sync** — the panel from 19-dropbox-sync.js, in `#settingsDropbox`.
   It is never rebuilt, so a half-typed code survives (see "Dropbox sync").
3. **Random tables** — `#settingsTables`, the current campaign's editable
   tables, each a `<details>` editor: Random Event Focus Table
   (`gme.eventFocusTable`) and Random Inspiration Source
   (`gm.inspiration.entries`). The ids are the ones the tab editors had
   (`data-focus-*`, `#btnGmeFocusAdd`, `data-insp-*`, `#btnGmInspAdd`, …).
   After them, one `<details data-settings-table="rt_<key>">` per
   `RANDOM_TABLES` entry, under an `h4.settings-group` per tool: a textarea
   (`data-rt-text`, one row per line), a count note (`data-rt-count`), the
   "customised" tag (`data-rt-tag`) and **Reset to default** (`data-rt-reset`).
   A textarea saves on `change` without a re-render and updates only its
   count and tag in place.

Only `#settingsTables` re-renders. `renderActive()` calls
`renderSettingsTables()` while `settingsOpen`, so the editors follow every
campaign switch and Dropbox pull. A structural edit (a max, a weight, add,
remove, reset) calls `persist()` + `renderActive()`; a text edit only calls
`persist()`, so the focus moves on normally. `settingsTablesOpen` keeps each
editor's open state across re-renders and re-opens.
The tabs have no Edit buttons for these tables: the user edits them only
in Settings. `openSettings(table)` still takes an optional key
(`'eventFocus'` / `'inspiration'`) that expands that editor; the specs use it. To add another editable table, add a
`<details data-settings-table="<key>">` block, a key in
`settingsTablesOpen`, and its handlers in `wireSettingsTables()`.

### Editable random tables

Every table whose rows are plain text for the player is in `RANDOM_TABLES`
(01): the Meaning Tables (Actions, Descriptions), Scene Adjustments (rows
1-6), the five Plot Points columns, and the Location, Creature, Character
and Mystery descriptors, abilities, statistics and behavior tables. Each
entry has `key`, `group`, `label`, `sides` (the die the rules give),
optional `offset` (Plot Points: rolls 1-16 stay Conclusion / None) and the
default `rows`.

- The campaign stores only the tables the user changed, in
  `campaign().tables` (`sanitizeTables()` in 03: known keys only, rows
  trimmed, `<` `>` removed, at most `RANDOM_TABLE_MAX_ROWS` rows of
  `RANDOM_TABLE_MAX_LEN` characters, a copy equal to the default dropped).
  So the tables are exported and synced with the campaign.
- `tableEntry(key, roll)` keeps the rules' die and shares the numbers
  `offset+1..sides` evenly over the rows. 50 rows on 1d100 is 2 numbers per
  row, as on the cheat sheet. A repeated row is more likely. Every tab
  lookup (`discoverWord()`, `plotPointWord()`, `abilityWord()`,
  `behaviorContext()`, `sceneAdjustment()`, the descriptor rolls) goes
  through it. The original constants stay as the defaults.
- `tableList()` cleans the stored copy again on read, because a
  `sessionStorage` campaign is not sanitized on load. The `<` `>` strip
  matters: the tabs put these rows in `innerHTML` without escaping.
- Not in the list, on purpose: tables whose rows drive the app's logic
  (`ASK_ODDS`, `areaElement()`, `mysteryElement()`, `crisisElement()` /
  `specialElement()`, Player Emulator ratings and Outlooks, `NODE_FOCUS_TABLE`,
  Creature New Behavior, 3-Act events). To add a text table, add an entry to
  `RANDOM_TABLES` and read it with `tableEntry()`.

## The log: Markdown is the source of truth, HTML is a view

`campaign().log` stores raw Markdown strings, oldest first. `buildLogMarkdown()` just
concatenates them under a header — that's what **Copy** and **Download**
export verbatim, oldest first. The screen shows the newest entry at the
top: `renderLogHtml()` calls `buildLogMarkdown(true)`, and
`renderLogSection()` keeps the view at the top (or on the entries you
scrolled to) when an entry is added. `renderLogHtml()` runs that same Markdown through
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
Quick Note → Log → sanitised-HTML pipeline (newest entry on top, export oldest first), (`11`) the Mythic GME tab —
Chaos Factor clamp, Expected-Scene test (Altered → Scene Adjustment + word,
Interrupt → Event Focus + word) with `sceneAdjustment()` / `rollEventFocus()`
unit tests, the Event Focus Table editor (in Settings only, no card on the tab), list add/edit/dupe/remove/roll and the hover-only row buttons,
Progress Track progress / auto-Flashpoint / Conclusion / Discovery Check /
collapse toggle — and (`12`) the Published Adventures tab —
`adventureDieOptions` / `rollAdventureDie` / `crisisElement` / `specialElement`
tables, the running page counter + wrap, the Deconstructed scene test's four
outcomes (incl. Crisis Scene generation and its Crisis PP maths), the shared
Chaos Factor / End Scene, the Adventure Meaning List (incl. Edit) and its `pendingWords`
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
survives re-render" cache across a Settings edit, no editor or Edit button
on the tab, `openSettings('inspiration')` expanding the list, editing a label/weight,
add/remove entries (remove disabled at 1 remaining), and Reset to default.
Spec `04` also covers the tab intros (collapsed by default, one open
state per tab, so each pane toggles only its own, saved in `campaign().ui`), the saved view (`saveView()` after a tab change,
`restoreViewTabs()`, `applyCampaignView()` dropping bad ids and junk, `sanitizeUi()`, each campaign keeping its own view across a switch, a
new campaign starting with the view on screen), the hint text (`updateHints()` / `campaignIsNew()`, `createdAt` in `sanitizeCampaign()`), the Settings
modal (sections, close by button / backdrop / Escape, an expanded editor
staying expanded after an edit and a re-open, the editors following a
campaign switch), the themes (`#themeSelect` options, `<html data-theme>`
and the `localStorage` key on change, the fallback to Mythic GME for an unknown
id, a theme change keeping the current tab) and the split view (right-click a tab): unsplit by default,
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
or Escape (but not a click inside the panel). Specs `07`, `12` and `15` also cover the collapsible cards (Region Setup;
The Prepared Adventure, Diminisher Value and the flowchart behind the **?**;
The Story Thread's automatic open state and the flowchart behind the **?**).
Spec `15` covers the 3-Act
Story tab — `threeActInnerEvent()`'s Act 1/2/3 sequences (incl. cycling past
the end), `fireThreeActEvent()`'s dice thresholds and one-time-condition
skips (Incident Scene / Introduce NPC) for every Act Event including New
Conflict?'s recursion into Conflict, `sanitizeThreeAct()`, and the tab UI —
recording a Scene with/without a Story Beat (outer vs inner marks), an Act
auto-advancing at its 4th outer circle, Act 3 completing into the
Resolution/Closing/Done phases and back via reset, In Media Res, and the
Conflict 8-10 "Add to Threads List" suggestion. Spec `17` covers the
Node Narratives tab — the Node Random Event Focus Table, `nodeMovementDie()`,
`nodeWalk()` against the magazine's Shallow Rock example (d8 counting, the
start Node skipped, doubling back, dead ends), the 8-point limit, the
random-point rule, `sanitizeNodeSheet()`, and the UI (Origin Connections,
point-to-point Connections, the Selected Node panel, moving a Node, the
Influence Node highlight, the scene test, Random Events, Options, HTML
escaping). Spec `19` covers the Triple-O tab — the 14 tables (36 rows, in `RANDOM_TABLES`), `tripleOBand()`, `tripleOIndex()`, `tripleORoll()` and the opposite combination, `tripleORank()` (incl. ties), `sanitizeTripleO()`, and the UI (modes, a 1d6 Check per band and its log line, Double-Down with a pick and with doubles and each doubles follow-up, Rank by dice, spark results filling an entry or adding a Trait, Trait Sheet add / edit / status / remove, party Traits, HTML escaping). Spec `18` covers the editable random tables (`tableEntry()`
mapping with default and custom rows, the Behavior Context and Plot Points
bands, `sanitizeTables()`, the Settings textareas, Reset, one copy per
campaign) and the 8-line Expected Scene fields. Spec `16` covers Dropbox
sync against two fakes: a `window.open` that records the consent URL, and a
`window.fetch` fake Dropbox (token endpoint + `files/*` calls, in memory,
with real revs and real `content_hash` values via `crypto.subtle`). It
covers `dropboxDecideSync()`, `dropboxPkcePair()`, connect + create +
debounced upload, a wrong code, token refresh and a revoked refresh token,
pull, an edit during a pull (merged), a rev conflict on upload (merged on
the next pass), different campaigns changed on each side (merged without a
question), deletes against edits, `dropboxMergePlan()` /
`dropboxResolvePlan()` rules (incl. a UI-only difference: no conflict, the newer `ui` wins), the same campaign changed on both sides (the
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

The default theme is **Mythic GME** (`:root[data-theme="mythic"]`, also set
on `<html>` in `index.html` so the first paint is light): the look of the
Mythic GME 2e book — a light lavender-grey page, white panels, indigo
`#2f3066` section banners (`h3.block-title`) and active tab with light
condensed headings, Garamond body text, lavender result boxes, and tables
with an indigo header row and lavender stripes. It is the only light theme,
so its "bright" tokens (`--gold-bright`, `--moss-bright`, `--rust-bright`)
are the *darker* shades: they are text colors. `--on-accent` (mythic only)
is the text color on an indigo or plum fill. Its block-title banner needs
`!important` on `padding`/`border`, because collapsible card heads set them
inline. `DEFAULT_THEME` in `20-themes.js` is the fallback for an unknown or
missing saved theme.

The other themes are dark. "Case file" is a restrained dark theme; CSS custom properties in `:root`
(`--ink`, `--panel`, `--moss` = clue/confirm green, `--rust` = suspect/danger
red, `--gold` = highlight/solved accent, `--font-display` = serif for
labels/headings, `--font-mono` for numbers/dice/log and every `.result-box`).
Reuse these tokens for any new UI rather than hardcoding colors. For a tint,
use `color-mix(in srgb, var(--gold) 14%, transparent)`, not an `rgba()` of
the default color — a hardcoded color does not follow the theme.

**Themes.** `:root[data-theme="mythic"|"fantasy"|"sf"|"horror"]` blocks in `app.css`
redefine the same tokens (and the font stacks); "Case file" is plain `:root`
with no attribute. A few heading rules are theme-specific (Sci-fi uppercases
titles, Horror colors block titles `--rust-bright`). Rules every theme
keeps: no pure black background, no pure white text, desaturated accents,
and at least 4.5:1 contrast for `--text` and `--text-dim` on `--ink`,
`--panel` and `--panel-2` (check a new palette with a WCAG contrast
calculation). Fonts are system stacks only — no web fonts, the app is
offline. The chosen theme is a per-device preference in
`localStorage[THEME_KEY]` (`mythicToolkit_theme`, with the same test prefix
as the Dropbox keys). It is not in `STORE`, so it is not exported or synced.
To add a theme: add a `UI_THEMES` entry and a `:root[data-theme="<id>"]`
block.

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

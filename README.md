# Mythic Toolkit

A digital dice tray for the *Mythic Game Master Emulator* family of solo
tabletop-RPG tools. It runs in the browser, works fully offline, and needs no
install and no build step.

## Open the app

Use one of these:

- **Single file.** Download `mythic-toolkit.html` from the latest
  [GitHub Release](https://github.com/stories-with-dice/mythic_gm/releases).
  Open it from disk. It holds the whole app.
- **From the repository.** Clone the repository. Open `index.html` in the
  browser. It works over `file://`, with no server.
- **Online.** The `Deploy static content to Pages` workflow
  (`.github/workflows/static.yml`) publishes the repository to GitHub Pages
  on every push to `main`.

## Tools

Each tool is a tab. The Mythic GME tab opens first.

| Tab | What it does |
|---|---|
| Mythic GME | Full Mythic GME 2e: Fate Questions, Chaos Factor, the Expected Scene test, Threads and Characters Lists, Thread Progress Tracks, and an editable Random Event Focus Table. |
| Published Adventures | "Deconstruct The Known" (Mythic Magazine #50): play a published adventure with an Adventure Die, Crisis Scenes, and an Adventure Meaning List. It shares the Chaos Factor, Scene, and Lists with the Mythic GME tab. |
| 3-Act Story | The Mythic 3-Act Story Structure worksheet (Mythic Magazine #42): Story Beats and Act Events across three Acts, then Resolution and Closing Scenes. |
| Game Master | One-Page Mythic: Ask the GM, Discover Meaning, Random Events, and an optional weighted Random Inspiration Source list. |
| Adventure Crafter | Themes and Plot Points. |
| Location Crafter | Regions, Areas, and Progress Points. |
| Creature Crafter | Creature descriptors, abilities, and behavior. |
| Character Crafter | NPC descriptors, stats, and behavior. |
| Mystery Matrix | Clues and Suspects, connections, and the Clincher. |
| Player Emulator | A solo player emulator from *Cloud Empress: Solo Protocol*: PC Response Charts, NPC moods, and an encounter mood verdict. |

Two panels are always below the active tab:

- **Quick Note** — a Markdown editor. Press Enter to add the note to the log.
  Press Shift+Enter for a new line.
- **Campaign Log** — every roll and note, in order. **Copy Markdown** and
  **Download .md** give the log as Markdown.

Right-click a tab to show it in a second pane on the right (split view).
Click **?** in the header for the help overview.

## Campaigns and saving

The **Campaign** dropdown in the header switches between campaigns. Each
campaign has its own tab state and its own log.

The app saves to the browser's `sessionStorage`. **Your data clears when you
close the browser tab.** To keep campaigns, do one of these:

- Click **Export** to save a campaign as a JSON file. Click **Import** to load
  it again.
- Turn on Dropbox sync (see below).

## Dropbox sync (optional)

Dropbox sync keeps every campaign in one JSON file in your Dropbox, in
`Apps/<app name>/Mythic Toolkit campaigns.json`. It is off by default. The app
sends nothing to the network until you click **Connect**.

1. In the [Dropbox App Console](https://www.dropbox.com/developers/apps),
   click **Create app**. Choose **Scoped access** and **App folder**.
2. On the **Permissions** tab, tick `files.content.write` and
   `files.content.read`. Click **Submit**.
3. On the **Settings** tab, keep **Allow public clients (Implicit Grant &
   PKCE)** on **Allow**. You do not need a redirect URI.
4. In the Mythic Toolkit, click **☁ Dropbox**. Open **Setup: Dropbox app
   key** and paste the app key.
5. Click **Connect**. Allow access in the Dropbox tab that opens.
6. Copy the code that Dropbox shows. Paste it into the panel.

After that, the app uploads a few seconds after each change. It checks
Dropbox when the tab opens or comes back to the foreground. If this tab and
Dropbox both changed, the app merges them campaign by campaign. It asks only
about a campaign that changed on both sides, and it can keep both copies.

The app key is not a secret. Do not put the app secret anywhere in the app.

## Run the tests

The test suite in `tests/` drives the real app in a headless Edge or Chrome.
It needs Node and no npm packages.

```bash
node tests/run.mjs
```

Exit code `0` means all tests passed. You can also open `tests/tests.html` in
a browser. See [tests/README.md](tests/README.md) for the layout and coverage.

## Build the single file

`scripts/build-singlefile.mjs` puts every stylesheet and script from
`index.html` into one file, `dist/mythic-toolkit.html`.

```bash
node scripts/build-singlefile.mjs
```

The `release.yml` workflow (`.github/workflows/release.yml`) runs this script
on every push to `main`. It publishes the file as a GitHub Release, tagged
`v1`, `v2`, and so on.

## Project layout

| Path | Contents |
|---|---|
| `index.html` | The page shell and the ordered list of scripts. |
| `css/` | `app.css` (design tokens and components) and the EasyMDE vendor CSS. |
| `js/app/` | The app: one classic script per area, loaded in `NN-` order. |
| `js/vendor/` | marked.js, DOMPurify, and EasyMDE, saved locally for offline use. |
| `tests/` | The browser test suite. |
| `scripts/` | The single-file build script. |
| `LICENSE`, `NOTICE.md` | The CC BY-NC 4.0 license and the attribution. |

To change the code, read [AGENTS.md](AGENTS.md) first. It explains the
render/wire pattern for each tab, the state model, the import sanitizer, and
the mistakes to avoid.

## License and credits

This is an **unofficial fan tool**. It is not made or endorsed by Word Mill
Games. It is free and non-commercial. It does not include the rule books.

The project is licensed under
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (see
[LICENSE](LICENSE)). The vendor libraries keep their own licenses.

This work is based on *Mythic Game Master Emulator Second Edition*,
*One-Page Mythic Game Master Emulator*, *The Adventure Crafter*,
*The Location Crafter*, *The Creature Crafter*, and *Mythic Magazine*, by
Tana Pigeon, published by [Word Mill Games](https://www.wordmillgames.com/)
under [CC BY-NC 4.0](https://wordmillgames.com/license.html). The Player
Emulator adapts tables from *Cloud Empress: Solo Protocol*.

[NOTICE.md](NOTICE.md) has the full attribution, the list of changes, and the
vendor library licenses.

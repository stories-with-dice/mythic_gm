/* =========================================================================
   HELP OVERLAY
   -------------------------------------------------------------------------
   A "?" button in the campaign bar opens a full-page overlay summarising
   every tool in the app and how they connect, from the minimal "Ask the GM
   / Discover Meaning" loop up through the full Mythic GME 2e extensions.
   Pure informational content — no persisted state, nothing to sanitize.
   The per-tool step diagrams reuse the `.flow-diagram` component (an alias
   of the Published Adventures tab's `.pub-flow`, see app.css); the
   Published Adventures section below embeds that tab's own PUB_FLOW_HTML
   verbatim so the two never drift apart.
   ========================================================================= */
let helpOpen = false;

// Inline SVG "map of the app" — boxes are CSS-styled via .help-diagram's
// classes (hd-*) in app.css so they follow the app's design tokens.
const HELP_OVERVIEW_SVG = `
<svg viewBox="0 0 880 504" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagram: Ask the GM and Discover Meaning form the core loop; Crafters, Mythic GME and Player Emulator branch off it; Published Adventures extends Mythic GME; everything can log to Quick Note and the Campaign Log; all of it lives inside one Campaign.">
  <defs>
    <marker id="hdArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" class="hd-arrowhead"/>
    </marker>
  </defs>

  <rect x="6" y="6" width="868" height="490" rx="14" class="hd-outer"/>
  <text x="24" y="28" class="hd-outer-label">CAMPAIGN &mdash; New / Rename / Delete / Export / Import (sessionStorage; optional Dropbox sync)</text>

  <text x="24" y="52" class="hd-label">CORE LOOP &mdash; always available, in the Game Master tab</text>
  <rect x="250" y="60" width="170" height="60" rx="8" class="hd-box hd-box-core"/>
  <text x="335" y="84" text-anchor="middle" class="hd-title">Ask the GM</text>
  <text x="335" y="102" text-anchor="middle" class="hd-sub">Fate Questions</text>
  <text x="440" y="97" text-anchor="middle" class="hd-swap">&#8646;</text>
  <rect x="460" y="60" width="170" height="60" rx="8" class="hd-box hd-box-core"/>
  <text x="545" y="84" text-anchor="middle" class="hd-title">Discover Meaning</text>
  <text x="545" y="102" text-anchor="middle" class="hd-sub">Action + Description words</text>
  <text x="440" y="134" text-anchor="middle" class="hd-note">A double roll on Ask the GM auto-triggers a Random Event (same word roll)</text>

  <path d="M300,120 L170,178" class="hd-arrow" marker-end="url(#hdArrow)"/>
  <path d="M440,148 L440,178" class="hd-arrow" marker-end="url(#hdArrow)"/>
  <path d="M580,120 L710,178" class="hd-arrow hd-arrow-dashed" marker-end="url(#hdArrow)"/>

  <rect x="28" y="188" width="267" height="196" rx="8" class="hd-box"/>
  <text x="161" y="210" text-anchor="middle" class="hd-title">Optional Crafters</text>
  <text x="161" y="226" text-anchor="middle" class="hd-sub">build content on demand</text>
  <text x="46" y="248" class="hd-bullet">&bull; Adventure Crafter &mdash; Theme + Plot Points</text>
  <text x="46" y="268" class="hd-bullet">&bull; Location Crafter &mdash; Region PP + Areas</text>
  <text x="46" y="288" class="hd-bullet">&bull; Creature Crafter &mdash; descriptor words</text>
  <text x="46" y="308" class="hd-bullet">&bull; Character Crafter &mdash; 4 word categories</text>
  <text x="46" y="328" class="hd-bullet">&bull; Mystery Matrix &mdash; Clues, Suspects, Clincher</text>
  <text x="46" y="352" class="hd-note-inline">Feed results into whichever loop you run.</text>

  <rect x="307" y="188" width="267" height="92" rx="8" class="hd-box hd-box-accent"/>
  <text x="440" y="208" text-anchor="middle" class="hd-title">Mythic GME (full 2e)</text>
  <text x="323" y="228" class="hd-bullet">&bull; Chaos Factor (1&ndash;9)</text>
  <text x="323" y="246" class="hd-bullet">&bull; Scene Test: Expected/Altered/Interrupt</text>
  <text x="323" y="264" class="hd-bullet">&bull; Threads/Characters Lists + Progress Tracks</text>

  <path d="M440,280 L440,288" class="hd-arrow" marker-end="url(#hdArrow)"/>

  <rect x="307" y="288" width="267" height="96" rx="8" class="hd-box hd-box-accent"/>
  <text x="440" y="308" text-anchor="middle" class="hd-title">Published Adventures</text>
  <text x="323" y="328" class="hd-bullet">&bull; Deconstruct The Known (Myth. Mag #50)</text>
  <text x="323" y="346" class="hd-bullet">&bull; extends: shares Chaos Factor/Scene/Lists</text>
  <text x="323" y="364" class="hd-bullet">&bull; adds Adventure Die pages + Crisis Scenes</text>

  <rect x="586" y="188" width="267" height="196" rx="8" class="hd-box"/>
  <text x="719" y="210" text-anchor="middle" class="hd-title">Player Emulator</text>
  <text x="719" y="226" text-anchor="middle" class="hd-sub">Cloud Empress: Solo Protocol</text>
  <text x="604" y="248" class="hd-bullet">&bull; PC Outlooks + Response Charts</text>
  <text x="604" y="268" class="hd-bullet">&bull; NPC moods (1d10)</text>
  <text x="604" y="288" class="hd-bullet">&bull; Encounter Mood sums ratings live</text>
  <text x="604" y="308" class="hd-bullet">&bull; total &ge; +4 &rArr; violent encounter</text>
  <text x="604" y="332" class="hd-note-inline">Independent &mdash; pairs with any tool above.</text>

  <path d="M161,384 L440,424" class="hd-arrow" marker-end="url(#hdArrow)"/>
  <path d="M440,384 L440,424" class="hd-arrow" marker-end="url(#hdArrow)"/>
  <path d="M719,384 L440,424" class="hd-arrow" marker-end="url(#hdArrow)"/>

  <rect x="28" y="428" width="825" height="56" rx="8" class="hd-box hd-box-bottom"/>
  <text x="440" y="452" text-anchor="middle" class="hd-title">Quick Note &amp; Campaign Log</text>
  <text x="440" y="470" text-anchor="middle" class="hd-sub">always visible below the active tab &mdash; every roll and note can append here as Markdown</text>
</svg>`;

function renderHelpContent(){
  return `
  <div class="help-inner" role="dialog" aria-modal="true" aria-labelledby="helpTitle">
    <button type="button" class="btn help-close" id="btnHelpClose" aria-label="Close help">&times;</button>
    <h2 class="tool-title" id="helpTitle">Help &amp; Overview</h2>
    <p class="tool-desc">A map of every tool in this toolkit, from the minimal Mythic GM loop to the full Mythic GME 2e extensions. Each tab also has its own inline notes and (where useful) a "How it works" panel &mdash; this page is the bird's-eye view.</p>

    <ul class="help-toc">
      <li><a href="#help-core">Core loop</a></li>
      <li><a href="#help-crafters">Crafters &amp; Mystery Matrix</a></li>
      <li><a href="#help-gme">Mythic GME (full 2e)</a></li>
      <li><a href="#help-pub">Published Adventures</a></li>
      <li><a href="#help-nodes">Node Narratives</a></li>
      <li><a href="#help-pe">Player Emulator</a></li>
      <li><a href="#help-tripleo">Triple-O</a></li>
      <li><a href="#help-utility">Quick Note, Log &amp; Campaigns</a></li>
      <li><a href="#help-credits">License &amp; credits</a></li>
    </ul>

    <div class="help-diagram">${HELP_OVERVIEW_SVG}</div>

    <div class="help-section" id="help-core">
      <h3 class="block-title">Minimal setup &mdash; the core loop</h3>
      <p>Everything else in this app is optional. The <b>Game Master</b> tab alone covers the original One-Page Mythic loop: ask the fates a yes/no question, or roll for a nudge of inspiration, whenever the fiction calls for it.</p>
      <div class="flow-diagram">
        <div class="flow-group">
          <h4>Whenever you need a verdict</h4>
          <div class="flow-step"><b>1.</b> Type your question (optional, just for the log) and pick <b>Odds</b>, from Impossible up to Certain.</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step"><b>2.</b> <b>Roll 1d100</b> against the odds table &mdash; each Odds row is four bands, low roll to high:</div>
          <ul class="flow-branch">
            <li>Deep low end &rarr; <b>Exceptional Yes</b></li>
            <li>Rest of the lower half &rarr; <b>Yes</b></li>
            <li>Rest of the upper half &rarr; <b>No</b></li>
            <li>Deep high end &rarr; <b>Exceptional No</b></li>
            <li>A double (11, 22, 33&hellip;) &rarr; also fires a <b>Random Event</b></li>
          </ul>
        </div>
        <div class="flow-group">
          <h4>Whenever you need inspiration instead of a verdict</h4>
          <div class="flow-step"><b>Roll Discover Meaning</b> &mdash; an Action word, a Description word, or both &mdash; and read them as a prompt.</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step">Not evocative enough? <b>Roll again</b> &mdash; there's no limit, and nothing here is tracked as "used up".</div>
        </div>
      </div>
    </div>

    <div class="help-section" id="help-crafters">
      <h3 class="block-title">Crafters &amp; Mystery Matrix &mdash; build content on demand</h3>
      <p>These four tabs generate the nouns your scenes need &mdash; a theme, a place, a monster, an NPC, a mystery &mdash; independent of whichever loop above you're running. Roll one whenever the fiction needs it.</p>
      <div class="flow-diagram">
        <div class="flow-group">
          <h4>Adventure Crafter</h4>
          <div class="flow-step">Roll or set a <b>Main Theme</b> (1d10, or ask a Fate Question if you already have a hunch).</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step">Then roll a <b>Turning Point</b> (five linked Plot Points) or a one-off <b>Single Plot Point</b>.</div>
        </div>
        <div class="flow-group">
          <h4>Location Crafter</h4>
          <div class="flow-step"><b>Start New Region</b> &mdash; its size seeds starting Progress Points (PP).</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step"><b>Explore New Area</b> &mdash; rolls three elements (1d10 + current PP against the Area Elements Table); PP then goes up by 1, or down by 6 if an <b>Expected, PP-6</b> result came up (only the first time per Area).</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step">Rolling <b>Expected, Complete</b> marks the region <b>Complete</b> &mdash; not a PP threshold, just that one result; further exploring then auto-resolves as Expected.</div>
        </div>
        <div class="flow-group">
          <h4>Creature &amp; Character Crafters</h4>
          <div class="flow-step">Roll descriptor words per category (free-form for creatures; Identity/Mind/Body/Talent for characters) &mdash; <b>+ more</b> appends without clearing what's already rolled.</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step">Add mechanical flavor with a <b>Stat</b> roll (1d10 &rarr; modifier) and, for characters, a <b>Behavior Context</b> roll (1d100).</div>
        </div>
        <div class="flow-group">
          <h4>Mystery Matrix</h4>
          <div class="flow-step">Add boxes as <b>Clues</b> or <b>Suspects</b> &mdash; leave the label blank to roll two Mystery words instead.</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step">Check a matrix cell to connect one Clue &harr; one Suspect &mdash; that's the only pairing the grid allows.</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step">Run a <b>Discovery Check</b> &mdash; 1d100 + current box count against the Mystery Elements Table &mdash; to add connections or fresh boxes as play continues.</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step">A Suspect reaching <b>6 connections</b> is auto-flagged as the Clincher &mdash; your answer.</div>
        </div>
      </div>
    </div>

    <div class="help-section" id="help-gme">
      <h3 class="block-title">Mythic GME (full 2e)</h3>
      <p>The default landing tab. This is the full Mythic Game Master Emulator 2e scene loop &mdash; Chaos Factor, Scene tests, Lists, and Thread Progress Tracks &mdash; layered on top of the same Fate Questions and Discover Meaning tables from the Game Master tab.</p>
      <div class="flow-diagram">
        <div class="flow-group">
          <h4>Setup &mdash; once per campaign</h4>
          <div class="flow-step">Set the <b>Chaos Factor</b> (1&ndash;9; 5 is the 2e default) in the Scene strip under the tab bar, and seed the <b>Threads</b> &amp; <b>Characters</b> Lists (up to 3 copies of an entry &mdash; that's how you weight them).</div>
        </div>
        <div class="flow-group">
          <h4>Each Scene &mdash; repeat</h4>
          <div class="flow-step"><b>A.</b> Write your <b>Expected Scene</b> &mdash; what you think happens next.</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step"><b>B.</b> <b>Test vs Chaos Factor</b> (1d10):</div>
          <ul class="flow-branch">
            <li>&gt; CF &rarr; <b>Expected Scene</b> &mdash; plays out exactly as written.</li>
            <li>&le; CF &amp; <b>odd</b> &rarr; <b>Altered Scene</b> &mdash; roll the Scene Adjustment Table + one Meaning word.</li>
            <li>&le; CF &amp; <b>even</b> &rarr; <b>Interrupt Scene</b> &mdash; a Random Event: roll the (editable) Random Event Focus Table + a Meaning word pair.</li>
          </ul>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step"><b>C.</b> Play it out. Ask <b>Fate Questions</b> on this tab, with the Fate Chart (Odds against the Chaos Factor) or the Fate Check (2d10 + modifiers). Doubles at or under the Chaos Factor start a Random Event: Event Focus, a List roll for an NPC or Thread Focus, and two Meaning words. Use Discover Meaning on the Game Master tab as needed.</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step"><b>D.</b> <b>End the Scene</b> in the Scene strip: click End Scene, then answer <i>PC in control?</i> Yes &rarr; Chaos Factor &minus;1; No &rarr; +1. The next Scene starts.</div>
          <div class="flow-loop">&#8635; back to A for the next Scene.</div>
        </div>
        <div class="flow-group">
          <h4>Thread Progress Tracks &mdash; optional, per focused Thread</h4>
          <div class="flow-step">Start a Track (10/15/20 points) for a Thread you want to grind toward a Conclusion.</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step">Make <b>Progress +2</b> or a manual <b>Flashpoint +2</b>; crossing a 5-point phase with no Flashpoint yet <b>auto-fires</b> one (a Random Event, played straight rather than resolving the Thread).</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step">Stalled? Run a <b>Discovery Check</b> (a Fate Question, then the Thread Discovery Check Table) to push it forward.</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step">Full points &rarr; <b>Conclusion reached</b> &mdash; Plot Armor removed, the Thread can now resolve.</div>
        </div>
      </div>
    </div>

    <div class="help-section" id="help-pub">
      <h3 class="block-title">Published Adventures &mdash; Deconstruct The Known</h3>
      <p>Runs a prepared/published adventure as one giant Meaning table (Mythic Magazine #50). It shares its Chaos Factor, Scene count, Lists and Event Focus Table with the Mythic GME tab above &mdash; one scene clock, two front ends.</p>
      ${PUB_FLOW_HTML}
    </div>

    <div class="help-section" id="help-nodes">
      <h3 class="block-title">Node Narratives &mdash; Node Based Narratives</h3>
      <p>Records the adventure as a sheet of Nodes and Connections instead of the Threads and Characters Lists (Mythic Magazine #71). An Altered Scene, an Interrupt Scene or a Random Event moves along the Connections from the current Scene Node to find an Influence Node. It shares the Chaos Factor, Scene count and Expected Scene with the Mythic GME tab. Click a numbered point on one Node, then a point on another, to draw a Connection; drag a Node (or select it and click an empty box) to move it.</p>
      ${NODE_FLOW_HTML}
    </div>

    <div class="help-section" id="help-pe">
      <h3 class="block-title">Player Emulator</h3>
      <p>A solo "player emulator" adapted from <i>Cloud Empress: Solo Protocol</i>, for simulating how a party of PCs (and any NPCs present) reacts emotionally to a scene &mdash; independent of every tool above, and usable alongside any of them.</p>
      <div class="flow-diagram">
        <div class="flow-group">
          <h4>Setup &mdash; once per PC</h4>
          <div class="flow-step">Add a PC and roll their <b>Outlook</b> (1d10). A <b>Wild card</b> Outlook means they always respond on the full 1d100 table instead of a personal chart.</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step"><b>Build their Response Chart</b> &mdash; a weighted 10-segment chart drawn from the 50-row Character Response Types table (Advantage/Disadvantage bias the roll). <b>Edit chart</b> changes it by hand; <b>Hide</b> shows only the chart and Roll response.</div>
        </div>
        <div class="flow-group">
          <h4>Running an encounter</h4>
          <div class="flow-step">Add the NPCs present; each gets one rolled <b>Mood</b> (1d10, Advantage/Disadvantage available).</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step">Click <b>Roll response</b> on each PC card (1d10 on their chart, or a fresh 1d100 if Wild card) and set any <b>Extra conflict</b>. The <b>Encounter Mood</b> sums every rolled response, every NPC mood and the Extra conflict by itself (a + and a &minus; cancel).</div>
          <div class="flow-arrow">&#9660;</div>
          <div class="flow-step">Total tension <b>&ge; +4</b> &rarr; a violent encounter begins.</div>
          <div class="flow-loop"><b>Clear encounter</b> removes the NPCs and the PC responses for the next encounter.</div>
        </div>
      </div>
    </div>

    <div class="help-section" id="help-tripleo">
      <h3 class="block-title">Triple-O &mdash; The Player Character Emulator</h3>
      <p>Play solo from the GM's seat: you run the adventure, and the dice decide what the player characters do (<i>Triple-O</i> by Cezar Capacle). Keep each character's Traits on a <b>Trait Sheet</b> (Default, Prevalent or Temporary, with a short category tag), then use the <b>Triple-O Check</b> (click a Trait under <i>Who acts?</i> to change its status; <b>Roll a Trait</b> picks one at random, a Prevalent Trait counts twice) for an Action, a Question, a Group Action or a Check. The d66 spark and specific tables help you define the Option and the Odd, make Traits, or improvise an NPC. The tab does not use the Mythic Chaos Factor or Lists.</p>
      ${TRIPLE_O_FLOW_HTML}
    </div>

    <div class="help-section" id="help-utility">
      <h3 class="block-title">Quick Note, Campaign Log &amp; Campaigns</h3>
      <p><b>Quick Note</b> and the <b>Campaign Log</b> are always on screen: in a column on the right of a wide window, below the tab on a narrow one. Quick Note is a Markdown scratchpad &mdash; press Enter (or the toolbar) to commit it to the Log. The Log is the running record of everything you roll across every tab, newest entry at the top; it stores raw Markdown as the source of truth, and only renders it to sanitized HTML for on-screen display. Copy or Download export that Markdown verbatim, oldest first. <b>Clear log</b> runs at once; the toast at the bottom offers <b>Undo</b> for 10 seconds. The open tabs, the split view and the open <b>?</b> intros are saved with each campaign, so a reload, an export or Dropbox sync brings them back. Hint text in the fields shows only during the first day of a campaign.</p>
      <p>The <b>Campaign</b> dropdown at the top of the page switches between separate save slots, each with its own state for every tab. <b>New</b> is next to it; Rename, Export, Import and Delete are in the <b>Campaign &#8943;</b> menu. Delete runs at once, with <b>Undo</b> in the toast. Export/Import round-trip a campaign through a JSON file. Campaigns live in <code>sessionStorage</code>: closing the browser tab deletes them. While Dropbox sync is off, a <b>&#9888; Not saved</b> badge shows in the campaign bar, and the browser asks before it closes a tab that has log entries.</p>
      <p>The tabs are in three groups: <b>Mythic 2e</b>, <b>One-Page</b> and <b>Players</b>. Use the arrow keys to move between tabs. To see two tabs side by side, right-click a tab. On the four Mythic 2e tabs, the <b>Scene strip</b> under the tab bar holds the shared Chaos Factor, the Scene number and End Scene.</p>
      <p><b>3D dice.</b> Every button that rolls dice throws them as 3D dice first, with sound. The dice land on the rolled numbers, and the result shows a moment later. A d100 is two d10s (tens and units); a size with no die shape is a coin. Click the dice or press Escape to skip to the result. In <b>&#9881; Settings &rarr; Dice</b> you can turn the 3D dice and the sound off, and pick one of 12 dice skins, the theme's skin, or Random (a skin for every die).</p>
      <p><b>Dropbox sync</b> (in <b>&#9881; Settings</b> in the campaign bar) is optional and off by default. When you connect it, every campaign is saved as one file in your Dropbox app folder a few seconds after each change. A new tab, or another browser where you connect, then loads the same campaigns. If the Dropbox copy and this tab both changed, the app merges them campaign by campaign. It asks only about a campaign that changed on both sides: keep this tab's copy, the Dropbox copy, or both. Setup needs a free Dropbox app key once; the panel lists the steps.</p>
    </div>

    <div class="help-section" id="help-credits">
      <h3 class="block-title">License &amp; credits</h3>
      <p>Mythic Toolkit is an <b>unofficial fan tool</b>. It is not made or endorsed by Word Mill Games. It is free and non-commercial, and it does not replace the books.</p>
      <p>This work is based on <i>Mythic Game Master Emulator Second Edition</i>, <i>One-Page Mythic Game Master Emulator</i>, <i>The Adventure Crafter</i>, <i>The Location Crafter</i>, <i>The Creature Crafter</i>, and <i>Mythic Magazine</i> (incl. Volumes 42, 50 and 71), by Tana Pigeon, published by <a href="https://www.wordmillgames.com/" target="_blank" rel="noopener">Word Mill Games</a> under <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener">CC BY-NC 4.0</a>. The tables are transcribed, and the rules are adapted and automated as dice rolls.</p>
      <p>The Player Emulator adapts tables from <i>Cloud Empress: Solo Protocol</i> (<a href="https://cloudempress.com/" target="_blank" rel="noopener">cloudempress.com</a>).</p>
      <p>The Triple-O tab adapts <i>Triple-O: The Player Character Emulator</i> (v1.0.2) by Cezar Capacle, published by Critical Kit Ltd (<a href="https://capacle.itch.io/triple-o-zine" target="_blank" rel="noopener">capacle.itch.io/triple-o-zine</a>). Its text is licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>. The Triple-O tables and rule summaries in this app are adapted from it (transcribed, summarized, automated as dice rolls) and are shared under CC BY-SA 4.0.</p>
      <p>This app is licensed under <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener">CC BY-NC 4.0</a>. It bundles marked (MIT), DOMPurify (Apache-2.0 / MPL-2.0), and EasyMDE (MIT) under their own licenses.</p>
    </div>
  </div>`;
}

function openHelp(){
  helpOpen = true;
  const overlay = document.getElementById('helpOverlay');
  overlay.innerHTML = renderHelpContent();
  overlay.classList.add('open');
  wireHelpContent();
}
function closeHelp(){
  helpOpen = false;
  const overlay = document.getElementById('helpOverlay');
  overlay.classList.remove('open');
  overlay.innerHTML = '';
}
function wireHelpContent(){
  document.getElementById('btnHelpClose').addEventListener('click', closeHelp);
}
function wireHelp(){
  document.getElementById('btnHelp').addEventListener('click', openHelp);
  document.getElementById('helpOverlay').addEventListener('click', (e)=>{
    if(e.target.id === 'helpOverlay') closeHelp();
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && helpOpen) closeHelp();
  });
}

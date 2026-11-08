/* =========================================================================
   STATE / PERSISTENCE  (sessionStorage, keyed by campaign)
   ========================================================================= */
const STORAGE_KEY = "mythicToolkit_v1";

// Thread Progress Track sizes (Mythic GME 2e "Variations" chapter). Phases are
// 5 Progress Points each; the number of Flashpoint checkpoints is size/5 - 1
// (the final phase ends in the Conclusion, not a Flashpoint check).
const TRACK_SIZES = [10, 15, 20];
function trackFlashphases(size){ return size / 5 - 1; }

// Random Event Focus Table (Mythic GME 2e). Rows are contiguous 1d100 ranges
// keyed by the top of each range (`max`); it is user-editable per campaign, so
// this is only the starting point. `rollEventFocus()` (in the GME tab) matches
// a roll against whatever the campaign currently holds.
const DEFAULT_EVENT_FOCUS = [
  { max: 5,   result: "Remote Event" },
  { max: 10,  result: "Ambiguous Event" },
  { max: 20,  result: "New NPC" },
  { max: 40,  result: "NPC Action" },
  { max: 45,  result: "NPC Negative" },
  { max: 50,  result: "NPC Positive" },
  { max: 55,  result: "Move Toward A Thread" },
  { max: 65,  result: "Move Away From A Thread" },
  { max: 70,  result: "Close A Thread" },
  { max: 80,  result: "PC Negative" },
  { max: 85,  result: "PC Positive" },
  { max: 100, result: "Current Context" }
];
function defaultEventFocus(){ return DEFAULT_EVENT_FOCUS.map(r => ({ ...r })); }

// Valid Adventure Die specs for the "Deconstruct The Known" method
// (Mythic Magazine #50). `1d100` and multi-d20 sums are the awkward large cases.
const ADVENTURE_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', '2d20', '3d20', '4d20', 'd100'];
const DIMINISHER_VALUES = ['1/3', '1/5', '1/7', '1/10'];

function freshDeconstructed(){
  return {
    title: "",
    pageCount: 0,            // total pages of the prepared adventure (0 = not set)
    adventureDie: "d20",
    latestPage: 0,           // running page counter (0 = nothing rolled yet)
    pageHistory: [],         // every rolled page, in order
    firstSceneConcept: "",
    meaningList: [],          // Adventure Meaning List — single words, max 20
    pendingWords: 0,         // Adventure Elements rolled that still need a Meaning List word
    crisisPP: 0,             // Crisis Scene Progress Points
    diminisher: "1/3"
  };
}

// Player Emulator tab (Cloud Empress: Solo Protocol). A roster of PCs, each
// with an Outlook (1-10, or null) and a weighted 10-segment Response Chart,
// plus the NPCs currently in an encounter (each a single 1d10 mood) and a
// manual conflict adjustment. Response-type names/ratings are stored inline so
// this file needs nothing from the tab file (which loads later).
function freshPlayerEmu(){
  return { pcs: [], nextPcId: 1, npcs: [], nextNpcId: 1, adjust: 0, npcMoodMode: "normal", useHeldResponses: true };
}

function sanitizePlayerEmuPc(p){
  if(!p || typeof p !== "object") return null;
  const id = Number(p.id);
  const name = (typeof p.name === "string" && p.name.trim()) ? p.name.trim().slice(0, 60) : "Unnamed PC";
  const outlook = (Number.isInteger(p.outlook) && p.outlook >= 1 && p.outlook <= 10) ? p.outlook : null;
  const chartMode = ["normal", "adv", "dis"].includes(p.chartMode) ? p.chartMode : "normal";
  let total = 0;
  const chart = (Array.isArray(p.chart) ? p.chart : [])
    .filter(e => e && typeof e === "object" && typeof e.name === "string" && e.name.trim())
    .map(e => ({
      name: e.name.trim().slice(0, 40),
      rating: Number.isFinite(e.rating) ? Math.max(-4, Math.min(4, Math.round(e.rating))) : 0,
      segments: Number.isFinite(e.segments) ? Math.max(1, Math.min(10, Math.round(e.segments))) : 1
    }))
    .filter(e => {
      if(total >= 10) return false;
      if(total + e.segments > 10) e.segments = 10 - total;
      total += e.segments;
      return true;
    });
  return { id: Number.isFinite(id) ? id : null, name, outlook, chartMode, chart };
}
function sanitizePlayerEmuNpc(n){
  if(!n || typeof n !== "object") return null;
  const id = Number(n.id);
  const name = (typeof n.name === "string" && n.name.trim()) ? n.name.trim().slice(0, 60) : "NPC";
  const mood = (Number.isInteger(n.mood) && n.mood >= 1 && n.mood <= 10) ? n.mood : 1;
  return { id: Number.isFinite(id) ? id : null, name, mood };
}
// Dedupe / backfill ids in a list, returning the next free id.
function reindexById(list){
  const seen = new Set();
  let max = 0;
  list.forEach(x => {
    if(x.id != null && !seen.has(x.id)){ seen.add(x.id); max = Math.max(max, x.id); }
    else x.id = null;
  });
  list.forEach(x => { if(x.id == null){ x.id = ++max; seen.add(x.id); } });
  return max + 1;
}
function sanitizePlayerEmu(raw){
  const base = freshPlayerEmu();
  if(!raw || typeof raw !== "object") return base;
  const pcs = (Array.isArray(raw.pcs) ? raw.pcs.map(sanitizePlayerEmuPc).filter(Boolean) : []);
  const npcs = (Array.isArray(raw.npcs) ? raw.npcs.map(sanitizePlayerEmuNpc).filter(Boolean) : []);
  const maxPcId = reindexById(pcs);
  const maxNpcId = reindexById(npcs);
  const nextPcId = (Number.isFinite(raw.nextPcId) && raw.nextPcId > maxPcId - 1) ? Math.round(raw.nextPcId) : maxPcId;
  const nextNpcId = (Number.isFinite(raw.nextNpcId) && raw.nextNpcId > maxNpcId - 1) ? Math.round(raw.nextNpcId) : maxNpcId;
  const adjust = Number.isFinite(raw.adjust) ? Math.max(-20, Math.min(20, Math.round(raw.adjust))) : 0;
  const npcMoodMode = ["normal", "adv", "dis"].includes(raw.npcMoodMode) ? raw.npcMoodMode : "normal";
  const useHeldResponses = typeof raw.useHeldResponses === "boolean" ? raw.useHeldResponses : true;
  return { pcs, nextPcId, npcs, nextNpcId, adjust, npcMoodMode, useHeldResponses };
}

// Triple-O tab (17c-tab-triple-o.js). `chars` are the Trait Sheets: a name,
// free-text details and up to TRIPLE_O_MAX_TRAITS Traits, each with a status
// (Default / Prevalent / Temporary, as on the sheet) and a short category
// tag (e.g. CL, PR, MT). `party` holds the party Traits that a doubles roll
// on a Group Action adds. `draft` is the Triple-O Check being set up, so a
// re-render keeps what the user typed.
const TRIPLE_O_STATUSES = ["default", "prevalent", "temporary"];
const TRIPLE_O_MODES = ["action", "question", "group", "check"];
const TRIPLE_O_MAX_TRAITS = 12;
const TRIPLE_O_MAX_CHARS = 20;
function freshTripleODraft(){
  return { mode: "action", who: null, question: "", obvious: "", option: "", odd: "", doubleDown: false };
}
function freshTripleO(){
  return { chars: [], nextCharId: 1, party: [], draft: freshTripleODraft() };
}
function sanitizeTripleOTrait(t){
  if(!t || typeof t !== "object" || typeof t.text !== "string" || !t.text.trim()) return null;
  return {
    text: t.text.trim().slice(0, 80),
    status: TRIPLE_O_STATUSES.includes(t.status) ? t.status : "default",
    category: typeof t.category === "string" ? t.category.trim().slice(0, 6) : ""
  };
}
function sanitizeTripleOTraits(arr){
  return (Array.isArray(arr) ? arr.map(sanitizeTripleOTrait).filter(Boolean) : []).slice(0, TRIPLE_O_MAX_TRAITS);
}
function sanitizeTripleO(raw){
  const base = freshTripleO();
  if(!raw || typeof raw !== "object") return base;
  const chars = (Array.isArray(raw.chars) ? raw.chars : [])
    .filter(c => c && typeof c === "object")
    .map(c => {
      const id = Number(c.id);
      return {
        id: Number.isFinite(id) ? Math.round(id) : null,
        name: (typeof c.name === "string" && c.name.trim()) ? c.name.trim().slice(0, 60) : "Unnamed character",
        details: typeof c.details === "string" ? c.details.slice(0, 300) : "",
        traits: sanitizeTripleOTraits(c.traits)
      };
    })
    .slice(0, TRIPLE_O_MAX_CHARS);
  const maxId = reindexById(chars);
  const nextCharId = (Number.isFinite(raw.nextCharId) && raw.nextCharId >= maxId) ? Math.round(raw.nextCharId) : maxId;
  const d = (raw.draft && typeof raw.draft === "object") ? raw.draft : {};
  const str = (v, n) => typeof v === "string" ? v.slice(0, n) : "";
  const mode = TRIPLE_O_MODES.includes(d.mode) ? d.mode : "action";
  const whoId = Number(d.who);
  // `who` is a character id, or null (nobody picked); a Group Action is the whole party
  const who = mode === "group" ? null : (chars.some(c => c.id === whoId) ? whoId : null);
  const draft = {
    mode, who,
    question: str(d.question, 200),
    obvious: str(d.obvious, 200), option: str(d.option, 200), odd: str(d.odd, 200),
    doubleDown: !!d.doubleDown
  };
  return { chars, nextCharId, party: sanitizeTripleOTraits(raw.party), draft };
}

// Random Inspiration Source list (Game Master tab, Discover Meaning). A
// user-editable weighted list — "Roll" picks one entry weighted by `weight`.
function freshInspirationEntries(){
  return [
    { label: "Random Map", weight: 1 },
    { label: "Random Sourcebook", weight: 1 },
    { label: "Random book", weight: 1 },
    { label: "Dream", weight: 1 },
    { label: "Diary", weight: 1 }
  ];
}
function freshGm(){
  return { inspiration: { enabled: false, entries: freshInspirationEntries() } };
}
function sanitizeGm(raw){
  const g = (raw && typeof raw === "object") ? raw : {};
  const insp = (g.inspiration && typeof g.inspiration === "object") ? g.inspiration : {};
  let entries = Array.isArray(insp.entries)
    ? insp.entries
        .filter(e => e && typeof e === "object" && typeof e.label === "string" && e.label.trim())
        .map(e => ({
          label: e.label.trim().slice(0, 60),
          weight: Number.isFinite(e.weight) ? Math.max(1, Math.min(100, Math.round(e.weight))) : 1
        }))
    : [];
  if(!entries.length) entries = freshInspirationEntries();
  const enabled = typeof insp.enabled === "boolean" ? insp.enabled : false;
  return { inspiration: { enabled, entries } };
}

// 3-Act Story Structure tab (Mythic Magazine #42). Shares chaosFactor/scene/
// lists/eventFocusTable with the Mythic GME tab; its own state tracks the
// protected Story Thread and progress through the Act 1/2/3 "outer" (Story
// Beat) and "inner" (no-beat / Act Event) circle tracks from the worksheet.
// Threads / Characters Lists: an entry may appear at most LIST_MAX_REPEAT
// times (Mythic GME 2e, Scenes: "up to a maximum of 3 repeated times in a
// List"). Keeps the first copies, in order.
const LIST_MAX_REPEAT = 3;
function capListRepeats(list){
  const seen = new Map();
  return list.filter(s => { const n = (seen.get(s) || 0) + 1; seen.set(s, n); return n <= LIST_MAX_REPEAT; });
}

// Outer track size per Act on the worksheet (the last circle is red and ends
// the Act): Act 2 has one circle more than Acts 1 and 3.
const THREE_ACT_OUTER_MAX = [4, 5, 4];
function freshThreeAct(){
  return {
    storyThread: "",
    act: 1,                 // 1 | 2 | 3
    phase: "acts",           // "acts" | "resolution" | "closing" | "done"
    outer: [0, 0, 0],        // Story Beat marks per act, 0..THREE_ACT_OUTER_MAX[act] (the last ends the Act)
    inner: [0, 0, 0],        // no-beat marks per act (uncapped; cycles the Act Event list)
    npcIntroduced: false,    // Act 1 "Introduce Important NPCs" achieved at least once
    pcProtected: false       // house rule (Mythic Mag #42 p.24): PC can't be removed
  };
}
function sanitizeThreeAct(raw){
  const base = freshThreeAct();
  if(!raw || typeof raw !== "object") return base;
  const act = [1, 2, 3].includes(raw.act) ? raw.act : 1;
  const phase = ["acts", "resolution", "closing", "done"].includes(raw.phase) ? raw.phase : "acts";
  const clampOuter = arr => Array.isArray(arr)
    ? [0, 1, 2].map(i => Number.isFinite(arr[i]) ? Math.max(0, Math.min(THREE_ACT_OUTER_MAX[i], Math.round(arr[i]))) : 0)
    : [0, 0, 0];
  const clampPos = arr => Array.isArray(arr)
    ? [0, 1, 2].map(i => Number.isFinite(arr[i]) ? Math.max(0, Math.round(arr[i])) : 0)
    : [0, 0, 0];
  return {
    storyThread: typeof raw.storyThread === "string" ? raw.storyThread : "",
    act, phase,
    outer: clampOuter(raw.outer),
    inner: clampPos(raw.inner),
    npcIntroduced: !!raw.npcIntroduced,
    pcProtected: !!raw.pcProtected
  };
}

// Node Based Narratives tab (Mythic Magazine #71). A Node Sheet replaces the
// Threads/Characters Lists: Scene, Event, Thread and Character Nodes, each
// with 8 numbered Connection points (1 = top right, then clockwise), joined
// by Connections. Shares chaosFactor/scene/expectedScene with the Mythic GME
// tab. `cell` is the Node's box on the sheet grid (4 columns, 32 per sheet).
const NODE_TYPES = ["scene", "event", "thread", "character"];
const NODE_SLOTS = 8;
const NODE_FOCUS_MODES = ["node", "campaign"];
function freshNodeSheet(){
  return {
    title: "",               // Adventure Name
    nodes: [],               // [{id, type, text, scene:int|null, cell, eliminated}]
    links: [],               // Connections: [{a, as, b, bs}] — Node ids and their points (1-8)
    nextId: 1,
    dynamicDie: false,       // optional rule: Node movement die by Scene number
    randomSlots: false,      // optional rule: roll d8 for the point a new Connection uses
    alteredInfluence: true,  // an Altered Scene rolls an Influence Node (else Scene Adjustment)
    focusMode: "node"        // "node" = Node Random Event Focus Table, "campaign" = the editable table
  };
}
// Thread and Character Nodes only Connect to Scene and Event Nodes.
function nodeCanConnect(typeA, typeB){
  const container = t => t === "scene" || t === "event";
  return container(typeA) || container(typeB);
}
function sanitizeNodeSheet(raw){
  const base = freshNodeSheet();
  if(!raw || typeof raw !== "object") return base;
  const nodes = (Array.isArray(raw.nodes) ? raw.nodes : [])
    .filter(n => n && typeof n === "object" && NODE_TYPES.includes(n.type))
    .map(n => {
      const id = Number(n.id);
      const scene = Number(n.scene);
      const cell = Number(n.cell);
      return {
        id: Number.isFinite(id) ? id : null,
        type: n.type,
        text: typeof n.text === "string" ? n.text.slice(0, 200) : "",
        scene: n.type === "scene" ? (Number.isFinite(scene) && scene >= 1 ? Math.round(scene) : 1) : null,
        cell: Number.isFinite(cell) && cell >= 0 ? Math.round(cell) : null,
        eliminated: (n.type === "thread" || n.type === "character") && !!n.eliminated
      };
    });
  const maxId = reindexById(nodes);
  // one Node per box: a missing or taken cell moves to the first free one
  const used = new Set();
  nodes.forEach(n => { if(n.cell != null && !used.has(n.cell)) used.add(n.cell); else n.cell = null; });
  let free = 0;
  nodes.forEach(n => { if(n.cell == null){ while(used.has(free)) free++; n.cell = free; used.add(free); } });

  const byId = new Map(nodes.map(n => [n.id, n]));
  const slotOk = s => Number.isInteger(s) && s >= 1 && s <= NODE_SLOTS;
  const taken = new Set();   // "id:slot" — a point holds one Connection
  const pairs = new Set();   // "lo-hi" — one Connection per pair of Nodes
  const links = (Array.isArray(raw.links) ? raw.links : []).filter(l => {
    if(!l || typeof l !== "object") return false;
    const a = byId.get(Number(l.a)), b = byId.get(Number(l.b));
    if(!a || !b || a === b || !slotOk(l.as) || !slotOk(l.bs)) return false;
    if(a.eliminated || b.eliminated || !nodeCanConnect(a.type, b.type)) return false;
    const ka = a.id + ":" + l.as, kb = b.id + ":" + l.bs;
    const pair = Math.min(a.id, b.id) + "-" + Math.max(a.id, b.id);
    if(taken.has(ka) || taken.has(kb) || pairs.has(pair)) return false;
    taken.add(ka); taken.add(kb); pairs.add(pair);
    return true;
  }).map(l => ({ a: Number(l.a), as: l.as, b: Number(l.b), bs: l.bs }));

  const nextId = (Number.isFinite(raw.nextId) && raw.nextId >= maxId) ? Math.round(raw.nextId) : maxId;
  return {
    title: typeof raw.title === "string" ? raw.title.slice(0, 120) : "",
    nodes, links, nextId,
    dynamicDie: !!raw.dynamicDie,
    randomSlots: !!raw.randomSlots,
    alteredInfluence: typeof raw.alteredInfluence === "boolean" ? raw.alteredInfluence : true,
    focusMode: NODE_FOCUS_MODES.includes(raw.focusMode) ? raw.focusMode : "node"
  };
}

// The campaign's UI state (04-tab-render-scaffolding.js): the main tab, the
// tab pinned to the split-right pane, and the tabs whose "?" intro is open.
// `at` is when it last changed (ms), so Dropbox sync keeps the newer copy
// without asking (19-dropbox-sync.js ignores `ui` when it compares campaigns).
// Tab ids are checked against TABS in 04 (applyCampaignView()), not here.
function freshUi(){ return { currentTab: 'gme', rightTab: null, intros: [], at: 0 }; }
function sanitizeUi(raw){
  const base = freshUi();
  if(!raw || typeof raw !== "object") return base;
  const id = v => (typeof v === "string" && v && v.length <= 40) ? v : null;
  const currentTab = id(raw.currentTab) || base.currentTab;
  const right = id(raw.rightTab);
  const rightTab = right && right !== currentTab ? right : null;
  const intros = Array.isArray(raw.intros) ? [...new Set(raw.intros.map(id).filter(Boolean))].slice(0, 50) : [];
  const at = Number.isFinite(raw.at) && raw.at > 0 ? Math.round(raw.at) : 0;
  return { currentTab, rightTab, intros, at };
}

// `createdAt` (ms) is null in freshCampaign() and for a campaign from before
// the field existed (it counts as old: no hint text, see 22-init.js).
// newCampaign() is a freshCampaign() made now, for every campaign the app creates.
function newCampaign(){ return Object.assign(freshCampaign(), { createdAt: Date.now() }); }
function freshCampaign(){
  return {
    location: { pp:0, regionSize:"Average", areaCount:0, complete:false, ppSetupDone:false },
    adventure: { mainTheme:null },
    mystery: { boxes:[], nextUid:1, solvedBoxUid:null },
    playerEmu: freshPlayerEmu(),
    tripleO: freshTripleO(),   // Triple-O tab: Trait Sheets, party Traits, the Check being set up
    gm: freshGm(),
    gme: {
      chaosFactor: 5,          // Mythic GME 2e default; range 1-9
      sceneNumber: 1,
      expectedScene: "",
      threads: [],             // Threads List — plain strings, duplicates allowed (weighting)
      characters: [],          // Characters List — same
      tracks: [],              // Thread Progress Tracks (see sanitizeTrack)
      nextTrackId: 1,
      eventFocusTable: defaultEventFocus(),  // editable Random Event Focus Table
      deconstructed: freshDeconstructed(),   // "Published Adventures" tab (shares chaosFactor/scene/lists/focus above)
      threeAct: freshThreeAct(),             // "3-Act Story" tab (shares threads/characters above)
      nodeSheet: freshNodeSheet(),           // "Node Narratives" tab (shares chaosFactor/scene above)
      fateMethod: 'chart'                    // Fate Questions: 'chart' (Fate Chart, 1d100) or 'check' (Fate Check, 2d10)
    },
    tables: {},              // the campaign's own copy of each edited random table (RANDOM_TABLES in 01)
    log: [],
    createdAt: null,
    ui: freshUi()
  };
}

// Defensively rebuilds a campaign object from arbitrary (e.g. imported) data,
// filling in anything missing/malformed from a fresh default so a bad file
// can never crash the app or leave the data model in an inconsistent state.
function sanitizeBox(b){
  if(!b || typeof b!=="object") return null;
  const uid = Number(b.uid);
  if(!Number.isFinite(uid)) return null;
  const type = (b.type==='C' || b.type==='S') ? b.type : 'C';
  const label = (typeof b.label==='string' && b.label.trim()) ? b.label : 'Unnamed';
  const connections = Array.isArray(b.connections) ? b.connections.map(Number).filter(Number.isFinite) : [];
  return { uid, type, label, connections };
}
function sanitizeTrack(t){
  if(!t || typeof t !== "object") return null;
  const size = TRACK_SIZES.includes(t.size) ? t.size : 10;
  const focus = (typeof t.focus === "string" && t.focus.trim()) ? t.focus.trim() : "Untitled Thread";
  const points = Number.isFinite(t.points) ? Math.max(0, Math.min(size, Math.round(t.points))) : 0;
  const need = trackFlashphases(size);
  const flashpoints = (Array.isArray(t.flashpoints) ? t.flashpoints.slice(0, need).map(Boolean) : []);
  while(flashpoints.length < need) flashpoints.push(false);
  const id = Number(t.id);
  return {
    id: Number.isFinite(id) ? id : null,
    focus, size, points, flashpoints,
    concluded: !!t.concluded || points >= size,
    collapsed: !!t.collapsed
  };
}

function sanitizeDeconstructed(raw){
  const d = (raw && typeof raw === "object") ? raw : {};
  const base = freshDeconstructed();
  const posInt = (v, dflt) => (Number.isFinite(v) && v >= 0) ? Math.round(v) : dflt;
  const out = {
    title: typeof d.title === "string" ? d.title : "",
    pageCount: posInt(d.pageCount, 0),
    adventureDie: ADVENTURE_DICE.includes(d.adventureDie) ? d.adventureDie : base.adventureDie,
    latestPage: posInt(d.latestPage, 0),
    pageHistory: Array.isArray(d.pageHistory)
      ? d.pageHistory.map(Number).filter(n => Number.isFinite(n) && n >= 0).map(n => Math.round(n)).slice(-500)
      : [],
    firstSceneConcept: typeof d.firstSceneConcept === "string" ? d.firstSceneConcept : "",
    meaningList: Array.isArray(d.meaningList)
      ? d.meaningList.filter(s => typeof s === "string" && s.trim()).map(s => s.trim()).slice(0, 20)
      : [],
    pendingWords: 0,
    crisisPP: posInt(d.crisisPP, 0),
    diminisher: DIMINISHER_VALUES.includes(d.diminisher) ? d.diminisher : base.diminisher
  };
  // never more pending words than free slots left in the 20-word list
  out.pendingWords = Math.min(posInt(d.pendingWords, 0), 20 - out.meaningList.length);
  return out;
}

// campaign().tables: only known keys, each a clean non-empty list that differs
// from the default (a copy equal to the default is dropped).
function sanitizeTables(raw){
  const out = {};
  if(!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  RANDOM_TABLES.forEach(def => {
    const rows = cleanTableRows(raw[def.key]);
    if(rows && !sameTableRows(rows, def.rows)) out[def.key] = rows;
  });
  return out;
}
function sanitizeCampaign(raw){
  const base = freshCampaign();
  if(!raw || typeof raw !== "object") return base;

  const loc = (raw.location && typeof raw.location==="object") ? raw.location : {};
  const location = {
    pp: Number.isFinite(loc.pp) ? loc.pp : base.location.pp,
    regionSize: ["Small","Average","Large"].includes(loc.regionSize) ? loc.regionSize : base.location.regionSize,
    areaCount: Number.isFinite(loc.areaCount) ? Math.max(0, loc.areaCount) : base.location.areaCount,
    complete: !!loc.complete,
    ppSetupDone: !!loc.ppSetupDone
  };

  const adv = (raw.adventure && typeof raw.adventure==="object") ? raw.adventure : {};
  const adventure = { mainTheme: THEMES.includes(adv.mainTheme) ? adv.mainTheme : null };

  const rawMystery = (raw.mystery && typeof raw.mystery==="object") ? raw.mystery : {};
  let boxes = (Array.isArray(rawMystery.boxes) ? rawMystery.boxes.map(sanitizeBox).filter(Boolean) : []);
  // drop duplicate uids, keeping the first occurrence
  const seenUids = new Set();
  boxes = boxes.filter(b=>{ if(seenUids.has(b.uid)) return false; seenUids.add(b.uid); return true; });
  const validUids = new Set(boxes.map(b=>b.uid));
  const byUid = new Map(boxes.map(b=>[b.uid,b]));
  // a connection is only ever valid between one Clue and one Suspect
  boxes.forEach(b=>{
    b.connections = b.connections.filter(u=>{
      if(u===b.uid || !validUids.has(u)) return false;
      const other = byUid.get(u);
      return other && other.type !== b.type;
    });
  });
  // keep connections symmetric even if the source file wasn't
  boxes.forEach(b=>{
    b.connections.forEach(u=>{
      const other = byUid.get(u);
      if(other && !other.connections.includes(b.uid)) other.connections.push(b.uid);
    });
  });
  const maxUid = boxes.reduce((mx,b)=>Math.max(mx,b.uid), 0);
  const nextUid = (Number.isFinite(rawMystery.nextUid) && rawMystery.nextUid > maxUid) ? rawMystery.nextUid : maxUid+1;
  const solvedBoxUid = (rawMystery.solvedBoxUid!=null && validUids.has(Number(rawMystery.solvedBoxUid))) ? Number(rawMystery.solvedBoxUid) : null;
  const mystery = { boxes, nextUid, solvedBoxUid };

  const playerEmu = sanitizePlayerEmu(raw.playerEmu);
  const tripleO = sanitizeTripleO(raw.tripleO);

  const gm = sanitizeGm(raw.gm);

  // --- Mythic GME (full Mythic 2e) tab -------------------------------------
  const rawGme = (raw.gme && typeof raw.gme === "object") ? raw.gme : {};
  const cf = Number(rawGme.chaosFactor);
  const chaosFactor = Number.isFinite(cf) ? Math.max(1, Math.min(9, Math.round(cf))) : base.gme.chaosFactor;
  const sceneNumber = (Number.isFinite(rawGme.sceneNumber) && rawGme.sceneNumber >= 1) ? Math.round(rawGme.sceneNumber) : 1;
  const expectedScene = typeof rawGme.expectedScene === "string" ? rawGme.expectedScene : "";
  const cleanList = arr => capListRepeats(Array.isArray(arr) ? arr.filter(s => typeof s === "string" && s.trim()).map(s => s.trim()) : []);
  const threads = cleanList(rawGme.threads);
  const characters = cleanList(rawGme.characters);
  let tracks = Array.isArray(rawGme.tracks) ? rawGme.tracks.map(sanitizeTrack).filter(Boolean) : [];
  // dedupe / backfill track ids, then force nextTrackId above the highest one
  const seenTrackIds = new Set();
  let maxTrackId = 0;
  tracks.forEach(t=>{
    if(t.id != null && !seenTrackIds.has(t.id)){ seenTrackIds.add(t.id); maxTrackId = Math.max(maxTrackId, t.id); }
    else t.id = null;
  });
  tracks.forEach(t=>{ if(t.id == null){ t.id = ++maxTrackId; seenTrackIds.add(t.id); } });
  const nextTrackId = (Number.isFinite(rawGme.nextTrackId) && rawGme.nextTrackId > maxTrackId) ? Math.round(rawGme.nextTrackId) : maxTrackId + 1;

  // editable Random Event Focus Table — drop junk rows, clamp maxes to 1-100,
  // sort by range; an empty result falls back to the built-in default
  let eventFocusTable = Array.isArray(rawGme.eventFocusTable)
    ? rawGme.eventFocusTable
        .filter(r => r && typeof r === "object")
        .map(r => ({
          max: Math.max(1, Math.min(100, Math.round(Number(r.max)))),
          result: (typeof r.result === "string" && r.result.trim()) ? r.result.trim() : "(unnamed)"
        }))
        .filter(r => Number.isFinite(r.max))
        .sort((a, b) => a.max - b.max)
    : [];
  if(!eventFocusTable.length) eventFocusTable = defaultEventFocus();

  const deconstructed = sanitizeDeconstructed(rawGme.deconstructed);
  const threeAct = sanitizeThreeAct(rawGme.threeAct);
  const nodeSheet = sanitizeNodeSheet(rawGme.nodeSheet);

  const fateMethod = rawGme.fateMethod === 'check' ? 'check' : 'chart';

  const gme = { chaosFactor, sceneNumber, expectedScene, threads, characters, tracks, nextTrackId, eventFocusTable, deconstructed, threeAct, nodeSheet, fateMethod };

  const log = Array.isArray(raw.log) ? raw.log
    .filter(e=>e && typeof e==="object")
    .map(e=>({ ts: String(e.ts||""), section: String(e.section||""), md: String(e.md||"") })) : [];

  const tables = sanitizeTables(raw.tables);

  const createdAt = Number.isFinite(raw.createdAt) && raw.createdAt > 0 ? Math.round(raw.createdAt) : null;
  const ui = sanitizeUi(raw.ui);

  return { location, adventure, mystery, playerEmu, tripleO, gm, gme, tables, log, createdAt, ui };
}

function loadStore(){
  let raw;
  try{ raw = sessionStorage.getItem(STORAGE_KEY); }catch(e){ raw=null; }
  if(!raw){
    const store = { campaigns:{ "Campaign 1": newCampaign() }, current:"Campaign 1" };
    saveStore(store);
    return store;
  }
  try{
    const parsed = JSON.parse(raw);
    if(!parsed.campaigns || !Object.keys(parsed.campaigns).length){
      throw new Error("empty");
    }
    return parsed;
  }catch(e){
    const store = { campaigns:{ "Campaign 1": newCampaign() }, current:"Campaign 1" };
    saveStore(store);
    return store;
  }
}
// Returns false when the browser refuses (storage full, blocked storage).
function saveStore(store){
  try{ sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }catch(e){ console.warn("Could not persist to sessionStorage", e); return false; }
  return true;
}

let STORE = loadStore();
function campaign(){ return STORE.campaigns[STORE.current]; }
// A successful save also queues a Dropbox upload when sync is on
// (19-dropbox-sync.js, which loads later — a no-op otherwise).
function persist(){
  if(saveStore(STORE) && typeof dropboxNoteSave === "function") dropboxNoteSave();
}

function addLog(section, md){
  campaign().log.push({ ts: timestamp(), section, md });
  persist();
  renderLogSection();
}

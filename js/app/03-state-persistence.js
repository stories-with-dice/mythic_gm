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
function freshThreeAct(){
  return {
    storyThread: "",
    act: 1,                 // 1 | 2 | 3
    phase: "acts",           // "acts" | "resolution" | "closing" | "done"
    outer: [0, 0, 0],        // Story Beat marks per act, 0-4 (the 4th ends the Act)
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
  const clamp4 = arr => Array.isArray(arr)
    ? [0, 1, 2].map(i => Number.isFinite(arr[i]) ? Math.max(0, Math.min(4, Math.round(arr[i]))) : 0)
    : [0, 0, 0];
  const clampPos = arr => Array.isArray(arr)
    ? [0, 1, 2].map(i => Number.isFinite(arr[i]) ? Math.max(0, Math.round(arr[i])) : 0)
    : [0, 0, 0];
  return {
    storyThread: typeof raw.storyThread === "string" ? raw.storyThread : "",
    act, phase,
    outer: clamp4(raw.outer),
    inner: clampPos(raw.inner),
    npcIntroduced: !!raw.npcIntroduced,
    pcProtected: !!raw.pcProtected
  };
}

function freshCampaign(){
  return {
    location: { pp:0, regionSize:"Average", areaCount:0, complete:false, ppSetupDone:false },
    adventure: { mainTheme:null },
    mystery: { boxes:[], nextUid:1, solvedBoxUid:null },
    playerEmu: freshPlayerEmu(),
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
      threeAct: freshThreeAct()              // "3-Act Story" tab (shares threads/characters above)
    },
    log: []
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

  const gm = sanitizeGm(raw.gm);

  // --- Mythic GME (full Mythic 2e) tab -------------------------------------
  const rawGme = (raw.gme && typeof raw.gme === "object") ? raw.gme : {};
  const cf = Number(rawGme.chaosFactor);
  const chaosFactor = Number.isFinite(cf) ? Math.max(1, Math.min(9, Math.round(cf))) : base.gme.chaosFactor;
  const sceneNumber = (Number.isFinite(rawGme.sceneNumber) && rawGme.sceneNumber >= 1) ? Math.round(rawGme.sceneNumber) : 1;
  const expectedScene = typeof rawGme.expectedScene === "string" ? rawGme.expectedScene : "";
  const cleanList = arr => Array.isArray(arr) ? arr.filter(s => typeof s === "string" && s.trim()).map(s => s.trim()) : [];
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

  const gme = { chaosFactor, sceneNumber, expectedScene, threads, characters, tracks, nextTrackId, eventFocusTable, deconstructed, threeAct };

  const log = Array.isArray(raw.log) ? raw.log
    .filter(e=>e && typeof e==="object")
    .map(e=>({ ts: String(e.ts||""), section: String(e.section||""), md: String(e.md||"") })) : [];

  return { location, adventure, mystery, playerEmu, gm, gme, log };
}

function loadStore(){
  let raw;
  try{ raw = sessionStorage.getItem(STORAGE_KEY); }catch(e){ raw=null; }
  if(!raw){
    const store = { campaigns:{ "Campaign 1": freshCampaign() }, current:"Campaign 1" };
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
    const store = { campaigns:{ "Campaign 1": freshCampaign() }, current:"Campaign 1" };
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

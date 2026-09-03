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
    crisisPP: 0,             // Crisis Scene Progress Points
    diminisher: "1/3"
  };
}

function freshCampaign(){
  return {
    location: { pp:0, regionSize:"Average", areaCount:0, complete:false, ppSetupDone:false },
    adventure: { mainTheme:null },
    mystery: { boxes:[], nextUid:1, solvedBoxUid:null },
    gme: {
      chaosFactor: 5,          // Mythic GME 2e default; range 1-9
      sceneNumber: 1,
      expectedScene: "",
      threads: [],             // Threads List — plain strings, duplicates allowed (weighting)
      characters: [],          // Characters List — same
      tracks: [],              // Thread Progress Tracks (see sanitizeTrack)
      nextTrackId: 1,
      eventFocusTable: defaultEventFocus(),  // editable Random Event Focus Table
      deconstructed: freshDeconstructed()    // "Published Adventures" tab (shares chaosFactor/scene/lists/focus above)
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
  return {
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
    crisisPP: posInt(d.crisisPP, 0),
    diminisher: DIMINISHER_VALUES.includes(d.diminisher) ? d.diminisher : base.diminisher
  };
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

  const gme = { chaosFactor, sceneNumber, expectedScene, threads, characters, tracks, nextTrackId, eventFocusTable, deconstructed };

  const log = Array.isArray(raw.log) ? raw.log
    .filter(e=>e && typeof e==="object")
    .map(e=>({ ts: String(e.ts||""), section: String(e.section||""), md: String(e.md||"") })) : [];

  return { location, adventure, mystery, gme, log };
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
function saveStore(store){
  try{ sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }catch(e){ console.warn("Could not persist to sessionStorage", e); }
}

let STORE = loadStore();
function campaign(){ return STORE.campaigns[STORE.current]; }
function persist(){ saveStore(STORE); }

function addLog(section, md){
  campaign().log.push({ ts: timestamp(), section, md });
  persist();
  renderLogSection();
}

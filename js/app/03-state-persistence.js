/* =========================================================================
   STATE / PERSISTENCE  (sessionStorage, keyed by campaign)
   ========================================================================= */
const STORAGE_KEY = "mythicToolkit_v1";

function freshCampaign(){
  return {
    location: { pp:0, regionSize:"Average", areaCount:0, complete:false, ppSetupDone:false },
    adventure: { mainTheme:null },
    mystery: { boxes:[], nextUid:1, solvedBoxUid:null },
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

  const log = Array.isArray(raw.log) ? raw.log
    .filter(e=>e && typeof e==="object")
    .map(e=>({ ts: String(e.ts||""), section: String(e.section||""), md: String(e.md||"") })) : [];

  return { location, adventure, mystery, log };
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

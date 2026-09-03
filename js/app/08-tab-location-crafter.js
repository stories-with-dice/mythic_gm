/* =========================================================================
   TAB: LOCATION CRAFTER
   ========================================================================= */
const REGION_START_PP = { "Small":3, "Average":0, "Large":-3 };
function renderLocation(){
  const loc = campaign().location;
  return `
  <h2 class="tool-title">One-Page Location Crafter</h2>
  <p class="tool-desc">Explore a Region one Area at a time. Progress Points bias the Area Elements roll — the deeper you explore, the more likely you are to find what you're looking for.</p>

  <div class="card">
    <h3 class="block-title">Region Setup</h3>
    <div class="row">
      <div class="field">
        <label for="regionSize">Region size</label>
        <select id="regionSize" class="field-input">
          <option value="Small" ${loc.regionSize==='Small'?'selected':''}>Small (start PP +3)</option>
          <option value="Average" ${loc.regionSize==='Average'?'selected':''}>Average (start PP 0)</option>
          <option value="Large" ${loc.regionSize==='Large'?'selected':''}>Large (start PP -3)</option>
        </select>
      </div>
      <div class="field"><label>&nbsp;</label><button class="btn danger" id="btnStartRegion">Start New Region</button></div>
    </div>
    <div class="small-note">Starting a new region resets Progress Points, the Area count, and the Complete flag for this campaign.</div>
  </div>

  <div class="card">
    <h3 class="block-title">Current Progress</h3>
    <div class="row" style="gap:26px;">
      <div class="pp-readout"><span class="num">${loc.pp}</span><span class="lbl">Progress Points</span></div>
      <div class="pp-readout"><span class="num">${loc.areaCount}</span><span class="lbl">Areas explored</span></div>
      <div class="row">
        <button class="btn small" id="btnPPminus">PP −1</button>
        <button class="btn small" id="btnPPplus">PP +1</button>
      </div>
    </div>
    ${loc.complete?'<div class="banner-solved">This Region\'s Complete Area has been found — further exploration now always yields Expected Areas.</div>':''}
  </div>

  <div class="card">
    <h3 class="block-title">Explore</h3>
    <div class="row"><button class="btn primary" id="btnExploreArea">Explore New Area</button></div>
    <div id="areaResult" style="margin-top:14px;">${lastAreaResultHtml}</div>
  </div>
  `;
}
let lastAreaResultHtml = '';
function wireLocation(){
  document.getElementById('regionSize').addEventListener('change', e=>{
    campaign().location.regionSize = e.target.value;
    persist();
  });
  document.getElementById('btnStartRegion').addEventListener('click', ()=>{
    if(!confirm("Start a new Region? This resets Progress Points, Area count and Complete status.")) return;
    const loc = campaign().location;
    loc.pp = REGION_START_PP[loc.regionSize];
    loc.areaCount = 0;
    loc.complete = false;
    persist();
    addLog('Location Crafter', `**New Region started** — Size: ${loc.regionSize}, starting PP: ${loc.pp}`);
    renderActive();
  });
  document.getElementById('btnPPminus').addEventListener('click', ()=>{ campaign().location.pp -= 1; persist(); renderActive(); });
  document.getElementById('btnPPplus').addEventListener('click', ()=>{ campaign().location.pp += 1; persist(); renderActive(); });

  document.getElementById('btnExploreArea').addEventListener('click', ()=>{
    const loc = campaign().location;
    const areaNum = loc.areaCount + 1;
    let rolls = [];
    let pp6Triggered = false;
    let completeTriggered = false;
    if(loc.complete){
      rolls = [{el:"Expected"},{el:"Expected"},{el:"Expected"}];
    } else {
      for(let i=0;i<3;i++){
        const d10 = rollDie(10);
        const raw = d10 + loc.pp;
        let result = Object.assign({}, areaElement(raw));
        if(result.el === "Expected, PP-6"){
          if(pp6Triggered){ result = {el:"Expected"}; }
          else { pp6Triggered = true; }
        }
        if(result.el === "Expected, Complete") completeTriggered = true;
        let descriptors = null;
        if(result.d){
          const r1 = rollDie(100), r2 = rollDie(100);
          descriptors = [ {r:r1, w:LOCATION_DESCRIPTORS[r1-1]}, {r:r2, w:LOCATION_DESCRIPTORS[r2-1]} ];
        }
        rolls.push({ d10, raw, el: result.el, descType: result.d, descriptors });
      }
    }
    loc.areaCount = areaNum;
    let ppNote = "";
    if(!loc.complete){
      if(pp6Triggered){ loc.pp -= 6; ppNote = "Progress Points reduced by 6 (Expected, PP-6)."; }
      else { loc.pp += 1; ppNote = "Progress Points increased by 1."; }
    }
    if(completeTriggered) loc.complete = true;
    persist();

    const html = rolls.map(r=>{
      let extra = '';
      if(r.descriptors) extra = `<div class="small-note">Descriptors (${r.descType}): <b>${r.descriptors[0].w}</b> (${r.descriptors[0].r}), <b>${r.descriptors[1].w}</b> (${r.descriptors[1].r})</div>`;
      return `<div class="plotpoint"><span class="theme">${r.d10!==undefined?`1d10:${r.d10} + PP → ${r.raw}`:'Region complete — auto result'}</span><div class="word">${r.el}</div>${extra}</div>`;
    }).join('');
    lastAreaResultHtml = `<h3 class="block-title" style="border:none;">Area ${areaNum}</h3>${html}<div class="small-note">${ppNote}</div>${completeTriggered?'<div class="banner-solved">Complete Element found — this is the last interesting Area of the Region!</div>':''}`;
    document.getElementById('areaResult').innerHTML = lastAreaResultHtml;

    const md = `**Area ${areaNum}**\n` + rolls.map((r,i)=>{
      let line = `  - Element ${i+1}: ${r.d10!==undefined?`1d10(${r.d10})+PP → ${r.raw} → `:''}**${r.el}**`;
      if(r.descriptors) line += ` — Descriptors: **${r.descriptors[0].w}**, **${r.descriptors[1].w}**`;
      return line;
    }).join('\n') + `\n  - ${ppNote}` + (completeTriggered? `\n  - 🏁 **Complete Element found** — last interesting Area of the Region.`:'');
    addLog('Location Crafter', md);
    renderActive();
  });
}

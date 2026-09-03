/* =========================================================================
   TAB: CHARACTER CRAFTER
   ========================================================================= */
const CHAR_CATEGORIES = [
  {key:'identity', label:'Identity Descriptor', hint:"This Character's primary role."},
  {key:'mind', label:'Mind Descriptor', hint:"The most notable aspects of their mind."},
  {key:'body', label:'Body Descriptor', hint:"The most notable aspects of their physical prowess or appearance."},
  {key:'talent', label:'Talent Descriptor', hint:"Skills, abilities, or powers."}
];
let charWords = {identity:[], mind:[], body:[], talent:[]};
function renderCharacter(){
  return `
  <h2 class="tool-title">One-Page Character Crafter</h2>
  <p class="tool-desc">Roll Identity, Mind, Body and Talent keywords, then weave them into a one-sentence description of who this NPC is.</p>

  <div class="grid2">
    ${CHAR_CATEGORIES.map(c=>`
      <div class="card">
        <h3 class="block-title">${c.label}</h3>
        <p class="small-note" style="margin-top:-4px;">${c.hint}</p>
        <div class="row"><button class="btn primary btnCharRoll" data-cat="${c.key}">Roll word</button>
          <button class="btn small btnCharMore" data-cat="${c.key}">+ more</button>
          <button class="btn small btnCharClear" data-cat="${c.key}">Clear</button></div>
        <div id="charWords_${c.key}" style="margin-top:10px;"></div>
      </div>
    `).join('')}
  </div>

  <div class="card">
    <h3 class="block-title">NPC Statistics</h3>
    <p class="small-note" style="margin-top:-4px;">Guess the value, then roll to see how it should shift.</p>
    <div class="row"><button class="btn" id="btnNpcStat">Roll 1d10 modifier</button></div>
    <div id="npcStatResult" style="margin-top:10px;"></div>
  </div>

  <div class="card">
    <h3 class="block-title">Behavior Context</h3>
    <p class="small-note" style="margin-top:-4px;">Extra inspiration for what this Character does in a scene.</p>
    <div class="row"><button class="btn" id="btnBehaviorContext">Roll 1d100</button></div>
    <div id="behaviorContextResult" style="margin-top:10px;"></div>
  </div>
  `;
}
function wireCharacter(){
  function renderCat(key){
    const label = CHAR_CATEGORIES.find(c=>c.key===key).label;
    document.getElementById('charWords_'+key).innerHTML = charWords[key].map(w=>`<span class="word-chip"><b>${w}</b></span>`).join(' ') || '<span class="small-note">Nothing rolled yet.</span>';
  }
  document.querySelectorAll('[data-cat]').forEach(btn=>{
    if(btn.classList.contains('btnCharMore')){
      btn.addEventListener('click', ()=>{
        const key = btn.dataset.cat;
        const r = rollDie(100);
        const w = CHARACTER_DESCRIPTORS[r-1];
        charWords[key].push(w);
        renderCat(key);
        addLog('Character Crafter', `**${CHAR_CATEGORIES.find(c=>c.key===key).label}** — extra word, roll ${r} → **${w}**`);
      });
    } else if(btn.classList.contains('btnCharClear')){
      btn.addEventListener('click', ()=>{ charWords[btn.dataset.cat]=[]; renderCat(btn.dataset.cat); });
    } else {
      btn.addEventListener('click', ()=>{
        const key = btn.dataset.cat;
        const r = rollDie(100);
        const w = CHARACTER_DESCRIPTORS[r-1];
        charWords[key] = [w];
        renderCat(key);
        addLog('Character Crafter', `**${CHAR_CATEGORIES.find(c=>c.key===key).label}** — roll ${r} → **${w}**`);
      });
    }
  });
  CHAR_CATEGORIES.forEach(c=>renderCat(c.key));

  document.getElementById('btnNpcStat').addEventListener('click', ()=>{
    const r = rollDie(10);
    const mod = NPC_STAT_MOD[r];
    document.getElementById('npcStatResult').innerHTML = `<div class="result-box"><span class="roll-num">${r}</span> → ${mod}</div>`;
    addLog('Character Crafter', `**NPC Statistic** — Roll 1d10: ${r} → ${mod}`);
  });
  document.getElementById('btnBehaviorContext').addEventListener('click', ()=>{
    const r = rollDie(100);
    const text = behaviorContext(r);
    document.getElementById('behaviorContextResult').innerHTML = `<div class="result-box"><span class="roll-num">${r}</span> → ${text}</div>`;
    addLog('Character Crafter', `**Behavior Context** — Roll 1d100: ${r} → ${text}`);
  });
}

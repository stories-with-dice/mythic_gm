/* =========================================================================
   TAB: CREATURE CRAFTER
   ========================================================================= */
function renderCreature(){
  return `
  <h2 class="tool-title">One-Page Creature Crafter</h2>
  <p class="tool-desc">Roll up what a creature looks like, how it behaves, and what it can do — statted loosely enough to bolt onto any system.</p>

  <div class="grid2">
    <div>
      <div class="card">
        <h3 class="block-title">Features</h3>
        <div class="row"><button class="btn primary" id="btnCreatureDescriptors">Roll 2 descriptor words</button><button class="btn" id="btnCreatureMoreWord">+ one more word</button></div>
        <div id="creatureDescResult" style="margin-top:10px;"></div>
      </div>
      <div class="card">
        <h3 class="block-title">Statistics</h3>
        <p class="small-note" style="margin-top:-4px;">Estimate the stat yourself, then roll to see how it shifts.</p>
        <div class="row"><button class="btn" id="btnCreatureStat">Roll 1d10 modifier</button></div>
        <div id="creatureStatResult" style="margin-top:10px;"></div>
      </div>
    </div>
    <div>
      <div class="card">
        <h3 class="block-title">Behavior</h3>
        <div class="row"><button class="btn primary" id="btnInitialBehavior">Roll Initial Behavior</button></div>
        <div id="initialBehaviorResult" style="margin-top:10px;"></div>
        <div class="divider"></div>
        <div class="row"><button class="btn" id="btnNewBehavior">Roll New Behavior</button></div>
        <div id="newBehaviorResult" style="margin-top:10px;"></div>
      </div>
      <div class="card">
        <h3 class="block-title">Abilities</h3>
        <p class="small-note" style="margin-top:-4px;">Rolled automatically on a 10 from either Behavior table — or roll manually here.</p>
        <div class="row"><button class="btn" id="btnAbility">Roll 2 ability words</button></div>
        <div id="abilityResult" style="margin-top:10px;"></div>
      </div>
    </div>
  </div>
  `;
}
let creatureDescList = [];
function wireCreature(){
  function renderDescList(){
    document.getElementById('creatureDescResult').innerHTML = creatureDescList.map(d=>`<span class="word-chip"><b>${d}</b></span>`).join(' ') || '<span class="small-note">Nothing rolled yet.</span>';
  }
  document.getElementById('btnCreatureDescriptors').addEventListener('click', ()=>{
    const r1=rollDie(100), r2=rollDie(100);
    creatureDescList = [CREATURE_DESCRIPTORS[r1-1], CREATURE_DESCRIPTORS[r2-1]];
    renderDescList();
    addLog('Creature Crafter', `**Creature Features** — Rolls ${r1}, ${r2} → **${creatureDescList[0]}**, **${creatureDescList[1]}**`);
  });
  document.getElementById('btnCreatureMoreWord').addEventListener('click', ()=>{
    const r = rollDie(100);
    const w = CREATURE_DESCRIPTORS[r-1];
    creatureDescList.push(w);
    renderDescList();
    addLog('Creature Crafter', `**Creature Features** — extra word, roll ${r} → **${w}**`);
  });
  renderDescList();

  document.getElementById('btnCreatureStat').addEventListener('click', ()=>{
    const r = rollDie(10);
    const mod = STAT_MOD[r];
    document.getElementById('creatureStatResult').innerHTML = `<div class="result-box"><span class="roll-num">${r}</span> → ${mod}</div>`;
    addLog('Creature Crafter', `**Statistic** — Roll 1d10: ${r} → ${mod}`);
  });

  document.getElementById('btnInitialBehavior').addEventListener('click', ()=>{
    const r = rollDie(10);
    const text = INITIAL_BEHAVIOR[r];
    let html = `<div class="result-box"><span class="roll-num">${r}</span> → ${text}</div>`;
    let md = `**Initial Behavior** — Roll 1d10: ${r} → ${text}`;
    if(r===10){
      const a1=rollDie(100), a2=rollDie(100);
      const w1=abilityWord(a1), w2=abilityWord(a2);
      html += `<div class="small-note">Ability triggered:</div><div class="word-chip"><b>${w1}</b></div><div class="word-chip"><b>${w2}</b></div>`;
      md += `\n  - ⚡ Ability rolled → **${w1} / ${w2}**`;
    }
    document.getElementById('initialBehaviorResult').innerHTML = html;
    addLog('Creature Crafter', md);
  });
  document.getElementById('btnNewBehavior').addEventListener('click', ()=>{
    const r = rollDie(10);
    const text = newBehaviorResult(r);
    let html = `<div class="result-box"><span class="roll-num">${r}</span> → ${text}</div>`;
    let md = `**New Behavior** — Roll 1d10: ${r} → ${text}`;
    if(r===10){
      const a1=rollDie(100), a2=rollDie(100);
      const w1=abilityWord(a1), w2=abilityWord(a2);
      html += `<div class="small-note">Ability triggered:</div><div class="word-chip"><b>${w1}</b></div><div class="word-chip"><b>${w2}</b></div>`;
      md += `\n  - ⚡ Ability rolled → **${w1} / ${w2}**`;
    }
    document.getElementById('newBehaviorResult').innerHTML = html;
    addLog('Creature Crafter', md);
  });
  document.getElementById('btnAbility').addEventListener('click', ()=>{
    const a1=rollDie(100), a2=rollDie(100);
    const w1=abilityWord(a1), w2=abilityWord(a2);
    document.getElementById('abilityResult').innerHTML = `<div class="word-chip"><b>${w1}</b></div><div class="word-chip"><b>${w2}</b></div>`;
    addLog('Creature Crafter', `**Ability** — Rolls ${a1}, ${a2} → **${w1} / ${w2}**`);
  });
}

/* =========================================================================
   TAB: ADVENTURE CRAFTER
   ========================================================================= */
function renderAdventure(){
  const adv = campaign().adventure;
  const themeOptions = THEMES.map(t=>`<option value="${t}">${t}</option>`).join('');
  return `
  <h2 class="tool-title">One-Page Adventure Crafter</h2>
  <p class="tool-desc">Determine a Main Theme once per adventure, then generate Turning Points — five Plot Points whose words you weave into the next twist.</p>

  <div class="card">
    <h3 class="block-title">Main Theme</h3>
    <div class="row">
      <div class="pp-readout"><span class="num" style="font-size:22px;">${adv.mainTheme || '—'}</span><span class="lbl">current main theme</span></div>
    </div>
    <div class="row" style="margin-top:12px;">
      <button class="btn primary" id="btnRollTheme">Roll 1d10 for Theme</button>
      <span class="small-note">or choose directly:</span>
      <select id="manualTheme" class="field-input">${themeOptions}</select>
      <button class="btn" id="btnSetTheme">Set</button>
    </div>
  </div>

  <div class="card">
    <h3 class="block-title">Generate Turning Point</h3>
    <p class="small-note" style="margin-top:-4px;">Plot Point 1 always uses the Main Theme above. Plot Points 2–5 each roll 1d10 for their own theme, then 1d100 for the word.</p>
    <div class="row"><button class="btn primary" id="btnTurningPoint" ${adv.mainTheme?'':'disabled'}>Generate Turning Point (5 Plot Points)</button></div>
    ${adv.mainTheme?'':'<div class="small-note">Set a Main Theme first.</div>'}
    <div id="turningPointResult" style="margin-top:14px;">${lastTurningPointHtml}</div>
  </div>

  <div class="card">
    <h3 class="block-title">Roll a Single Plot Point</h3>
    <div class="row">
      <select id="singleTheme" class="field-input"><option value="">Roll 1d10 for theme</option>${themeOptions}</select>
      <button class="btn" id="btnSinglePlot">Roll</button>
    </div>
    <div id="singlePlotResult" style="margin-top:10px;">${lastSinglePlotHtml}</div>
  </div>
  `;
}
let lastTurningPointHtml = '';
let lastSinglePlotHtml = '';
function wireAdventure(){
  document.getElementById('btnRollTheme').addEventListener('click', ()=>{
    const d10 = rollDie(10);
    const theme = themeFromD10(d10);
    campaign().adventure.mainTheme = theme;
    persist();
    addLog('Adventure Crafter', `**Main Theme** — Roll 1d10: ${d10} → **${theme}**`);
    renderActive();
  });
  document.getElementById('btnSetTheme').addEventListener('click', ()=>{
    const theme = document.getElementById('manualTheme').value;
    campaign().adventure.mainTheme = theme;
    persist();
    addLog('Adventure Crafter', `**Main Theme** set manually → **${theme}**`);
    renderActive();
  });
  document.getElementById('btnTurningPoint').addEventListener('click', ()=>{
    const adv = campaign().adventure;
    const points = [];
    for(let i=0;i<5;i++){
      let theme, themeIdx, d10=null;
      if(i===0){ theme = adv.mainTheme; themeIdx = THEMES.indexOf(theme); }
      else { d10 = rollDie(10); theme = themeFromD10(d10); themeIdx = THEMES.indexOf(theme); }
      const d100 = rollDie(100);
      const word = plotPointWord(themeIdx, d100);
      points.push({n:i+1, theme, d10, d100, word});
    }
    lastTurningPointHtml = points.map(p=>`
      <div class="plotpoint"><span class="theme">Plot Point ${p.n} — ${p.theme}${p.d10?` (1d10: ${p.d10})`:' (Main Theme)'} — 1d100: ${p.d100}</span><div class="word">${p.word}</div></div>
    `).join('');
    document.getElementById('turningPointResult').innerHTML = lastTurningPointHtml;
    const md = `**Turning Point** —\n` + points.map(p=>`  - PP${p.n} [${p.theme}${p.d10?`, 1d10:${p.d10}`:''}, 1d100:${p.d100}] → **${p.word}**`).join('\n');
    addLog('Adventure Crafter', md);
  });
  document.getElementById('btnSinglePlot').addEventListener('click', ()=>{
    const chosen = document.getElementById('singleTheme').value;
    let theme, themeIdx, d10=null;
    if(chosen){ theme=chosen; themeIdx=THEMES.indexOf(theme); }
    else { d10 = rollDie(10); theme = themeFromD10(d10); themeIdx = THEMES.indexOf(theme); }
    const d100 = rollDie(100);
    const word = plotPointWord(themeIdx, d100);
    lastSinglePlotHtml = `<div class="plotpoint"><span class="theme">${theme}${d10?` (1d10: ${d10})`:''} — 1d100: ${d100}</span><div class="word">${word}</div></div>`;
    document.getElementById('singlePlotResult').innerHTML = lastSinglePlotHtml;
    addLog('Adventure Crafter', `**Plot Point** [${theme}${d10?`, 1d10:${d10}`:''}, 1d100:${d100}] → **${word}**`);
  });
}

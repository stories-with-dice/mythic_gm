/* =========================================================================
   TAB: GAME MASTER  (Ask the GM / Discover Meaning / Random Events)
   ========================================================================= */
function renderGM(){
  const oddsOptions = Object.keys(ASK_ODDS).map(k=>`<option value="${k}" ${k==='50/50 or Unknown'?'selected':''}>${k}</option>`).join('');
  return `
  <h2 class="tool-title">One-Page Game Master Emulator</h2>
  <p class="tool-desc">Ask yes/no questions and let the odds decide, or roll up an evocative word pair when you need inspiration rather than a verdict.</p>

  <div class="card">
    <h3 class="block-title">Ask the Game Master</h3>
    <div class="row">
      <div class="field" style="flex:2; min-width:220px;">
        <label for="gmQuestion">Your question (optional, for the log)</label>
        <input type="text" id="gmQuestion" class="field-input" style="width:100%" placeholder="Does the guard notice me?">
      </div>
      <div class="field">
        <label for="gmOdds">Odds</label>
        <select id="gmOdds" class="field-input">${oddsOptions}</select>
      </div>
      <div class="field"><label>&nbsp;</label><button class="btn primary" id="btnAskGM">Roll 1d100</button></div>
    </div>
    <div id="gmResult"></div>
  </div>

  <div class="card">
    <h3 class="block-title">Discover Meaning</h3>
    <p class="small-note" style="margin-top:-4px;">Roll a word (or both) from the Action / Description columns for inspiration. Roll again if the first word isn't enough.</p>
    <div class="row">
      <button class="btn" id="btnRollAction">Roll Action word</button>
      <button class="btn" id="btnRollDesc">Roll Description word</button>
      <button class="btn primary" id="btnRollBoth">Roll both</button>
      <button class="btn" id="btnClearWords">Clear</button>
    </div>
    <div id="discoverWords" style="margin-top:12px;"></div>

    <div class="divider"></div>
    ${renderInspirationSection()}
  </div>

  <div class="card">
    <h3 class="block-title">Random Events</h3>
    <p class="small-note" style="margin-top:-4px;">Rolling a double on Ask the GM (11, 22, 33…) triggers one of these automatically. You can also generate one on demand.</p>
    <div class="row"><button class="btn" id="btnRandomEvent">Generate Random Event</button></div>
    <div id="eventResult"></div>
  </div>
  `;
}
let gmWordLog = []; // transient list of discover-meaning words rolled this session (per-tab view only)
let gmInspEditorOpen = false; // Random Inspiration Source list editor collapsed by default
let lastInspirationHtml = ''; // cached so an unrelated renderActive() doesn't wipe it

// Weighted pick from the Random Inspiration Source list: 1..totalWeight, walk
// the cumulative bands in list order (order is otherwise insignificant).
function rollInspirationSource(entries){
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  const roll = rollDie(Math.max(1, total));
  let acc = 0;
  for(const e of entries){
    acc += e.weight;
    if(roll <= acc) return { roll, total, entry: e };
  }
  return { roll, total, entry: entries[entries.length - 1] };
}

function renderInspirationSection(){
  const insp = campaign().gm.inspiration;
  const rows = insp.entries.map((e, i) => `
    <tr>
      <td><input type="text" data-insp-label="${i}" class="field-input" value="${escapeAttr(e.label)}"></td>
      <td class="weight"><input type="number" min="1" max="100" data-insp-weight="${i}" class="field-input" value="${e.weight}"></td>
      <td><button class="btn small danger" data-insp-rm="${i}" ${insp.entries.length <= 1 ? 'disabled' : ''}>&#10005;</button></td>
    </tr>`).join('');

  return `
  <label class="row" style="align-items:center; gap:8px; cursor:pointer;">
    <input type="checkbox" id="gmInspEnabled" ${insp.enabled ? 'checked' : ''}>
    <span>Random Inspiration Source</span>
  </label>
  ${insp.enabled ? `
    <p class="small-note" style="margin-top:4px;">Roll for where a piece of random inspiration comes from. Weight an entry higher to make it more likely.</p>
    <div class="row">
      <button class="btn primary" id="btnRollInspiration" ${insp.entries.length ? '' : 'disabled'}>Roll Inspiration Source</button>
      <button class="btn small" id="btnGmInspEditToggle">${gmInspEditorOpen ? 'Done' : 'Edit list'}</button>
    </div>
    <div id="inspirationResult" style="margin-top:10px;">${lastInspirationHtml}</div>
    ${gmInspEditorOpen ? `
    <div style="overflow-x:auto;">
      <table class="gm-insp-table">
        <thead><tr><th>Source</th><th>Weight</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="row" style="margin-top:10px;">
      <button class="btn small" id="btnGmInspAdd">Add entry</button>
      <button class="btn small" id="btnGmInspReset">Reset to default</button>
    </div>
    ` : ''}
  ` : ''}`;
}

// Roll a Random Event's inspiration words: a Discover Meaning Action + Description
// pair. Shared so other tabs (e.g. Mythic GME's Interrupt Scene) generate a
// Random Event exactly the way the Game Master tab does.
function randomEventWords(){
  const ra = rollDie(100), rd = rollDie(100);
  return { a:{ roll:ra, word:discoverWord(ra,'action') }, d:{ roll:rd, word:discoverWord(rd,'desc') } };
}

function wireGM(){
  document.getElementById('btnAskGM').addEventListener('click', ()=>{
    const q = document.getElementById('gmQuestion').value.trim();
    const odds = document.getElementById('gmOdds').value;
    const roll = rollDie(100);
    const {answer, isDouble} = askTheGM(odds, roll);
    const cls = answer.includes('No') ? 'no' : '';
    let html = `<div class="result-box ${cls}">
      <span class="roll-num">${roll}</span> &nbsp; Odds: <b>${odds}</b> &nbsp;→&nbsp; <span class="answer-tag ${cls?'no':'yes'}">${answer}</span>`;
    let md = `**Ask the GM** — ${q?('"'+escapeMd(q)+'" — '):''}Odds: ${odds} — Roll: **${roll}** → **${answer}**`;
    if(isDouble){
      const ev = randomEventWords();
      html += `<div class="small-note">Double rolled — Random Event triggered!</div>
        <div class="word-chip"><b>${ev.a.word}</b></div><div class="word-chip"><b>${ev.d.word}</b></div>`;
      md += `\n  - 🎲 *Random Event triggered (double roll)* → Discover Meaning: **${ev.a.word} / ${ev.d.word}**`;
    }
    html += `</div>`;
    document.getElementById('gmResult').innerHTML = html;
    addLog('Ask the GM', md);
  });

  function showWord(kind){
    const roll = rollDie(100);
    const word = discoverWord(roll, kind);
    gmWordLog.push({kind,roll,word});
    renderWordLog();
    addLog('Discover Meaning', `**Discover Meaning** (${kind==='action'?'Action':'Description'}) — Roll: ${roll} → **${word}**`);
  }
  function renderWordLog(){
    document.getElementById('discoverWords').innerHTML = gmWordLog.map(w=>`<span class="word-chip">${w.kind==='action'?'Action':'Desc'} ${w.roll}: <b>${w.word}</b></span>`).join(' ') || '<span class="small-note">No words rolled yet.</span>';
  }
  document.getElementById('btnRollAction').addEventListener('click', ()=>showWord('action'));
  document.getElementById('btnRollDesc').addEventListener('click', ()=>showWord('desc'));
  document.getElementById('btnRollBoth').addEventListener('click', ()=>{ showWord('action'); showWord('desc'); });
  document.getElementById('btnClearWords').addEventListener('click', ()=>{ gmWordLog=[]; renderWordLog(); });
  renderWordLog();

  document.getElementById('btnRandomEvent').addEventListener('click', ()=>{
    const ev = randomEventWords();
    document.getElementById('eventResult').innerHTML = `<div class="result-box event"><div class="word-chip"><b>${ev.a.word}</b></div><div class="word-chip"><b>${ev.d.word}</b></div></div>`;
    addLog('Random Event', `**Random Event** → Discover Meaning: **${ev.a.word} / ${ev.d.word}**`);
  });

  /* ----- Random Inspiration Source (Discover Meaning) ----- */
  document.getElementById('gmInspEnabled').addEventListener('change', (e)=>{
    campaign().gm.inspiration.enabled = e.target.checked;
    persist();
    renderActive();
  });

  const inspRoll = document.getElementById('btnRollInspiration');
  if(inspRoll) inspRoll.addEventListener('click', ()=>{
    const res = rollInspirationSource(campaign().gm.inspiration.entries);
    lastInspirationHtml = `<div class="result-box"><span class="roll-num">${res.roll}</span> of ${res.total} &nbsp;→&nbsp; <b>${escapeAttr(res.entry.label)}</b></div>`;
    document.getElementById('inspirationResult').innerHTML = lastInspirationHtml;
    addLog('Random Inspiration Source', `**Random Inspiration Source** — Roll: ${res.roll} of ${res.total} → **${escapeMd(res.entry.label)}**`);
  });

  const inspEditToggle = document.getElementById('btnGmInspEditToggle');
  if(inspEditToggle) inspEditToggle.addEventListener('click', ()=>{
    gmInspEditorOpen = !gmInspEditorOpen;
    renderActive();
  });

  document.querySelectorAll('[data-insp-label]').forEach(el=> el.addEventListener('change', ()=>{
    const i = Number(el.dataset.inspLabel);
    const entries = campaign().gm.inspiration.entries;
    entries[i].label = el.value.trim() || entries[i].label;
    persist();
  }));
  document.querySelectorAll('[data-insp-weight]').forEach(el=> el.addEventListener('change', ()=>{
    const i = Number(el.dataset.inspWeight);
    const entries = campaign().gm.inspiration.entries;
    let v = Math.round(Number(el.value));
    if(!Number.isFinite(v)) v = entries[i].weight;
    entries[i].weight = Math.max(1, Math.min(100, v));
    persist();
    renderActive();
  }));
  document.querySelectorAll('[data-insp-rm]').forEach(b=> b.addEventListener('click', ()=>{
    const entries = campaign().gm.inspiration.entries;
    if(entries.length <= 1) return;
    entries.splice(Number(b.dataset.inspRm), 1);
    persist();
    renderActive();
  }));
  const inspAdd = document.getElementById('btnGmInspAdd');
  if(inspAdd) inspAdd.addEventListener('click', ()=>{
    campaign().gm.inspiration.entries.push({ label: 'New Source', weight: 1 });
    persist();
    renderActive();
  });
  const inspReset = document.getElementById('btnGmInspReset');
  if(inspReset) inspReset.addEventListener('click', ()=>{
    if(!confirm('Reset the Random Inspiration Source list to the default 5 entries?')) return;
    campaign().gm.inspiration.entries = freshInspirationEntries();
    persist();
    addLog('Random Inspiration Source', '**Random Inspiration Source** list reset to default.');
    renderActive();
  });
}

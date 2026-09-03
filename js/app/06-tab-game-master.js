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
}

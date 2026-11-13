/* =========================================================================
   TAB: MYTHIC GME  (the "full" Mythic Game Master Emulator 2e)
   -------------------------------------------------------------------------
   The other tabs implement One-Page Mythic. This tab adds the pieces of the
   full 2e ruleset the user asked for:
     - Threads List / Characters List management (plain lists, duplicates
       allowed for weighting; "Roll on the List" picks one uniformly)
     - Chaos Factor (1-9) with manual +/- and an end-of-Scene control toggle
     - Testing the Expected Scene against the Chaos Factor
       (1d10 > CF => Expected; <= CF => odd = Altered, even = Interrupt)
     - Thread Progress Tracks (10/15/20 pts, 5-pt phases, auto-Flashpoint at a
       phase boundary if none happened, Discovery Checks, Conclusion)
   Fate Questions (the card and the Discovery Check) use the Fate Chart or the
   Fate Check (askFateQuestion(), the method in gme.fateMethod).
   ========================================================================= */

// Thread Discovery Check Table (1d10 + current Progress Points) — 2e Variations.
function discoveryCheckResult(total){
  if(total <= 9)  return { label:'Progress +2',            kind:'progress',   delta:2 };
  if(total === 10) return { label:'Flashpoint +2',          kind:'flashpoint', delta:2 };
  if(total <= 14) return { label:'Track +1',               kind:'progress',   delta:1 };
  if(total <= 17) return { label:'Progress +3',            kind:'progress',   delta:3 };
  if(total === 18) return { label:'Flashpoint +3',          kind:'flashpoint', delta:3 };
  if(total === 19) return { label:'Track +2',               kind:'progress',   delta:2 };
  if(total <= 24) return { label:'Strengthen Progress +1', kind:'progress',   delta:1 };
  return             { label:'Strengthen Progress +2', kind:'progress',   delta:2 };
}

// Discovery Check Odds can never be worse than 50/50, regardless of Context.
const DISCOVERY_ODDS = ['50/50 or Unknown', 'Likely', 'Very Likely', 'Nearly Certain', 'Certain'];

// Scene Adjustment Table (1d10) — rolled when a Scene test comes up Altered.
// Rows 1-6 are the campaign's (editable) 'sceneAdjustments' list
// (SCENE_ADJUSTMENTS in 01-data-tables.js is the default), read on 1d6.
function sceneAdjustment(roll){
  if(roll <= 6) return tableEntry('sceneAdjustments', roll);
  // 7-10: roll the table (1d10) twice more, rolling again on 7-10 and on a
  // repeat of the first adjustment, so the two differ. Real d10s, so the 3D
  // dice show what the rules roll. (`tries` only guards a stubbed rollDie.)
  const again = (not) => {
    for(let tries = 0; tries < 60; tries++){
      const r = rollDie(10);
      if(r <= 6 && r !== not) return r;
    }
    return not === 1 ? 2 : 1;
  };
  const a = again(0);
  const b = again(a);
  return `Make 2 Adjustments — ${tableEntry('sceneAdjustments', a)} + ${tableEntry('sceneAdjustments', b)}`;
}

// Match a 1d100 roll against the campaign's (editable) Random Event Focus Table.
function rollEventFocus(table, roll){
  const sorted = table.slice().sort((a, b) => a.max - b.max);
  return (sorted.find(r => roll <= r.max) || sorted[sorted.length - 1]).result;
}

// One Meaning word from either the Action or the Description column. Used to
// colour an Altered Scene. The tool picks the column: that is not a die of the
// rules, so it does not use rollDie() (and is not shown as a 3D die).
function oneMeaningWord(){
  const col = Math.random() < 0.5 ? 'action' : 'desc';
  const r = rollDie(100);
  return { col, label: col === 'action' ? 'Action' : 'Description', roll: r, word: discoverWord(r, col) };
}

/* ----- Fate Questions (Mythic GME 2e, One-Pages Cheat Sheet "Fate Questions") ----- */
// The Fate Chart: every cell is [Exceptional Yes up to, Yes up to,
// Exceptional No from] (null = none, the "x" on the chart). The 81 cells are
// one ladder of 13 triples: each Odds row moves one step per Chaos Factor
// point, and each Odds row is one step above the row under it.
const FATE_LADDER = [
  [null, 1, 81], [1, 5, 82], [2, 10, 83], [3, 15, 84], [5, 25, 86], [7, 35, 88], [10, 50, 91],
  [13, 65, 94], [15, 75, 96], [17, 85, 98], [18, 90, 99], [19, 95, 100], [20, 99, null]
];
// The 9 Odds, best first: the same names and order as the Fate Chart rows.
const FATE_ODDS = Object.keys(ASK_ODDS);
function fateChartCell(odds, cf){
  const r = Math.max(0, FATE_ODDS.indexOf(odds));
  return FATE_LADDER[Math.max(0, Math.min(FATE_LADDER.length - 1, cf + 1 + (4 - r)))];
}
// A double (11 ... 99) whose digit is at or under the Chaos Factor is a Random Event.
function fateChartAnswer(odds, cf, roll){
  const [ey, y, en] = fateChartCell(odds, cf);
  const answer = ey !== null && roll <= ey ? 'Exceptional Yes'
    : roll <= y ? 'Yes'
    : en !== null && roll >= en ? 'Exceptional No' : 'No';
  const isDouble = roll >= 11 && roll <= 99 && roll % 11 === 0;
  return { answer, cell: [ey, y, en], isDouble, event: isDouble && roll % 10 <= cf };
}
// The Fate Check: 2d10 + an Odds modifier + a Chaos Factor modifier.
const FATE_CHECK_ODDS_MOD = { 'Certain':5, 'Nearly Certain':4, 'Very Likely':2, 'Likely':1, '50/50 or Unknown':0, 'Unlikely':-1, 'Very Unlikely':-2, 'Nearly Impossible':-4, 'Impossible':-5 };
const FATE_CHECK_CF_MOD = { 1:-5, 2:-4, 3:-2, 4:-1, 5:0, 6:1, 7:2, 8:4, 9:5 };
// 18+ Exceptional Yes, 11+ Yes, 5-10 No, 4 or less Exceptional No. Doubles
// whose digit is at or under the Chaos Factor are a Random Event.
function fateCheckAnswer(odds, cf, d1, d2){
  const om = FATE_CHECK_ODDS_MOD[odds] || 0, cm = FATE_CHECK_CF_MOD[cf] || 0;
  const total = d1 + d2 + om + cm;
  const answer = total >= 18 ? 'Exceptional Yes' : total >= 11 ? 'Yes' : total <= 4 ? 'Exceptional No' : 'No';
  const isDouble = d1 === d2;
  return { answer, total, oddsMod: om, cfMod: cm, isDouble, event: isDouble && d1 <= cf };
}
// Rolls one Fate Question with the campaign's method. Returns the answer, a
// short roll text (HTML-safe) for the screen and the log, and the Random Event flag.
function askFateQuestion(odds, cf, method){
  if(method === 'check'){
    const d1 = rollDie(10), d2 = rollDie(10);
    const r = fateCheckAnswer(odds, cf, d1, d2);
    const sign = n => (n < 0 ? '−' + (-n) : '+' + n);
    return Object.assign(r, {
      roll: r.total,
      text: `Fate Check 2d10: ${d1} + ${d2} ${sign(r.oddsMod)} (Odds) ${sign(r.cfMod)} (CF ${cf}) = ${r.total}`,
      eventText: `doubles ${d1}-${d2}, ${d1} ≤ CF ${cf}`,
      noEventText: `Doubles ${d1}-${d2}, but ${d1} is over the Chaos Factor ${cf}: no Random Event.`
    });
  }
  const roll = rollDie(100);
  const r = fateChartAnswer(odds, cf, roll);
  const [ey, y, en] = r.cell;
  return Object.assign(r, {
    roll,
    text: `Fate Chart 1d100: ${roll} (Odds ${odds}, CF ${cf}: Exc. Yes ≤ ${ey === null ? '—' : ey}, Yes ≤ ${y}, Exc. No ≥ ${en === null ? '—' : en})`,
    eventText: `double ${roll}, ${roll % 10} ≤ CF ${cf}`,
    noEventText: `Double ${roll}, but ${roll % 10} is over the Chaos Factor ${cf}: no Random Event.`
  });
}

/* ----- Random Events (2e): Event Meaning and the Lists ----- */
// Event Meaning: "Choose a Meaning Table and roll d100 twice to get two
// words." The app uses the Action column for both words (events are
// actions). Same shape as randomEventWords() (06), so the callers share
// eventChips / eventMd.
function eventMeaningWords(){
  const r1 = rollDie(100), r2 = rollDie(100);
  return { col: 'action', a: { roll: r1, word: discoverWord(r1, 'action') }, d: { roll: r2, word: discoverWord(r2, 'action') } };
}
// An Event Focus that needs an existing NPC or Thread rolls on that List. An
// empty List means the Event uses Current Context. Returns null for any
// other Focus, else { html, md } to add under the Focus.
const FOCUS_LIST = {
  'NPC Action': 'characters', 'NPC Negative': 'characters', 'NPC Positive': 'characters',
  'Move Toward A Thread': 'threads', 'Move Away From A Thread': 'threads', 'Close A Thread': 'threads'
};
function focusListRoll(focus){
  const key = FOCUS_LIST[focus];
  if(!key) return null;
  const label = key === 'threads' ? 'Threads List' : 'Characters List';
  const list = campaign().gme[key];
  if(!list.length) return {
    html: `<div class="small-note">${label} is empty: the Event uses Current Context.</div>`,
    md: `${label} is empty → Current Context`
  };
  const n = rollDie(list.length);
  return {
    html: `<div class="small-note">${label} (1d${list.length}: ${n}) → <b>${escapeAttr(list[n - 1])}</b></div>`,
    md: `${label} (1d${list.length}: ${n}) → **${escapeMd(list[n - 1])}**`
  };
}
// How many times `value` is in a List already (LIST_MAX_REPEAT in 03 is the limit).
function listCount(list, value){ return list.filter(s => s === value).length; }

// transient result HTML, cached so an unrelated renderActive() doesn't wipe it
let gmeSceneTestHtml = '';
let gmeFateHtml = '';
let gmeFateOdds = '50/50 or Unknown';   // the Fate Question odds stay selected across re-renders
let gmeListRollHtml = { threads: '', characters: '' };
let gmeTrackResultHtml = {};   // track id -> last action's result HTML

function renderMythicGME(){
  const g = campaign().gme;

  const listPanel = (key, title, addId, inputId, rollId) => {
    const items = g[key];
    const rows = items.map((s, i) => `
      <li>
        <span class="txt">${escapeAttr(s)}</span>
        <button type="button" data-edit="${key}" data-i="${i}" title="Edit">Edit</button>
        <button type="button" data-dupe="${key}" data-i="${i}" ${listCount(items, s) >= LIST_MAX_REPEAT ? 'disabled title="Already 3 times in the List (the maximum)"' : 'title="Add a copy (weighting, up to 3 times)"'}>&#10697;</button>
        <button type="button" data-rm="${key}" data-i="${i}" title="Remove" aria-label="Remove">&#10005;</button>
      </li>`).join('');
    return `
    <div class="card">
      <h3 class="block-title">${title}</h3>
      <div class="row">
        <input type="text" id="${inputId}" class="field-input" style="flex:1; min-width:180px;" placeholder="Add an entry…">
        <button class="btn" id="${addId}">Add</button>
        <span class="btn-wrap" ${items.length ? '' : `title="The list is empty. A Random Event that calls for this List uses Current Context instead."`}><button class="btn primary" id="${rollId}" ${items.length ? '' : 'disabled'}>Roll on List</button></span>
      </div>
      <div id="${key}RollResult" style="margin-top:10px;">${gmeListRollHtml[key]}</div>
      ${items.length
        ? `<ul class="gme-list">${rows}</ul><div class="small-note">${items.length} ${items.length === 1 ? 'entry' : 'entries'}</div>`
        : `<div class="small-note">Empty — a Random Event calling for this List uses Current Context instead.</div>`}
    </div>`;
  };

  const threadOptions = g.threads.map(t => `<option value="${escapeAttr(t)}">`).join('');

  const trackCards = g.tracks.map(t => {
    const need = trackFlashphases(t.size);
    const pct = Math.round((t.points / t.size) * 100);
    const flags = Array.from({ length: need }, (_, i) => `
      <label><input type="checkbox" data-fp="${t.id}" data-idx="${i}" ${t.flashpoints[i] ? 'checked' : ''}> Phase ${i + 1} Flashpoint (by pt ${5 * (i + 1)})</label>`).join('');
    const dis = t.concluded ? 'disabled' : '';
    const body = t.concluded
      ? `<div class="banner-solved">&#127937; Conclusion reached — Plot Armor removed. The Focus Thread can now be resolved.</div>`
      : `
      <div class="phase-flags">${flags}</div>
      <div class="row" style="margin-top:8px;">
        <button class="btn" data-progress="${t.id}" ${dis}>Make Progress +2</button>
        <button class="btn" data-flash="${t.id}" ${dis}>Flashpoint +2</button>
      </div>
      <div class="row" style="margin-top:8px; align-items:flex-end;">
        <div class="field">
          <label for="gmeDiscOdds_${t.id}">Discovery Check odds</label>
          <select id="gmeDiscOdds_${t.id}" class="field-input">
            ${DISCOVERY_ODDS.map(o => `<option value="${o}">${o}</option>`).join('')}
          </select>
        </div>
        <button class="btn primary" data-discovery="${t.id}" ${dis}>Discovery Check</button>
      </div>`;
    return `
    <div class="gme-track ${t.concluded ? 'concluded' : ''} ${t.collapsed ? 'collapsed' : ''}">
      <div class="gme-track-head">
        <button class="gme-collapse" data-collapse-track="${t.id}" aria-expanded="${t.collapsed ? 'false' : 'true'}" title="${t.collapsed ? 'Expand' : 'Collapse'}">${t.collapsed ? '&#9656;' : '&#9662;'}</button>
        <span class="focus">${escapeAttr(t.focus)}</span>
        <span class="gme-track-mini">${t.points} / ${t.size}${t.concluded ? ' &middot; concluded' : ''}</span>
        <button class="btn small danger" data-rm-track="${t.id}">Remove</button>
      </div>
      <div class="gme-progressbar"><span style="width:${pct}%"></span></div>
      ${t.collapsed ? '' : `
      <div class="small-note">Focus Thread &middot; ${t.size}-point Track &middot; ${t.points} / ${t.size} Progress Points</div>
      ${body}
      <div id="gmeTrackResult_${t.id}" style="margin-top:10px;">${gmeTrackResultHtml[t.id] || ''}</div>`}
    </div>`;
  }).join('');


  return `
  ${tabHeader(`Mythic Game Master Emulator (full 2e)`, `The full Mythic Scene loop: keep your Threads and Characters Lists, track the Chaos Factor, and test each Expected Scene against it. Fate Questions use the Fate Chart (Odds against the Chaos Factor) or the Fate Check (2d10 + modifiers).`)}

  <div class="card">
    <h3 class="block-title">Fate Question</h3>
    <div class="row" style="align-items:flex-end;">
      <div class="field" style="flex:2; min-width:200px;">
        <label for="gmeFateQ">Your question (optional, for the log)</label>
        <input type="text" id="gmeFateQ" class="field-input" style="width:100%" placeholder="Is the door locked?">
      </div>
      <div class="field">
        <label for="gmeFateOdds">Odds</label>
        <select id="gmeFateOdds" class="field-input">${Object.keys(ASK_ODDS).map(k => `<option value="${k}" ${k === gmeFateOdds ? 'selected' : ''}>${k}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label for="gmeFateMethod">Method</label>
        <select id="gmeFateMethod" class="field-input">
          <option value="chart" ${g.fateMethod !== 'check' ? 'selected' : ''}>Fate Chart (1d100)</option>
          <option value="check" ${g.fateMethod === 'check' ? 'selected' : ''}>Fate Check (2d10)</option>
        </select>
      </div>
      <button class="btn primary" id="btnGmeFate">Ask</button>
    </div>
    <div class="small-note">${g.fateMethod === 'check'
      ? `2d10 + the Odds modifier + the Chaos Factor modifier (CF ${g.chaosFactor}: ${FATE_CHECK_CF_MOD[g.chaosFactor] >= 0 ? '+' : '−'}${Math.abs(FATE_CHECK_CF_MOD[g.chaosFactor])}). 18+ Exceptional Yes, 11+ Yes, 4 or less Exceptional No. Doubles at or under the Chaos Factor start a Random Event.`
      : `The Fate Chart row for the Odds, in the Chaos Factor ${g.chaosFactor} column. A double (11, 22 … 99) whose digit is at or under the Chaos Factor starts a Random Event.`}</div>
    <div id="gmeFateResult">${gmeFateHtml}</div>
  </div>

  <div class="card">
    <h3 class="block-title">Scene ${g.sceneNumber} test</h3>
    <div class="field">
      <label for="gmeExpectedScene">Expected Scene — how you think Scene ${g.sceneNumber} will start</label>
      <textarea id="gmeExpectedScene" class="field-input" rows="3" data-autogrow style="width:100%; resize:vertical;" placeholder="e.g. The PC questions the suspect at work.">${escapeAttr(g.expectedScene)}</textarea>
    </div>
    <div class="row"><button class="btn primary" id="btnGmeTestScene">Test vs Chaos Factor</button></div>
    <div id="gmeSceneTestResult" style="margin-top:12px;">${gmeSceneTestHtml}</div>
  </div>

  <div class="grid2">
    ${listPanel('threads', 'Threads List', 'btnGmeAddThread', 'gmeThreadInput', 'btnGmeRollThread')}
    ${listPanel('characters', 'Characters List', 'btnGmeAddChar', 'gmeCharInput', 'btnGmeRollChar')}
  </div>

  <div class="card">
    <h3 class="block-title">Thread Progress Tracks</h3>
    <p class="small-note" style="margin-top:-4px;">Focus a Thread and grind it toward a Conclusion. Making Progress or a Flashpoint is +2; each 5-point phase auto-fires a Flashpoint if none happened; a stalled Track can be pushed with a Discovery Check.</p>
    <datalist id="gmeThreadList">${threadOptions}</datalist>
    <div class="row" style="align-items:flex-end;">
      <div class="field" style="flex:1; min-width:200px;">
        <label for="gmeTrackFocus">Focus Thread</label>
        <input type="text" id="gmeTrackFocus" class="field-input" list="gmeThreadList" placeholder="Pick or type a Thread">
      </div>
      <div class="field">
        <label for="gmeTrackSize">Track length</label>
        <select id="gmeTrackSize" class="field-input">
          <option value="10">10 points</option>
          <option value="15">15 points</option>
          <option value="20">20 points</option>
        </select>
      </div>
      <button class="btn primary" id="btnGmeAddTrack">Start Track</button>
    </div>
    ${trackCards || '<div class="small-note" style="margin-top:12px;">No Progress Tracks yet.</div>'}
  </div>
  `;
}

function wireMythicGME(){
  const g = () => campaign().gme;

  // A Random Event's inspiration words — the same roll the Game Master tab makes.
  const eventChips = m => `<div class="word-chip"><b>${m.a.word}</b></div><div class="word-chip"><b>${m.d.word}</b></div>`;
  const eventMd = m => `Meaning: **${m.a.word} / ${m.d.word}** (rolls ${m.a.roll}, ${m.d.roll})`;

  /* ----- Fate Question ----- */
  // askFateQuestion(): the Fate Chart or the Fate Check (g().fateMethod).
  // A Random Event: Event Focus from the campaign's table, the List roll for
  // an NPC / Thread Focus, and the Event Meaning word pair.
  document.getElementById('gmeFateOdds').addEventListener('change', e => { gmeFateOdds = e.target.value; });
  document.getElementById('gmeFateMethod').addEventListener('change', e => {
    g().fateMethod = e.target.value === 'check' ? 'check' : 'chart';
    persist();
    renderActive();
  });
  document.getElementById('btnGmeFate').addEventListener('click', ()=>{
    const q = document.getElementById('gmeFateQ').value.trim();
    const odds = gmeFateOdds = document.getElementById('gmeFateOdds').value;
    const cf = g().chaosFactor;
    const r = askFateQuestion(odds, cf, g().fateMethod);
    const no = r.answer.includes('No');
    let html = `<div class="result-box ${no ? 'no' : ''}"><span class="roll-num">${r.roll}</span> &nbsp; Odds: <b>${odds}</b> &nbsp;→&nbsp; <span class="answer-tag ${no ? 'no' : 'yes'}">${r.answer}</span>`;
    html += `<div class="small-note">${r.text}</div>`;
    if(q) html += `<div class="small-note">${escapeAttr(q)}</div>`;
    let md = `**Fate Question** — ${q ? '"' + escapeMd(q) + '" — ' : ''}Odds: ${odds} — ${r.text} → **${r.answer}**`;
    if(r.event){
      const fRoll = rollDie(100);
      const focus = rollEventFocus(g().eventFocusTable, fRoll);
      const lr = focusListRoll(focus);
      const m = eventMeaningWords();
      html += `<div class="small-note">Random Event (${r.eventText})!</div>
        <div class="small-note">Event Focus (1d100: ${fRoll}) → <b>${escapeAttr(focus)}</b></div>${lr ? lr.html : ''}${eventChips(m)}`;
      md += `\n  - 🎲 *Random Event (${r.eventText})* — Event Focus (1d100: ${fRoll}) → **${escapeMd(focus)}**` + (lr ? ` — ${lr.md}` : '') + ` — ${eventMd(m)}`;
    } else if(r.isDouble){
      html += `<div class="small-note">${r.noEventText}</div>`;
    }
    html += `</div>`;
    gmeFateHtml = html;
    document.getElementById('gmeFateResult').innerHTML = html;
    addLog('Mythic GME', md);
  });
  document.getElementById('gmeFateQ').addEventListener('keydown', e => { if(e.key === 'Enter' && !isComposing(e)){ e.preventDefault(); document.getElementById('btnGmeFate').click(); } });

  /* ----- Expected Scene text (save without re-rendering, to keep focus) ----- */
  const exp = document.getElementById('gmeExpectedScene');
  exp.addEventListener('input', ()=>{ g().expectedScene = exp.value; persist(); });

  /* ----- Test the Expected Scene against the Chaos Factor ----- */
  document.getElementById('btnGmeTestScene').addEventListener('click', ()=>{
    const cf = g().chaosFactor;
    const roll = rollDie(10);
    let type, note;
    if(roll > cf){
      type = 'Expected Scene';
      note = 'Your Expected Scene starts exactly how you thought it would.';
    } else if(roll % 2 === 1){
      type = 'Altered Scene';
      note = 'The Scene begins in the next most expected way — apply the Scene Adjustment below, coloured by the Meaning word.';
    } else {
      type = 'Interrupt Scene';
      note = 'Ignore your expectation. A Random Event starts the Scene: the Event Focus below, and the Meaning word pair.';
    }
    const changed = type !== 'Expected Scene';
    const expText = (g().expectedScene || '').trim();

    // Altered  -> Scene Adjustment Table (1d10) + one Meaning word (1d100)
    // Interrupt -> a Random Event: Event Focus Table (1d100) + a Meaning word pair (2 x 1d100)
    let extraHtml = '', extraMd = '';
    if(type === 'Altered Scene'){
      const aRoll = rollDie(10);
      const adj = sceneAdjustment(aRoll);
      const w = oneMeaningWord();
      extraHtml = `<div class="small-note">Scene Adjustment (1d10: ${aRoll}) → <b>${adj}</b></div>
        <div class="small-note">Meaning (${w.label}, 1d100: ${w.roll}):</div><div class="word-chip"><b>${w.word}</b></div>`;
      extraMd = `\n  - Scene Adjustment (1d10: ${aRoll}) → **${adj}**\n  - Meaning (${w.label}, 1d100: ${w.roll}) → **${w.word}**`;
    } else if(type === 'Interrupt Scene'){
      // A Random Event (2e): Event Focus (1d100), a List roll for an NPC /
      // Thread Focus, and Event Meaning: two words from one Meaning Table (2 x 1d100).
      const fRoll = rollDie(100);
      const focus = rollEventFocus(g().eventFocusTable, fRoll);
      const lr = focusListRoll(focus);
      const m = eventMeaningWords();
      extraHtml = `<div class="small-note">Event Focus (1d100: ${fRoll}) → <b>${escapeAttr(focus)}</b></div>${lr ? lr.html : ''}
        <div class="small-note">Meaning (Action, 1d100: ${m.a.roll}, ${m.d.roll}):</div>${eventChips(m)}`;
      extraMd = `\n  - Event Focus (1d100: ${fRoll}) → **${escapeMd(focus)}**` + (lr ? `\n  - ${lr.md}` : '') + `\n  - ${eventMd(m)}`;
    }

    gmeSceneTestHtml = `<div class="result-box ${changed ? 'no' : ''}">
      <span class="roll-num">${roll}</span> vs Chaos Factor <b>${cf}</b> &nbsp;→&nbsp;
      <span class="answer-tag ${changed ? 'no' : 'yes'}">${type}</span>
      ${expText ? `<div class="small-note">Expected: ${escapeAttr(expText)}</div>` : ''}
      <div class="small-note">${note}</div>
      ${extraHtml}
    </div>`;
    document.getElementById('gmeSceneTestResult').innerHTML = gmeSceneTestHtml;
    addLog('Mythic GME', `**Test Expected Scene ${g().sceneNumber}** — 1d10: ${roll} vs CF ${cf} → **${type}**` +
      (expText ? ` — Expected: "${escapeMd(expText)}"` : '') + extraMd);
  });

  /* ----- Threads / Characters Lists ----- */
  function addTo(key, inputId, label){
    const el = document.getElementById(inputId);
    const v = el.value.trim();
    if(!v) return;
    if(listCount(g()[key], v) >= LIST_MAX_REPEAT){ alert(`"${v}" is already ${LIST_MAX_REPEAT} times in the ${label} (the maximum).`); return; }
    g()[key].push(v);
    persist();
    addLog('Mythic GME', `**${label}** — added "${escapeMd(v)}".`);
    renderActive();
  }
  document.getElementById('btnGmeAddThread').addEventListener('click', ()=>addTo('threads', 'gmeThreadInput', 'Threads List'));
  document.getElementById('btnGmeAddChar').addEventListener('click', ()=>addTo('characters', 'gmeCharInput', 'Characters List'));
  document.getElementById('gmeThreadInput').addEventListener('keydown', e=>{ if(e.key === 'Enter' && !isComposing(e)){ e.preventDefault(); addTo('threads', 'gmeThreadInput', 'Threads List'); } });
  document.getElementById('gmeCharInput').addEventListener('keydown', e=>{ if(e.key === 'Enter' && !isComposing(e)){ e.preventDefault(); addTo('characters', 'gmeCharInput', 'Characters List'); } });

  document.querySelectorAll('[data-rm]').forEach(b=> b.addEventListener('click', ()=>{
    const key = b.dataset.rm, i = Number(b.dataset.i);
    const [removed] = g()[key].splice(i, 1);
    persist();
    addLog('Mythic GME', `**${key === 'threads' ? 'Threads' : 'Characters'} List** — removed "${escapeMd(removed)}".`);
    renderActive();
  }));
  document.querySelectorAll('[data-edit]').forEach(b=> b.addEventListener('click', ()=>{
    const key = b.dataset.edit, i = Number(b.dataset.i);
    const before = g()[key][i];
    if(before == null) return;
    editListEntry(b, before, v => {
      g()[key][i] = v;
      persist();
      addLog('Mythic GME', `**${key === 'threads' ? 'Threads' : 'Characters'} List** — renamed "${escapeMd(before)}" to "${escapeMd(v)}".`);
    });
  }));
  document.querySelectorAll('[data-dupe]').forEach(b=> b.addEventListener('click', ()=>{
    const key = b.dataset.dupe, i = Number(b.dataset.i);
    if(listCount(g()[key], g()[key][i]) >= LIST_MAX_REPEAT) return;
    g()[key].splice(i, 0, g()[key][i]);
    persist();
    renderActive();
  }));

  function rollList(key, label){
    const list = g()[key];
    if(!list.length) return;
    const n = rollDie(list.length);
    const pick = list[n - 1];
    gmeListRollHtml[key] = `<div class="result-box"><span class="roll-num">${n}</span> of ${list.length} &nbsp;→&nbsp; <b>${escapeAttr(pick)}</b></div>`;
    document.getElementById(key + 'RollResult').innerHTML = gmeListRollHtml[key];
    addLog('Mythic GME', `**Roll on ${label}** (${list.length} ${list.length === 1 ? 'entry' : 'entries'}) → **${escapeMd(pick)}**`);
  }
  document.getElementById('btnGmeRollThread').addEventListener('click', ()=>rollList('threads', 'Threads List'));
  document.getElementById('btnGmeRollChar').addEventListener('click', ()=>rollList('characters', 'Characters List'));

  /* ----- Progress Tracks ----- */

  // Apply a point change. kind 'flashpoint' marks the current phase's box and
  // never auto-triggers; kind 'progress' auto-fires any unchecked phase
  // Flashpoint whose 5-pt boundary we've now reached. Returns what happened.
  function applyPoints(track, delta, kind){
    const before = track.points;
    track.points = Math.max(0, Math.min(track.size, before + delta));
    const need = trackFlashphases(track.size);
    const events = [];
    if(kind === 'flashpoint'){
      const idx = Math.min(Math.floor(before / 5), need - 1);
      if(idx >= 0) track.flashpoints[idx] = true;
    } else {
      for(let k = 1; k <= need; k++){
        if(track.points >= k * 5 && !track.flashpoints[k - 1]){
          track.flashpoints[k - 1] = true;
          events.push({ phase: k, m: eventMeaningWords() });
        }
      }
    }
    const concluded = !track.concluded && track.points >= track.size;
    if(concluded) track.concluded = true;
    persist();
    return { before, after: track.points, events, concluded };
  }

  function showTrackResult(track, headline, res, extraM){
    let html = `<div class="result-box ${res.concluded ? 'event' : ''}"><b>${escapeAttr(track.focus)}</b> — ${headline} <span class="small-note">(${res.before} → ${res.after} / ${track.size})</span>`;
    const lines = [headline + ` (${res.before} → ${res.after}/${track.size})`];
    if(extraM){ html += `<div style="margin-top:6px;">${eventChips(extraM)}</div>`; lines.push(eventMd(extraM)); }
    res.events.forEach(ev=>{
      html += `<div class="small-note">&#9889; Phase ${ev.phase} Flashpoint auto-triggered — no Flashpoint happened this phase. Treat as a Random Event (Current Context) that involves the Focus Thread dramatically without resolving it.</div>${eventChips(ev.m)}`;
      lines.push(`⚡ Phase ${ev.phase} Flashpoint triggered — ${eventMd(ev.m)}`);
    });
    if(res.concluded){
      html += `<div class="banner-solved">&#127937; Conclusion reached — Plot Armor removed.</div>`;
      lines.push('🏁 **Conclusion reached** — Plot Armor removed; the Focus Thread can now be resolved.');
    }
    html += `</div>`;
    gmeTrackResultHtml[track.id] = html;
    addLog('Mythic GME', `**Progress Track "${escapeMd(track.focus)}"** — ` + lines.join('\n  - '));
  }

  document.getElementById('btnGmeAddTrack').addEventListener('click', ()=>{
    const gme = g();
    const focus = document.getElementById('gmeTrackFocus').value.trim() || 'Untitled Thread';
    const size = Number(document.getElementById('gmeTrackSize').value) || 10;
    gme.tracks.push({ id: gme.nextTrackId++, focus, size, points: 0, flashpoints: Array(trackFlashphases(size)).fill(false), concluded: false, collapsed: false });
    persist();
    addLog('Mythic GME', `**Progress Track started** — "${escapeMd(focus)}" (${size}-point Track).`);
    renderActive();
  });

  const trackById = id => g().tracks.find(t => t.id === Number(id));

  document.querySelectorAll('[data-collapse-track]').forEach(b=> b.addEventListener('click', ()=>{
    const t = trackById(b.dataset.collapseTrack);
    if(!t) return;
    t.collapsed = !t.collapsed;
    persist();
    renderActive();
  }));

  document.querySelectorAll('[data-rm-track]').forEach(b=> b.addEventListener('click', ()=>{
    const t = trackById(b.dataset.rmTrack);
    if(!t || !confirm(`Remove Progress Track "${t.focus}"?`)) return;
    g().tracks = g().tracks.filter(x => x.id !== t.id);
    delete gmeTrackResultHtml[t.id];
    persist();
    addLog('Mythic GME', `**Progress Track removed** — "${escapeMd(t.focus)}".`);
    renderActive();
  }));

  document.querySelectorAll('[data-fp]').forEach(cb=> cb.addEventListener('change', ()=>{
    const t = trackById(cb.dataset.fp);
    if(!t) return;
    t.flashpoints[Number(cb.dataset.idx)] = cb.checked;
    persist();
    renderActive();
  }));

  document.querySelectorAll('[data-progress]').forEach(b=> b.addEventListener('click', ()=>{
    const t = trackById(b.dataset.progress);
    if(!t || t.concluded) return;
    showTrackResult(t, 'Progress +2', applyPoints(t, 2, 'progress'));
    renderActive();
  }));
  document.querySelectorAll('[data-flash]').forEach(b=> b.addEventListener('click', ()=>{
    const t = trackById(b.dataset.flash);
    if(!t || t.concluded) return;
    showTrackResult(t, 'Flashpoint +2', applyPoints(t, 2, 'flashpoint'), eventMeaningWords());
    renderActive();
  }));

  document.querySelectorAll('[data-discovery]').forEach(b=> b.addEventListener('click', ()=>{
    const t = trackById(b.dataset.discovery);
    if(!t || t.concluded) return;
    const odds = document.getElementById('gmeDiscOdds_' + t.id).value;
    const fq = askFateQuestion(odds, g().chaosFactor, g().fateMethod);   // the Fate Chart or the Fate Check
    const answer = fq.answer;

    let html = `<div class="result-box ${answer.includes('No') ? 'no' : ''}"><b>${escapeAttr(t.focus)}</b> — Discovery Check
      <div class="small-note">"Is something discovered?" &middot; ${fq.text} → <b>${answer}</b></div>`;
    const lines = [`Discovery Check "Is something discovered?" — Odds: ${odds}, ${fq.text} → **${answer}**`];

    let rolls = answer === 'Exceptional Yes' ? 2 : answer === 'Yes' ? 1 : 0;
    if(answer === 'No'){
      html += `<div class="small-note">Nothing useful is found. No roll on the Thread Discovery Check Table.</div>`;
      lines.push('Nothing useful found — no table roll.');
    } else if(answer === 'Exceptional No'){
      html += `<div class="small-note">Nothing useful is found — and no more Discovery Checks for the rest of this Scene (a dead end).</div>`;
      lines.push('Nothing found — no more Discovery Checks this Scene.');
    }

    for(let i = 0; i < rolls; i++){
      const r = rollDie(10);
      const total = r + t.points;
      const eff = discoveryCheckResult(total);
      const res = applyPoints(t, eff.delta, eff.kind === 'flashpoint' ? 'flashpoint' : 'progress');
      const m = eventMeaningWords();
      html += `<div class="small-note" style="margin-top:6px;">Thread Discovery Check Table — 1d10(${r}) + ${res.before} Progress = <b>${total}</b> → <b>${eff.label}</b> <span class="small-note">(${res.before} → ${res.after} / ${t.size})</span></div>${eventChips(m)}`;
      lines.push(`Table: 1d10(${r}) + ${res.before} = ${total} → **${eff.label}** (${res.before} → ${res.after}/${t.size}) — ${eventMd(m)}`);
      res.events.forEach(ev=>{
        html += `<div class="small-note">&#9889; Phase ${ev.phase} Flashpoint auto-triggered.</div>${eventChips(ev.m)}`;
        lines.push(`⚡ Phase ${ev.phase} Flashpoint triggered — ${eventMd(ev.m)}`);
      });
      if(res.concluded){
        html += `<div class="banner-solved">&#127937; Conclusion reached — Plot Armor removed.</div>`;
        lines.push('🏁 **Conclusion reached** — Plot Armor removed.');
      }
    }
    html += `</div>`;
    gmeTrackResultHtml[t.id] = html;
    addLog('Mythic GME', `**Progress Track "${escapeMd(t.focus)}"** — ` + lines.join('\n  - '));
    renderActive();
  }));
}

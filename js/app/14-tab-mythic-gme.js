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
   Fate Questions (the Discovery Check) reuse askTheGM() from the GM tab.
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
const SCENE_ADJUSTMENTS = [
  'Remove A Character', 'Add A Character', 'Reduce/Remove An Activity',
  'Increase An Activity', 'Remove An Object', 'Add An Object'
];
function sceneAdjustment(roll){
  if(roll <= 6) return SCENE_ADJUSTMENTS[roll - 1];
  // 7-10: make two adjustments (reroll a duplicate so they differ)
  const a = rollDie(6);
  let b = rollDie(6);
  if(b === a) b = (b % 6) + 1;
  return `Make 2 Adjustments — ${SCENE_ADJUSTMENTS[a - 1]} + ${SCENE_ADJUSTMENTS[b - 1]}`;
}

// Match a 1d100 roll against the campaign's (editable) Random Event Focus Table.
function rollEventFocus(table, roll){
  const sorted = table.slice().sort((a, b) => a.max - b.max);
  return (sorted.find(r => roll <= r.max) || sorted[sorted.length - 1]).result;
}

// One Meaning word from either the Action or the Description column (the tool
// picks the column). Used to colour an Altered / Interrupt Scene.
function oneMeaningWord(){
  const col = rollDie(2) === 1 ? 'action' : 'desc';
  const r = rollDie(100);
  return { col, label: col === 'action' ? 'Action' : 'Description', roll: r, word: discoverWord(r, col) };
}

// transient result HTML, cached so an unrelated renderActive() doesn't wipe it
let gmeSceneTestHtml = '';
let gmeListRollHtml = { threads: '', characters: '' };
let gmeTrackResultHtml = {};   // track id -> last action's result HTML
let gmeFocusEditorOpen = false; // Random Event Focus Table editor collapsed by default

function renderMythicGME(){
  const g = campaign().gme;

  const listPanel = (key, title, addId, inputId, rollId) => {
    const items = g[key];
    const rows = items.map((s, i) => `
      <li>
        <span class="txt">${escapeAttr(s)}</span>
        <button type="button" data-dupe="${key}" data-i="${i}" title="Add a copy (weighting)">&#10697;</button>
        <button type="button" data-rm="${key}" data-i="${i}" title="Remove">&#10005;</button>
      </li>`).join('');
    return `
    <div class="card">
      <h3 class="block-title">${title}</h3>
      <div class="row">
        <input type="text" id="${inputId}" class="field-input" style="flex:1; min-width:180px;" placeholder="Add an entry…">
        <button class="btn" id="${addId}">Add</button>
        <button class="btn primary" id="${rollId}" ${items.length ? '' : 'disabled'}>Roll on List</button>
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

  const focusRows = g.eventFocusTable.map((r, i) => {
    const lo = (i === 0 ? 0 : g.eventFocusTable[i - 1].max) + 1;
    return `<tr>
      <td class="range"><span class="small-note">${lo <= r.max ? lo : r.max}&ndash;</span><input type="number" min="1" max="100" data-focus-max="${i}" class="field-input" value="${r.max}"></td>
      <td><input type="text" data-focus-result="${i}" class="field-input" value="${escapeAttr(r.result)}"></td>
      <td><button class="btn small danger" data-focus-rm="${i}" ${g.eventFocusTable.length <= 1 ? 'disabled' : ''}>&#10005;</button></td>
    </tr>`;
  }).join('');
  const focusCustomised = JSON.stringify(g.eventFocusTable) !== JSON.stringify(DEFAULT_EVENT_FOCUS);

  return `
  <h2 class="tool-title">Mythic Game Master Emulator (full 2e)</h2>
  <p class="tool-desc">The full Mythic Scene loop: keep your Threads and Characters Lists, track the Chaos Factor, and test each Expected Scene against it. Fate Questions here use the same odds logic as <b>Ask the Game Master</b>.</p>

  <div class="card">
    <h3 class="block-title">Chaos Factor &amp; Scene</h3>
    <div class="row" style="gap:26px; align-items:center;">
      <div class="pp-readout"><span class="num">${g.chaosFactor}</span><span class="lbl">Chaos Factor (1–9)</span></div>
      <div class="row">
        <button class="btn small" id="btnGmeCfMinus">CF &minus;1</button>
        <button class="btn small" id="btnGmeCfPlus">CF +1</button>
      </div>
      <div class="pp-readout"><span class="num">${g.sceneNumber}</span><span class="lbl">Scene</span></div>
    </div>

    <div class="field" style="margin-top:14px;">
      <label for="gmeExpectedScene">Expected Scene — how you think Scene ${g.sceneNumber} will start</label>
      <textarea id="gmeExpectedScene" class="field-input" rows="2" style="width:100%; resize:vertical;" placeholder="e.g. The PC drops in on the suspect at his workplace to question him.">${escapeAttr(g.expectedScene)}</textarea>
    </div>
    <div class="row"><button class="btn primary" id="btnGmeTestScene">Test vs Chaos Factor</button></div>
    <div id="gmeSceneTestResult" style="margin-top:12px;">${gmeSceneTestHtml}</div>

    <div class="divider"></div>
    <div class="row" style="align-items:flex-end;">
      <div class="field">
        <label for="gmeControl">End of Scene — was the PC in control?</label>
        <select id="gmeControl" class="field-input">
          <option value="in">Yes — in control (Chaos Factor −1)</option>
          <option value="out">No — not in control (Chaos Factor +1)</option>
        </select>
      </div>
      <button class="btn" id="btnGmeEndScene">End Scene &amp; Update CF</button>
    </div>
    <div class="small-note">Ends Scene ${g.sceneNumber}, adjusts the Chaos Factor, and advances to Scene ${g.sceneNumber + 1}.</div>
  </div>

  <div class="card">
    <div class="row" style="justify-content:space-between; align-items:center;">
      <h3 class="block-title" style="margin:0; padding:0; border:0;">Random Event Focus Table</h3>
      <button class="btn small" id="btnGmeFocusToggle">${gmeFocusEditorOpen ? 'Done' : 'Edit'}</button>
    </div>
    <div class="small-note" style="margin-top:6px;">Rolled (1d100) when a Scene test comes up <b>Interrupt</b>.${focusCustomised ? ' Customised for this campaign.' : ''}</div>
    ${gmeFocusEditorOpen ? `
    <div style="overflow-x:auto;">
      <table class="gme-focus-table">
        <thead><tr><th>Range (1d100)</th><th>Event Focus</th><th></th></tr></thead>
        <tbody>${focusRows}</tbody>
      </table>
    </div>
    <div class="row" style="margin-top:10px;">
      <button class="btn small" id="btnGmeFocusAdd">Add row</button>
      <button class="btn small" id="btnGmeFocusReset">Reset to default</button>
    </div>
    <div class="small-note" style="margin-top:6px;">Ranges run in order from 1; each row sets the top of its band. A roll above the last row uses the last row.</div>
    ` : ''}
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
        <input type="text" id="gmeTrackFocus" class="field-input" list="gmeThreadList" placeholder="Type or pick from the Threads List">
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

  /* ----- Chaos Factor ----- */
  document.getElementById('btnGmeCfMinus').addEventListener('click', ()=>{
    g().chaosFactor = Math.max(1, g().chaosFactor - 1);
    persist(); addLog('Mythic GME', `**Chaos Factor** lowered to ${g().chaosFactor}.`); renderActive();
  });
  document.getElementById('btnGmeCfPlus').addEventListener('click', ()=>{
    g().chaosFactor = Math.min(9, g().chaosFactor + 1);
    persist(); addLog('Mythic GME', `**Chaos Factor** raised to ${g().chaosFactor}.`); renderActive();
  });

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
      note = 'Ignore your expectation. Generate a Random Event from the Event Focus below, coloured by the Meaning word.';
    }
    const changed = type !== 'Expected Scene';
    const expText = (g().expectedScene || '').trim();

    // Altered  -> Scene Adjustment Table (1d10) + one Meaning word
    // Interrupt -> Random Event Focus Table (1d100) + one Meaning word
    let extraHtml = '', extraMd = '';
    if(type === 'Altered Scene'){
      const aRoll = rollDie(10);
      const adj = sceneAdjustment(aRoll);
      const w = oneMeaningWord();
      extraHtml = `<div class="small-note">Scene Adjustment (1d10: ${aRoll}) → <b>${adj}</b></div>
        <div class="small-note">Meaning (${w.label}, 1d100: ${w.roll}):</div><div class="word-chip"><b>${w.word}</b></div>`;
      extraMd = `\n  - Scene Adjustment (1d10: ${aRoll}) → **${adj}**\n  - Meaning (${w.label}, 1d100: ${w.roll}) → **${w.word}**`;
    } else if(type === 'Interrupt Scene'){
      const fRoll = rollDie(100);
      const focus = rollEventFocus(g().eventFocusTable, fRoll);
      const w = oneMeaningWord();
      extraHtml = `<div class="small-note">Event Focus (1d100: ${fRoll}) → <b>${escapeAttr(focus)}</b></div>
        <div class="small-note">Meaning (${w.label}, 1d100: ${w.roll}):</div><div class="word-chip"><b>${w.word}</b></div>`;
      extraMd = `\n  - Event Focus (1d100: ${fRoll}) → **${escapeMd(focus)}**\n  - Meaning (${w.label}, 1d100: ${w.roll}) → **${w.word}**`;
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

  /* ----- End Scene: adjust CF, advance scene ----- */
  document.getElementById('btnGmeEndScene').addEventListener('click', ()=>{
    const inControl = document.getElementById('gmeControl').value === 'in';
    const gme = g();
    const ended = gme.sceneNumber;
    gme.chaosFactor = inControl ? Math.max(1, gme.chaosFactor - 1) : Math.min(9, gme.chaosFactor + 1);
    gme.sceneNumber += 1;
    gme.expectedScene = '';
    gmeSceneTestHtml = '';
    persist();
    addLog('Mythic GME', `**Scene ${ended} ended** — PC ${inControl ? 'in control → Chaos Factor −1' : 'not in control → Chaos Factor +1'} (now ${gme.chaosFactor}). Beginning Scene ${gme.sceneNumber}.`);
    renderActive();
  });

  /* ----- Random Event Focus Table editor (collapsible) ----- */
  document.getElementById('btnGmeFocusToggle').addEventListener('click', ()=>{
    gmeFocusEditorOpen = !gmeFocusEditorOpen;
    renderActive();
  });
  document.querySelectorAll('[data-focus-max]').forEach(el=> el.addEventListener('change', ()=>{
    const i = Number(el.dataset.focusMax);
    let v = Math.round(Number(el.value));
    if(!Number.isFinite(v)) v = g().eventFocusTable[i].max;
    g().eventFocusTable[i].max = Math.max(1, Math.min(100, v));
    g().eventFocusTable.sort((a, b) => a.max - b.max);
    persist();
    renderActive();
  }));
  document.querySelectorAll('[data-focus-result]').forEach(el=> el.addEventListener('change', ()=>{
    const i = Number(el.dataset.focusResult);
    g().eventFocusTable[i].result = el.value.trim() || '(unnamed)';
    persist();
  }));
  document.querySelectorAll('[data-focus-rm]').forEach(b=> b.addEventListener('click', ()=>{
    if(g().eventFocusTable.length <= 1) return;
    g().eventFocusTable.splice(Number(b.dataset.focusRm), 1);
    persist();
    renderActive();
  }));
  const focusAdd = document.getElementById('btnGmeFocusAdd');
  if(focusAdd) focusAdd.addEventListener('click', ()=>{
    g().eventFocusTable.push({ max: 100, result: 'New Focus' });
    g().eventFocusTable.sort((a, b) => a.max - b.max);
    persist();
    renderActive();
  });
  const focusReset = document.getElementById('btnGmeFocusReset');
  if(focusReset) focusReset.addEventListener('click', ()=>{
    if(!confirm('Reset the Random Event Focus Table to the default 12 rows?')) return;
    g().eventFocusTable = DEFAULT_EVENT_FOCUS.map(r => ({ ...r }));
    persist();
    addLog('Mythic GME', '**Random Event Focus Table** reset to default.');
    renderActive();
  });

  /* ----- Threads / Characters Lists ----- */
  function addTo(key, inputId, label){
    const el = document.getElementById(inputId);
    const v = el.value.trim();
    if(!v) return;
    g()[key].push(v);
    persist();
    addLog('Mythic GME', `**${label}** — added "${escapeMd(v)}".`);
    renderActive();
  }
  document.getElementById('btnGmeAddThread').addEventListener('click', ()=>addTo('threads', 'gmeThreadInput', 'Threads List'));
  document.getElementById('btnGmeAddChar').addEventListener('click', ()=>addTo('characters', 'gmeCharInput', 'Characters List'));
  document.getElementById('gmeThreadInput').addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); addTo('threads', 'gmeThreadInput', 'Threads List'); } });
  document.getElementById('gmeCharInput').addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); addTo('characters', 'gmeCharInput', 'Characters List'); } });

  document.querySelectorAll('[data-rm]').forEach(b=> b.addEventListener('click', ()=>{
    const key = b.dataset.rm, i = Number(b.dataset.i);
    const [removed] = g()[key].splice(i, 1);
    persist();
    addLog('Mythic GME', `**${key === 'threads' ? 'Threads' : 'Characters'} List** — removed "${escapeMd(removed)}".`);
    renderActive();
  }));
  document.querySelectorAll('[data-dupe]').forEach(b=> b.addEventListener('click', ()=>{
    const key = b.dataset.dupe, i = Number(b.dataset.i);
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
          events.push({ phase: k, m: randomEventWords() });
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
    showTrackResult(t, 'Flashpoint +2', applyPoints(t, 2, 'flashpoint'), randomEventWords());
    renderActive();
  }));

  document.querySelectorAll('[data-discovery]').forEach(b=> b.addEventListener('click', ()=>{
    const t = trackById(b.dataset.discovery);
    if(!t || t.concluded) return;
    const odds = document.getElementById('gmeDiscOdds_' + t.id).value;
    const qRoll = rollDie(100);
    const { answer } = askTheGM(odds, qRoll);   // same logic as Ask the Game Master

    let html = `<div class="result-box ${answer.includes('No') ? 'no' : ''}"><b>${escapeAttr(t.focus)}</b> — Discovery Check
      <div class="small-note">"Is something discovered?" &middot; Odds ${odds} &middot; 1d100 ${qRoll} → <b>${answer}</b></div>`;
    const lines = [`Discovery Check "Is something discovered?" — Odds: ${odds}, Roll: ${qRoll} → **${answer}**`];

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
      const m = randomEventWords();
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

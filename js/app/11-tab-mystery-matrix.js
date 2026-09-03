/* =========================================================================
   TAB: MYSTERY MATRIX
   ========================================================================= */
let lastDiscoveryHtml = '';

function boxByUid(uid){ return campaign().mystery.boxes.find(b=>b.uid===uid); }
function boxIndex(uid){ return campaign().mystery.boxes.findIndex(b=>b.uid===uid); }

function renderMatrixTable(m){
  const clues = m.boxes.filter(b=>b.type==='C');
  const suspects = m.boxes.filter(b=>b.type==='S');
  if(!clues.length && !suspects.length){
    return '<span class="small-note">No Clues or Suspects yet.</span>';
  }
  const suspectHeaders = suspects.map(s=>`
    <th class="suspect-col ${s.uid===m.solvedBoxUid?'solved':''}" data-uid="${s.uid}">
      <button class="rm" data-rm="${s.uid}" title="Remove">&#10005;</button>
      <input type="text" class="col-lbl" data-edit="${s.uid}" value="${escapeAttr(s.label)}">
      <div class="col-count">${s.connections.length} conn.</div>
    </th>`).join('');
  const bodyRows = clues.map(c=>{
    const cells = suspects.map(s=>{
      const checked = c.connections.includes(s.uid) ? 'checked' : '';
      return `<td class="cell ${s.uid===m.solvedBoxUid?'solved-col':''}"><input type="checkbox" data-clue="${c.uid}" data-suspect="${s.uid}" ${checked} title="${escapeAttr(c.label)} \u2194 ${escapeAttr(s.label)}"></td>`;
    }).join('');
    return `<tr>
      <th class="clue-row" data-uid="${c.uid}">
        <button class="rm" data-rm="${c.uid}" title="Remove">&#10005;</button>
        <input type="text" class="row-lbl" data-edit="${c.uid}" value="${escapeAttr(c.label)}">
        <div class="row-count">${c.connections.length} conn.</div>
      </th>
      ${cells}
    </tr>`;
  }).join('');
  let hints = '';
  if(clues.length && !suspects.length) hints += '<div class="hint">No Suspects yet — add one to start connecting these Clues.</div>';
  if(suspects.length && !clues.length) hints += '<div class="hint">No Clues yet — add one to start connecting these Suspects.</div>';
  return `
  <div class="matrix-table-wrap">
    <table class="matrix-table">
      <thead><tr><th class="corner">Clues &#8595; / Suspects &#8594;</th>${suspectHeaders}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>
  ${hints}
  `;
}

function renderMystery(){
  const m = campaign().mystery;
  return `
  <h2 class="tool-title">One-Page Mystery Matrix</h2>
  <p class="tool-desc">Track Clues (rows) and Suspects (columns) — check a box wherever a Connection exists between them. Max 20 boxes.</p>

  <div class="card">
    <h3 class="block-title">Add to the Matrix</h3>
    <div class="row">
      <input type="text" id="newBoxLabel" class="field-input" style="flex:1; min-width:200px;" placeholder="Type a label, or leave blank and roll words">
      <button class="btn small" id="btnRollWordsForBox">Roll words</button>
      <button class="btn primary" id="btnAddClue">Add as Clue</button>
      <button class="btn primary" id="btnAddSuspect">Add as Suspect</button>
    </div>
    <div class="small-note">${m.boxes.length}/20 boxes used.</div>
  </div>

  <div class="card">
    <h3 class="block-title">Discovery Check</h3>
    <p class="small-note" style="margin-top:-4px;">Roll 1d100 + current box count against the Mystery Elements table, and the toolkit resolves the result automatically (new boxes, connections, or a Clincher).</p>
    <div class="row"><button class="btn primary" id="btnDiscoveryCheck">Roll Discovery Check</button></div>
    <div id="discoveryResult" style="margin-top:12px;">${lastDiscoveryHtml}</div>
  </div>

  <div class="card">
    <div class="row" style="justify-content:space-between; align-items:center;">
      <h3 class="block-title" style="border:none; margin:0; padding:0;">The Matrix (${m.boxes.length}/20)</h3>
      <button class="btn small danger" id="btnResetMatrix" ${m.boxes.length?'':'disabled'}>Reset Matrix</button>
    </div>
    <div class="divider" style="margin:10px 0 14px;"></div>
    ${renderMatrixTable(m)}
    ${m.solvedBoxUid ? `<div class="banner-solved">🔎 Mystery solved — the highlighted Suspect column is the answer.</div>` : ''}
  </div>
  `;
}

function addBox(type, label){
  const m = campaign().mystery;
  if(m.boxes.length>=20){ alert("The Matrix is full (20 boxes). Remove one first."); return null; }
  const box = { uid: m.nextUid++, type, label, connections: [] };
  m.boxes.push(box);
  persist();
  return box;
}
function rollMysteryWords(count){
  const words = [];
  for(let i=0;i<count;i++){ const r = rollDie(100); words.push(MYSTERY_DESCRIPTORS[r-1]); }
  return words;
}
function toggleConnection(uidA, uidB){
  const m = campaign().mystery;
  const a = boxByUid(uidA), b = boxByUid(uidB);
  if(!a || !b || a.type===b.type) return false;
  const idx = a.connections.indexOf(uidB);
  if(idx>=0){ a.connections.splice(idx,1); b.connections.splice(b.connections.indexOf(uidA),1); }
  else { a.connections.push(uidB); b.connections.push(uidA); }
  persist();
  checkClincherByConnections();
  return true;
}
function connectionExists(uidA, uidB){
  const a = boxByUid(uidA);
  return a ? a.connections.includes(uidB) : false;
}
function checkClincherByConnections(){
  const m = campaign().mystery;
  if(m.solvedBoxUid) return;
  const suspect = m.boxes.find(b=>b.type==='S' && b.connections.length>=6);
  if(suspect){
    m.solvedBoxUid = suspect.uid;
    persist();
    addLog('Mystery Matrix', `**Automatic Clincher** — Suspect "${escapeMd(suspect.label)}" reached 6+ Connections. **${escapeMd(suspect.label)}** is the answer to the mystery.`);
  }
}
// Roll a Matrix die sized to current box count; find target box of requiredType, applying the skip rule.
function rollMatrixTarget(requiredType, excludeUid){
  const boxes = campaign().mystery.boxes.filter(b=>excludeUid===undefined || b.uid!==excludeUid);
  if(!boxes.length) return null;
  const die = pickDie(boxes.length);
  const roll = rollDie(die);
  const overflow = roll > boxes.length;
  let startIdx = overflow ? boxes.length-1 : roll-1;
  for(let i=0;i<boxes.length;i++){
    const idx = (startIdx+i) % boxes.length;
    if(boxes[idx].type === requiredType) return { box: boxes[idx], roll, die, overflow };
  }
  return { box:null, roll, die, overflow };
}

function wireMystery(){
  document.getElementById('btnResetMatrix').addEventListener('click', ()=>{
    const m = campaign().mystery;
    if(!m.boxes.length) return;
    if(!confirm('Reset the Mystery Matrix? This removes all Clues, Suspects, and Connections for this campaign. This cannot be undone.')) return;
    m.boxes = [];
    m.nextUid = 1;
    m.solvedBoxUid = null;
    persist();
    addLog('Mystery Matrix', '**Matrix reset** — all Clues, Suspects, and Connections cleared.');
    lastDiscoveryHtml = '';
    renderActive();
  });
  document.getElementById('btnRollWordsForBox').addEventListener('click', ()=>{
    const words = rollMysteryWords(2);
    document.getElementById('newBoxLabel').value = words.join(' / ');
  });
  function doAdd(type){
    let label = document.getElementById('newBoxLabel').value.trim();
    let rolledNote = '';
    if(!label){
      const words = rollMysteryWords(2);
      label = words.join(' / ');
      rolledNote = ` (rolled: ${words.join(', ')})`;
    }
    const box = addBox(type, label);
    if(!box) return;
    addLog('Mystery Matrix', `**Added ${type==='C'?'Clue':'Suspect'}** — "${escapeMd(label)}"${rolledNote}`);
    renderActive();
  }
  document.getElementById('btnAddClue').addEventListener('click', ()=>doAdd('C'));
  document.getElementById('btnAddSuspect').addEventListener('click', ()=>doAdd('S'));

  document.querySelectorAll('[data-rm]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const uid = Number(btn.dataset.rm);
      const m = campaign().mystery;
      const box = boxByUid(uid);
      if(!confirm(`Remove "${box.label}" from the Matrix?`)) return;
      m.boxes.forEach(b=>{ b.connections = b.connections.filter(c=>c!==uid); });
      m.boxes = m.boxes.filter(b=>b.uid!==uid);
      if(m.solvedBoxUid===uid) m.solvedBoxUid = null;
      persist();
      addLog('Mystery Matrix', `**Removed** "${escapeMd(box.label)}" from the Matrix.`);
      renderActive();
    });
  });
  document.querySelectorAll('[data-edit]').forEach(el=>{
    el.addEventListener('blur', ()=>{
      const uid = Number(el.dataset.edit);
      const box = boxByUid(uid);
      const newLabel = el.value.trim();
      if(newLabel && newLabel!==box.label){
        box.label = newLabel;
        persist();
      } else {
        el.value = box.label;
      }
    });
    el.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){ e.preventDefault(); el.blur(); }
    });
  });
  document.querySelectorAll('input[type="checkbox"][data-clue]').forEach(cb=>{
    cb.addEventListener('change', ()=>{
      const clueUid = Number(cb.dataset.clue);
      const suspectUid = Number(cb.dataset.suspect);
      const a = boxByUid(clueUid), b = boxByUid(suspectUid);
      const wasConnected = connectionExists(clueUid, suspectUid);
      toggleConnection(clueUid, suspectUid);
      addLog('Mystery Matrix', `**${wasConnected?'Removed connection':'Connected'}** — "${escapeMd(a.label)}" ${wasConnected?'✕':'⟷'} "${escapeMd(b.label)}"`);
      renderActive();
    });
  });

  document.getElementById('btnDiscoveryCheck').addEventListener('click', ()=>{
    const m = campaign().mystery;
    const roll = rollDie(100);
    const total = roll + m.boxes.length;
    const result = mysteryElement(total);
    let lines = [`**Discovery Check** — Roll 1d100: ${roll} + ${m.boxes.length} boxes = **${total}**`];
    let htmlExtra = '';

    function newBoxFromRoll(type){
      const words = rollMysteryWords(2);
      const label = words.join(' / ');
      return { box: addBox(type, label), words };
    }

    if(result==='nothing'){
      lines.push('→ Nothing useful is found.');
    } else if(result==='newClue' || result==='newSuspect'){
      const type = result==='newClue' ? 'C':'S';
      const {box, words} = newBoxFromRoll(type);
      lines.push(`→ New Unconnected ${type==='C'?'Clue':'Suspect'} — rolled words: ${words.join(', ')} → **"${box.label}"**`);
    } else if(result==='newConnectedClue' || result==='newConnectedSuspect'){
      const type = result==='newConnectedClue' ? 'C':'S';
      const need = type==='C' ? 'S':'C';
      const {box, words} = newBoxFromRoll(type);
      const target = rollMatrixTarget(need, box.uid);
      lines.push(`→ New Connected ${type==='C'?'Clue':'Suspect'} — rolled words: ${words.join(', ')} → **"${box.label}"**`);
      if(target && target.box){
        toggleConnection(box.uid, target.box.uid);
        lines.push(`  - Matrix Roll (d${target.die}): ${target.roll}${target.overflow?' (over — auto-picked)':''} → connected to **"${target.box.label}"**`);
      } else {
        lines.push(`  - No compatible ${need==='C'?'Clue':'Suspect'} exists yet — left unconnected.`);
      }
    } else if(result==='connectExisting'){
      const total2 = m.boxes.length;
      if(total2<2){
        lines.push('→ Connect existing Clue & Suspect — not enough boxes yet; treated as Nothing useful.');
      } else {
        const die = pickDie(total2);
        const r1 = rollDie(die);
        const idx1 = (r1>total2 ? total2-1 : r1-1);
        const first = m.boxes[idx1];
        const need = first.type==='C' ? 'S':'C';
        const target = rollMatrixTarget(need, first.uid);
        if(target && target.box){
          const already = connectionExists(first.uid, target.box.uid);
          toggleConnection(first.uid, target.box.uid);
          lines.push(`→ Connect existing Clue & Suspect — Matrix Roll (d${die}): ${r1} → **"${first.label}"**, then d${target.die}: ${target.roll} → **"${target.box.label}"**`);
          lines.push(already ? '  - They were already connected — connection removed (toggled).' : '  - Connected.');
        } else {
          lines.push('→ Connect existing Clue & Suspect — no compatible box found; nothing useful.');
        }
      }
    } else if(result==='clincher'){
      const {box, words} = newBoxFromRoll('C');
      const target = rollMatrixTarget('S', box.uid);
      lines.push(`→ **CLINCHER CLUE** — rolled words: ${words.join(', ')} → **"${box.label}"**`);
      if(target && target.box){
        toggleConnection(box.uid, target.box.uid);
        m.solvedBoxUid = target.box.uid;
        persist();
        lines.push(`  - Matrix Roll (d${target.die}): ${target.roll}${target.overflow?' (over — auto-picked)':''} → connects to **"${target.box.label}"**`);
        lines.push(`  - 🔎 **"${target.box.label}" is the answer to the mystery.**`);
        htmlExtra = `<div class="banner-solved">🔎 Clincher! "${target.box.label}" is the answer to the mystery.</div>`;
      } else {
        lines.push('  - No Suspect exists yet to connect to — nothing useful is found instead.');
      }
    }
    lastDiscoveryHtml = `<div class="result-box">${lines.map(l=>l.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>')).join('<br>')}</div>${htmlExtra}`;
    addLog('Mystery Matrix', lines.join('\n'));
    renderActive();
  });
}

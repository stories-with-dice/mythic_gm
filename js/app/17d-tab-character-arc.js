/* =========================================================================
   CHARACTER ARC
   The "Arc Engine" by Samuel Taylor (3x5 Arcana, "Character Arc Engine",
   https://blog.3x5arcana.com/p/character-arc-engine), described in our own
   words. Each character has a few axes: two opposed traits, the one the
   character thinks they "should" follow and the one they "could" follow.
   The Axis Number (1-12) starts at 6 or 7. When a choice sets the two traits
   against each other, roll a d12:
   - under the number: the character acts on the should trait; the number
     goes up by 1 (should becomes more likely);
   - over the number: the could trait; the number goes down by 1;
   - exactly the number: roll again (and again), then move the number one
     point for each roll made, in the direction of the last roll.
   At 1 or 12 the arc is over (Act 5): the character acts that way from now
   on. Stop testing that axis; start a new one to continue.

   State: campaign().arc (freshArc() / sanitizeArc() in 03). The trait-pair
   suggestions are the editable RANDOM_TABLES entry `arcTraitPairs` (01).
   ========================================================================= */

// The last test of each axis (by axis id): the result HTML and the roll that
// ended it, so a re-render keeps them (see "re-render wipes transient result
// displays" in AGENTS.md). Not saved.
let arcResultHtml = {};
let arcLastRoll = {};
// What the user typed in each character's "New axis" fields (by character
// id): { should, could, start }. Not saved; a re-render keeps it.
let arcDraft = {};

function arcState(){
  const c = campaign();
  if(!c.arc || typeof c.arc !== 'object') c.arc = freshArc();   // a sessionStorage campaign from before the tab
  return c.arc;
}
function arcChar(id){ return arcState().chars.find(c => c.id === id) || null; }
function arcAxis(id){
  for(const c of arcState().chars){
    const a = c.axes.find(x => x.id === id);
    if(a) return { char: c, axis: a };
  }
  return null;
}
// 'should' at 12, 'could' at 1, else null (the arc goes on).
function arcAct5(value){ return value >= ARC_SIDES ? 'should' : value <= 1 ? 'could' : null; }
// The chance that a test comes up should: the faces under the number, out of
// the faces that are not a tie (a tie rolls again).
function arcShouldChance(value){ return (value - 1) / (ARC_SIDES - 1); }

// One test of an Axis Number. Pure apart from rollDie(). Returns
// { rolls, side, from, to, shift }: `rolls` are every d12 rolled (ties
// first), `side` is 'should' or 'could', `shift` is the number of rolls.
function arcTest(value){
  const rolls = [];
  let r;
  do {
    r = rollDie(ARC_SIDES);
    rolls.push(r);
  } while(r === value && rolls.length < 50);   // the cap only guards a broken die
  const side = r < value ? 'should' : 'could';
  const shift = rolls.length;
  const to = Math.max(1, Math.min(ARC_SIDES, value + (side === 'should' ? shift : -shift)));
  return { rolls, side, from: value, to, shift };
}

// A d66 on the trait-pair table: { code, should, could }. A row without a
// "/" gives its whole text as the should trait and leaves could empty.
function arcSplitPair(row){
  const i = row.indexOf('/');
  if(i < 0) return { should: row.trim(), could: '' };
  return { should: row.slice(0, i).trim(), could: row.slice(i + 1).trim() };
}
function arcRollPair(){
  const tens = rollDie(6), ones = rollDie(6);
  const row = tableEntry('arcTraitPairs', (tens - 1) * 6 + ones);
  return Object.assign({ code: `${tens}${ones}` }, arcSplitPair(row));
}

function arcDraftOf(charId){
  if(!arcDraft[charId]) arcDraft[charId] = { should: '', could: '', start: 'coin' };
  return arcDraft[charId];
}

/* ----- markup ----- */

// The 1-12 line: faces under the number are should, over it could, the
// number itself is a tie. The last roll gets a ring.
function arcLineHtml(axis){
  const last = arcLastRoll[axis.id];
  let cells = '';
  for(let i = 1; i <= ARC_SIDES; i++){
    const side = i < axis.value ? 'should' : i > axis.value ? 'could' : 'mark';
    cells += `<span class="arc-cell ${side}${i === last ? ' last' : ''}">${i}</span>`;
  }
  return `<div class="arc-line" role="img" aria-label="Axis Number ${axis.value} of ${ARC_SIDES}: a roll under ${axis.value} is ${escapeAttr(axis.should)}, over ${axis.value} is ${escapeAttr(axis.could)}">${cells}</div>`;
}

function arcAxisHtml(axis){
  const done = arcAct5(axis.value);
  const pct = Math.round(arcShouldChance(axis.value) * 100);
  const status = done
    ? `<div class="arc-done"><b>Act 5:</b> ${escapeAttr(done === 'should' ? axis.should : axis.could)}. The arc is over: the character acts this way from now on. Start a new axis to go on.</div>`
    : `<div class="small-note">Under ${axis.value}: <b>${escapeAttr(axis.should)}</b> (${pct}%). Over ${axis.value}: <b>${escapeAttr(axis.could)}</b> (${100 - pct}%). Exactly ${axis.value}: roll again. ${axis.tests} test${axis.tests === 1 ? '' : 's'} so far.</div>`;
  return `<div class="arc-axis${done ? ' is-done' : ''}">
    <div class="arc-axis-head">
      <span class="arc-trait should">${escapeAttr(axis.should)}</span>
      <span class="arc-num" title="Axis Number">${axis.value}</span>
      <span class="arc-trait could">${escapeAttr(axis.could)}</span>
    </div>
    ${arcLineHtml(axis)}
    ${status}
    <div class="row arc-axis-btns">
      <button class="btn primary small" data-arc-test="${axis.id}" ${done ? 'disabled' : ''}>Test (roll d12)</button>
      <button class="btn small" data-arc-shift="${axis.id}:-1" aria-label="Move the Axis Number down by 1" title="Move the number by hand" ${axis.value <= 1 ? 'disabled' : ''}>&minus;1</button>
      <button class="btn small" data-arc-shift="${axis.id}:1" aria-label="Move the Axis Number up by 1" title="Move the number by hand" ${axis.value >= ARC_SIDES ? 'disabled' : ''}>+1</button>
      <button class="btn small danger" data-arc-axis-rm="${axis.id}" aria-label="Remove the axis ${escapeAttr(axis.should)} / ${escapeAttr(axis.could)}">Remove</button>
    </div>
    <div data-arc-result="${axis.id}">${arcResultHtml[axis.id] || ''}</div>
  </div>`;
}

function arcCharHtml(c){
  const d = arcDraftOf(c.id);
  const full = c.axes.length >= ARC_MAX_AXES;
  const startOpt = (v, label) => `<option value="${v}" ${d.start === v ? 'selected' : ''}>${label}</option>`;
  return `<div class="card arc-char" data-arc-char="${c.id}">
    <div class="row arc-char-head">
      <input type="text" class="field-input arc-name" data-arc-name="${c.id}" maxlength="60" value="${escapeAttr(c.name)}" aria-label="Character name">
      <button class="btn small danger" data-arc-char-rm="${c.id}" aria-label="Remove ${escapeAttr(c.name)}">Remove character</button>
    </div>
    ${c.axes.length ? c.axes.map(arcAxisHtml).join('') : '<div class="small-note">No axes yet. Add two or three below.</div>'}
    <div class="arc-new">
      <h4 class="to-sub">New axis</h4>
      <div class="arc-new-fields">
        <div class="field">
          <label for="arcShould_${c.id}">Should (a roll under the number)</label>
          <input type="text" id="arcShould_${c.id}" class="field-input" data-arc-draft="${c.id}:should" maxlength="${ARC_TRAIT_MAX}" value="${escapeAttr(d.should)}" placeholder="e.g. Loyalty" ${full ? 'disabled' : ''}>
        </div>
        <div class="field">
          <label for="arcCould_${c.id}">Could (a roll over the number)</label>
          <input type="text" id="arcCould_${c.id}" class="field-input" data-arc-draft="${c.id}:could" maxlength="${ARC_TRAIT_MAX}" value="${escapeAttr(d.could)}" placeholder="e.g. Passion" ${full ? 'disabled' : ''}>
        </div>
        <div class="field">
          <label for="arcStart_${c.id}">Start at</label>
          <select id="arcStart_${c.id}" class="field-input" data-arc-start="${c.id}" ${full ? 'disabled' : ''}>
            ${startOpt('coin', 'Flip a coin (6 or 7)')}${startOpt('6', '6')}${startOpt('7', '7')}
          </select>
        </div>
      </div>
      <div class="row" style="margin-top:8px;">
        <button class="btn small" data-arc-suggest="${c.id}:pair" title="Roll a d66 on the trait pairs" ${full ? 'disabled' : ''}>Roll pair</button>
        <button class="btn small" data-arc-suggest="${c.id}:should" title="Roll a d66 and keep the Should trait" ${full ? 'disabled' : ''}>Roll Should</button>
        <button class="btn small" data-arc-suggest="${c.id}:could" title="Roll a d66 and keep the Could trait" ${full ? 'disabled' : ''}>Roll Could</button>
        <button class="btn" data-arc-axis-add="${c.id}" ${full ? 'disabled' : ''}>Add axis</button>
      </div>
      ${full ? `<div class="small-note">At most ${ARC_MAX_AXES} axes per character. Remove one to add another.</div>` : ''}
    </div>
  </div>`;
}

function renderCharacterArc(){
  const s = arcState();
  const full = s.chars.length >= ARC_MAX_CHARS;
  return `
  ${tabHeader('Character Arc', `Let the dice move a character between two traits over many sessions (the <i>Arc Engine</i> by Samuel Taylor, 3x5 Arcana). Give each character two or three <b>axes</b>: the trait they think they <b>should</b> follow, and the one they <b>could</b> follow instead. Each axis has an Axis Number from 1 to 12 that starts at 6 or 7. When a choice sets the two traits against each other, and the player wants to, <b>Test</b> the axis: a d12 under the number is the should trait and moves the number up, a roll over it is the could trait and moves it down. A roll equal to the number rolls again, and the number moves one point for each roll. At 1 or 12 the arc is over (<b>Act 5</b>). This tab does not use the Mythic Chaos Factor or Lists.`)}

  <div class="card">
    <h3 class="block-title">Characters</h3>
    <div class="row">
      <input type="text" id="arcNewChar" class="field-input" style="flex:1; min-width:180px;" maxlength="60" placeholder="e.g. Juliet" ${full ? 'disabled' : ''}>
      <button class="btn" id="btnArcAddChar" ${full ? 'disabled' : ''}>Add character</button>
    </div>
    <div class="small-note" style="margin-top:6px;">The trait pairs that Roll pair / Roll Should / Roll Could use are a d66 table; edit them in &#9881; Settings (Character Arc).</div>
    ${s.chars.length ? '' : '<div class="small-note" style="margin-top:10px;">No characters yet.</div>'}
  </div>
  ${s.chars.map(arcCharHtml).join('')}
  `;
}

/* ----- actions ----- */

function arcLabel(c, a){ return `${c.name}: ${a.should} / ${a.could}`; }

function arcRunTest(axisId){
  const found = arcAxis(axisId);
  if(!found || arcAct5(found.axis.value)) return;
  const { char: c, axis: a } = found;
  const t = arcTest(a.value);
  a.value = t.to;
  a.tests += 1;
  arcLastRoll[a.id] = t.rolls[t.rolls.length - 1];
  const trait = t.side === 'should' ? a.should : a.could;
  const ties = t.rolls.length > 1 ? ` (${t.rolls.length - 1} tie${t.rolls.length > 2 ? 's' : ''}: the number moves ${t.shift} points)` : '';
  const end = arcAct5(t.to);
  const act5 = end ? ` **Act 5:** ${escapeMd(end === 'should' ? a.should : a.could)}, from now on.` : '';
  persist();
  addLog('Character Arc', `**${escapeMd(arcLabel(c, a))}** — d12 ${t.rolls.join(', ')} → **${escapeMd(trait)}** (${t.side}). Axis Number ${t.from} → ${t.to}${ties}.${act5}`);
  arcResultHtml[a.id] = `<div class="result-box ${t.side === 'should' ? 'yes' : 'no'}">
    d12 <span class="roll-num">${t.rolls.join(', ')}</span> &rarr; <b>${escapeAttr(trait)}</b> (${t.side})<br>
    <span class="small-note">Axis Number ${t.from} &rarr; ${t.to}${t.rolls.length > 1 ? `, ${t.shift} points after ${t.rolls.length - 1} tie${t.rolls.length > 2 ? 's' : ''}` : ''}.</span>
    ${end ? `<div><b>Act 5.</b> ${escapeAttr(c.name)} is ${escapeAttr(end === 'should' ? a.should : a.could)} from now on.</div>` : ''}
  </div>`;
  renderActive();
}

function arcAddAxis(charId){
  const c = arcChar(charId);
  if(!c || c.axes.length >= ARC_MAX_AXES) return;
  const d = arcDraftOf(charId);
  const should = d.should.replace(/[<>]/g, '').trim().slice(0, ARC_TRAIT_MAX);
  const could = d.could.replace(/[<>]/g, '').trim().slice(0, ARC_TRAIT_MAX);
  if(!should || !could){
    const missing = document.getElementById((should ? 'arcCould_' : 'arcShould_') + charId);
    if(missing) missing.focus();
    return;
  }
  const s = arcState();
  const coin = d.start === 'coin';
  const value = coin ? 5 + rollDie(2) : Number(d.start);
  const axis = { id: s.nextAxisId++, should, could, value, tests: 0 };
  c.axes.push(axis);
  arcDraft[charId] = { should: '', could: '', start: d.start };
  persist();
  addLog('Character Arc', `**${escapeMd(arcLabel(c, axis))}** — new axis, Axis Number ${value}${coin ? ' (coin flip)' : ''}.`);
  renderActive();
}

function arcSuggest(charId, what){
  const p = arcRollPair();
  const d = arcDraftOf(charId);
  if(what !== 'could') d.should = p.should;
  if(what !== 'should' && p.could) d.could = p.could;
  renderActive();
}

function arcRemoveAxis(axisId){
  const found = arcAxis(axisId);
  if(!found) return;
  const { char: c, axis: a } = found;
  const i = c.axes.indexOf(a);
  c.axes.splice(i, 1);
  persist();
  renderActive();
  showUndoToast(`Removed the axis ${a.should} / ${a.could}.`, () => {
    const back = arcChar(c.id);
    if(!back || back.axes.length >= ARC_MAX_AXES) return;
    back.axes.splice(Math.min(i, back.axes.length), 0, a);
    persist();
    renderActive();
  });
}

function arcRemoveChar(charId){
  const s = arcState();
  const i = s.chars.findIndex(c => c.id === charId);
  if(i < 0) return;
  const [c] = s.chars.splice(i, 1);
  delete arcDraft[charId];
  persist();
  renderActive();
  showUndoToast(`Removed ${c.name}.`, () => {
    const now = arcState();
    if(now.chars.length >= ARC_MAX_CHARS || now.chars.some(x => x.id === c.id)) return;
    now.chars.splice(Math.min(i, now.chars.length), 0, c);
    persist();
    renderActive();
  });
}

function wireCharacterArc(){
  const host = document.getElementById('btnArcAddChar').closest('.card').parentElement;
  const all = sel => host.querySelectorAll(sel);
  const pair = v => { const [a, b] = v.split(':'); return [Number(a), b]; };

  const addChar = () => {
    const input = document.getElementById('arcNewChar');
    const name = input.value.trim().slice(0, 60);
    const s = arcState();
    if(!name || s.chars.length >= ARC_MAX_CHARS){ input.focus(); return; }
    s.chars.push({ id: s.nextCharId++, name, axes: [] });
    persist();
    addLog('Character Arc', `**${escapeMd(name)}** added.`);
    renderActive();
    const next = document.getElementById('arcNewChar');
    if(next) next.focus();
  };
  document.getElementById('btnArcAddChar').addEventListener('click', addChar);
  document.getElementById('arcNewChar').addEventListener('keydown', e => {
    if(e.key === 'Enter' && !isComposing(e)){ e.preventDefault(); addChar(); }
  });

  // A rename saves on change, without a re-render, so the focus moves on normally.
  all('[data-arc-name]').forEach(el => el.addEventListener('change', () => {
    const c = arcChar(Number(el.dataset.arcName));
    if(!c) return;
    const name = el.value.trim().slice(0, 60);
    if(!name){ el.value = c.name; return; }
    c.name = name;
    persist();
  }));
  all('[data-arc-char-rm]').forEach(b => b.addEventListener('click', () => arcRemoveChar(Number(b.dataset.arcCharRm))));

  all('[data-arc-draft]').forEach(el => {
    const [id, field] = pair(el.dataset.arcDraft);
    el.addEventListener('input', () => { arcDraftOf(id)[field] = el.value; });
    el.addEventListener('keydown', e => {
      if(e.key === 'Enter' && !isComposing(e)){ e.preventDefault(); arcAddAxis(id); }
    });
  });
  all('[data-arc-start]').forEach(el => el.addEventListener('change', () => {
    arcDraftOf(Number(el.dataset.arcStart)).start = el.value;
  }));
  all('[data-arc-suggest]').forEach(b => b.addEventListener('click', () => {
    const [id, what] = pair(b.dataset.arcSuggest);
    arcSuggest(id, what);
  }));
  all('[data-arc-axis-add]').forEach(b => b.addEventListener('click', () => arcAddAxis(Number(b.dataset.arcAxisAdd))));

  all('[data-arc-test]').forEach(b => b.addEventListener('click', () => arcRunTest(Number(b.dataset.arcTest))));
  // A hand correction of the Axis Number (a misclick, a table ruling).
  all('[data-arc-shift]').forEach(b => b.addEventListener('click', () => {
    const [id, by] = b.dataset.arcShift.split(':').map(Number);
    const found = arcAxis(id);
    if(!found) return;
    const a = found.axis;
    const from = a.value;
    a.value = Math.max(1, Math.min(ARC_SIDES, a.value + by));
    if(a.value === from) return;
    persist();
    const end = arcAct5(a.value);
    addLog('Character Arc', `**${escapeMd(arcLabel(found.char, a))}** — Axis Number set by hand: ${from} → ${a.value}.${end ? ` **Act 5:** ${escapeMd(end === 'should' ? a.should : a.could)}.` : ''}`);
    delete arcResultHtml[a.id];
    delete arcLastRoll[a.id];
    renderActive();
  }));
  all('[data-arc-axis-rm]').forEach(b => b.addEventListener('click', () => arcRemoveAxis(Number(b.dataset.arcAxisRm))));
}

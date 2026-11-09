/* =========================================================================
   TAB: TRIPLE-O  (Triple-O: The Player Character Emulator, v1.0.2, by
   Cezar Capacle)
   -------------------------------------------------------------------------
   Play solo from the GM's seat: the app emulates the player characters.
   When a character must act and the choice is not clear, define their
   Triple-O (the Obvious, the Option, the Odd) and roll the Triple-O Check:
   1d6, 4-6 = the Obvious, 2-3 = the Option, 1 = the Odd.

   Four procedures share that one roll (`draft.mode`):
     - action:   three possible actions of one character;
     - question: "Would they consider…?" with three answers (Yes/No, And/But);
     - group:    three courses of action for the party. "Rank by dice"
                 rolls 1d6 per course: highest = Obvious, lowest = Odd;
     - check:    three possible outcomes of an action (Triple-O as a
                 minimal resolution system).
   Double-Down: roll 2d6 and keep the die you like. Doubles add something,
   by mode: a Prevalent Trait (action), an instinct Trait (question), a
   party Trait (group), a temporary condition Trait (check).

   State: `campaign().tripleO` (03-state-persistence.js) — the Trait Sheets
   (`chars`), the party Traits (`party`) and the Check being set up
   (`draft`). The tables are in 01b-triple-o-tables.js (CC BY-SA 4.0).
   The rule summaries in this file (TRIPLE_O_FLOW_HTML, the mode texts) are
   adapted from the zine and are shared under CC BY-SA 4.0 too.
   ========================================================================= */

const TRIPLE_O_BANDS = ['obvious', 'option', 'odd'];
const TRIPLE_O_BAND_LABEL = { obvious: 'The Obvious', option: 'The Option', odd: 'The Odd' };
const TRIPLE_O_STATUS_LABEL = { default: 'Default', prevalent: 'Prevalent', temporary: 'Temporary' };
// Category tags the zine suggests for the Trait Sheet (any short text is allowed).
const TRIPLE_O_CATEGORIES = [
  ['CL', 'class'], ['PR', 'personality'], ['SK', 'skill'], ['BG', 'background'], ['MT', 'motivation'], ['CN', 'condition']
];

// Per mode: the title, what the three entries are, their prompts, and what doubles add.
const TRIPLE_O_MODE_INFO = {
  action: {
    label: 'Action', title: 'What does the character do?',
    hint: 'Define three possible actions from their Traits and the current situation. A few words are enough.',
    prompts: { obvious: 'Most predictable action', option: 'Another sensible action', odd: 'Unexpected behavior' },
    doubles: 'Doubles: this behavior becomes more prevalent. Mark the Trait it reflects as Prevalent, or add a new Trait.'
  },
  question: {
    label: 'Question', title: 'Would they consider…?',
    hint: 'Ask whether the character acts without a prompt: notices a detail, checks for danger, thinks of the clever solution. Each entry is one answer: Yes, No, Yes and…, No but…',
    prompts: { obvious: 'e.g. Yes, and confidently', option: 'e.g. Yes, but with caution', odd: 'e.g. No, and distracted' },
    doubles: 'Doubles: an instinctive behavior starts to emerge. Note it as a Trait if it is worth tracking.'
  },
  group: {
    label: 'Group Action', title: 'What does the party decide?',
    hint: 'Write three courses of action, ideally each from a different character. If one is clearly dominant (a leader, the expert), put it first. Otherwise use Rank by dice: 1d6 each, highest = Obvious, lowest = Odd.',
    prompts: { obvious: 'The group\'s best choice', option: 'A second course of action', odd: 'The least likely direction' },
    doubles: 'Doubles: a party Trait emerges, a kind of decision that becomes more common in future group choices.'
  },
  check: {
    label: 'Check', title: 'How does the attempt turn out?',
    hint: 'Use the Triple-O Check to resolve an action without your system\'s rules. Look at the character\'s Traits, condition and the risk, then define three outcomes. They need not run from failure to success.',
    prompts: { obvious: 'The most likely outcome', option: 'A less expected outcome', odd: 'The surprise outcome' },
    doubles: 'Doubles: on a good outcome, a momentary opportunity or a temporary positive condition (inspired, emboldened). On a bad outcome, a complication (wounded, uncertain, a cost). Add it as a Temporary Trait.'
  }
};

// The Spark combinations the zine suggests (Random Tables chapter).
const TRIPLE_O_COMBOS = [
  { id: 'af', label: 'Action + Focus', keys: ['toAction', 'toFocus'], use: 'what they do, and what they pay attention to' },
  { id: 'am', label: 'Action + Method', keys: ['toAction', 'toMethod'], use: 'what they do, and how' },
  { id: 'amo', label: 'Action + Motivation', keys: ['toAction', 'toMotivation'], use: 'what they do, and why' },
  { id: 'npc', label: 'Improvise an NPC', keys: ['toAction', 'toFocus', 'toDisposition', 'toMotivation', 'toMethod'], use: 'an NPC, monster or faction: doing, concerned with, attitude, wants, operates by' }
];
// "Spark a Trait" on a Trait Sheet: the tables the zine uses to make Traits.
const TRIPLE_O_TRAIT_SPARKS = [
  { key: 'toDisposition', category: 'PR' },
  { key: 'toMotivation', category: 'MT' },
  { key: 'toMethod', category: 'SK' },
  { key: 'toDynamics', category: '' },
  { key: 'af', category: '' }
];

// "Fill 3 Traits": one Trait from each of these tables, with its category.
const TRIPLE_O_FILL_KEYS = ['toDisposition', 'toMotivation', 'toMethod'];

// Transient view state (not saved; see "re-rendering wipes transient
// result displays" in AGENTS.md — every result renders from these).
let toResult = null;      // last Triple-O Check: {mode, whoId, question, entries, dice, kept, band, doubles}
let toPending = null;     // Double-Down waiting for a pick: {mode, whoId, question, entries, dice}
let toRankHtml = '';      // last Rank by dice result
let toSpark = null;       // last spark roll: {label, parts:[{table, code, text, opp}], text}
let toEditChars = new Set();   // Trait Sheets open for editing (character ids)
let toRefOpen = false;    // Reference tables card
let toTraitRoll = null;   // last Trait roll: {owner, text, status, roll, total}

function tripleO(){
  const c = campaign();
  if(!c.tripleO || typeof c.tripleO !== 'object') c.tripleO = freshTripleO();   // a sessionStorage campaign from before the tab
  return c.tripleO;
}
function tripleOBand(d){ return d >= 4 ? 'obvious' : d >= 2 ? 'option' : 'odd'; }
function tripleOChar(id){ return tripleO().chars.find(ch => ch.id === Number(id)) || null; }

// One d66 roll on a Triple-O table: {table, code:'34', text, opp:{code, text}}.
// `opp` is the "opposite combination" (43 for 34) that the zine suggests
// when a specific-table result does not fit.
function tripleORoll(key){
  const tens = rollDie(6), ones = rollDie(6);
  const t = TRIPLE_O_TABLE_BY_KEY[key];
  return {
    table: t.label, key,
    code: `${tens}${ones}`,
    text: tableEntry(key, tripleOIndex(tens, ones)),
    opp: tens === ones ? null : { code: `${ones}${tens}`, text: tableEntry(key, tripleOIndex(ones, tens)) }
  };
}
// A Spark roll: one table key, or a combo id from TRIPLE_O_COMBOS.
function tripleOSpark(id){
  const combo = TRIPLE_O_COMBOS.find(c => c.id === id);
  const keys = combo ? combo.keys : [id];
  const parts = keys.map(tripleORoll);
  return { label: combo ? combo.label : TRIPLE_O_TABLE_BY_KEY[id].label, parts, text: parts.map(p => p.text).join(' + ') };
}

// Trait status cycle for a click on a Trait chip under "Who acts?":
// Default → Prevalent → Temporary → Default.
const TRIPLE_O_STATUS_NEXT = { default: 'prevalent', prevalent: 'temporary', temporary: 'default' };
// Trait roll weight: a Prevalent Trait counts twice.
function tripleOTraitWeight(t){ return t.status === 'prevalent' ? 2 : 1; }
// A weighted random pick on a list of Traits: one die with as many sides as
// the total weight, walked in list order. `items` = [{owner, trait}].
// Returns {index, owner, trait, roll, total}, or null for an empty list.
function tripleORollTrait(items){
  if(!items.length) return null;
  const total = items.reduce((n, it) => n + tripleOTraitWeight(it.trait), 0);
  const roll = rollDie(total);
  let acc = 0;
  for(let i = 0; i < items.length; i++){
    acc += tripleOTraitWeight(items[i].trait);
    if(roll <= acc) return { index: i, owner: items[i].owner, trait: items[i].trait, roll, total };
  }
  return null;
}
// The Traits a Trait roll uses: the picked character's, or in group mode
// every character's Traits together (not the party Traits).
function tripleOTraitPool(){
  const s = tripleO();
  if(s.draft.mode === 'group'){
    return s.chars.flatMap(c => c.traits.map(trait => ({ owner: c.name, trait })));
  }
  const ch = tripleOChar(s.draft.who);
  return ch ? ch.traits.map(trait => ({ owner: ch.name, trait })) : [];
}

// Rank by dice (Group Actions, step 3): 1d6 per course, highest = Obvious,
// middle = Option, lowest = Odd. The rules do not cover ties: the app rolls
// all three again until the dice differ (a judgment call, written to the log).
function tripleORank(courses){
  let rolls, rerolls = 0;
  do {
    rolls = courses.map(() => rollDie(6));
    if(new Set(rolls).size === rolls.length) break;
    rerolls++;
  } while(rerolls < 50);
  const order = courses.map((text, i) => ({ text, roll: rolls[i] })).sort((a, b) => b.roll - a.roll);
  return { order, rolls, rerolls };
}

const TRIPLE_O_FLOW_HTML = `
<div class="pub-flow">
  <div class="flow-group">
    <h4>Setting things up</h4>
    <div class="flow-step"><b>Pick an adventure</b> (a module or your own prep) and <b>grab 2&ndash;4 characters</b> in any system.</div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>Note 3&ndash;5 Traits</b> per character on a Trait Sheet: class, background, beliefs, goals, fears, vices. Short snippets work best ("Cautious to a fault"). The spark tables (Disposition, Motivation, Method, Dynamics) can make more.</div>
  </div>
  <div class="flow-group">
    <h4>When a character must act</h4>
    <div class="flow-step">Is the choice <b>obvious</b> from their Traits? Then they do it: use your system's rules as usual. Most actions go this way.</div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step">Not sure, high stakes, or you want a surprise? <b>Define their Triple-O</b>: the <b>Obvious</b> (most predictable), the <b>Option</b> (an alternative that still fits), the <b>Odd</b> (unexpected). You can leave the Option and the Odd blank until the roll asks for them.</div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>Triple-O Check, 1d6:</b> 4&ndash;6 the Obvious (50%) &middot; 2&ndash;3 the Option (33%) &middot; 1 the Odd (17%). Roll once per character. Then resolve the action with your system, or with a Check.</div>
  </div>
  <div class="flow-group">
    <h4>Four procedures, one roll</h4>
    <ul class="flow-branch">
      <li><b>Action</b> &mdash; three possible actions.</li>
      <li><b>Question</b> &mdash; "Would they consider&hellip;?" Three answers: Yes / No, And / But.</li>
      <li><b>Group Action</b> &mdash; three courses for the party. A dominant one is the Obvious; otherwise 1d6 each: highest = Obvious, lowest = Odd.</li>
      <li><b>Check</b> &mdash; three possible outcomes instead of actions.</li>
    </ul>
  </div>
  <div class="flow-group">
    <h4>Double-Down</h4>
    <div class="flow-step">One result feels more likely? <b>Roll 2d6 and keep the die you like.</b></div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>Doubles:</b> Action &rarr; mark the Trait as <b>Prevalent</b> (or add one) &middot; Question &rarr; an instinct, add a Trait &middot; Group &rarr; a <b>party Trait</b> &middot; Check &rarr; an opportunity or a complication, as a <b>Temporary</b> Trait.</div>
    <div class="flow-loop">Temporary Traits (an injured leg, shaken) shape the next Triple-Os. What was Odd can become the new Obvious.</div>
  </div>
</div>`;

/* ----- render helpers ----- */
// A Trait chip. With `ref` ("<charId>:<i>" or "party:<i>") it is a button:
// a click moves the Trait to the next status (TRIPLE_O_STATUS_NEXT).
function tripleOTraitChip(t, ref){
  const star = t.status === 'prevalent' ? '&#9733; ' : '';
  const cat = t.category ? ` <span class="to-cat">${escapeAttr(t.category)}</span>` : '';
  const label = TRIPLE_O_STATUS_LABEL[t.status];
  if(ref != null){
    const next = TRIPLE_O_STATUS_LABEL[TRIPLE_O_STATUS_NEXT[t.status]];
    return `<button type="button" class="word-chip to-trait to-trait-btn ${t.status}" data-to-tstat="${ref}" title="${label} Trait. Click to make it ${next}." aria-label="${escapeAttr(t.text)}: ${label}. Click to make it ${next}.">${star}${escapeAttr(t.text)}${cat}</button>`;
  }
  return `<span class="word-chip to-trait ${t.status}" title="${label} Trait">${star}${escapeAttr(t.text)}${cat}</span>`;
}
function tripleOTraitChips(traits, empty, owner){
  return traits.length ? traits.map((t, i) => tripleOTraitChip(t, owner == null ? null : `${owner}:${i}`)).join('') : `<span class="small-note">${empty}</span>`;
}

// The last Trait roll.
function tripleOTraitRollHtml(){
  const r = toTraitRoll;
  if(!r) return '';
  return `<div class="result-box event to-trait-roll">
    Trait roll: 1d${r.total} <span class="roll-num">${r.roll}</span> &rarr; ${escapeAttr(r.owner)}: <b>${r.status === 'prevalent' ? '&#9733; ' : ''}${escapeAttr(r.text)}</b>
    <span class="small-note">(${TRIPLE_O_STATUS_LABEL[r.status]}${r.status === 'prevalent' ? ', weighted &times;2' : ''})</span>
  </div>`;
}

// The doubles follow-up inside a Check result: mark a Trait Prevalent, or add a Trait.
function tripleODoublesHtml(r){
  const info = TRIPLE_O_MODE_INFO[r.mode];
  const keptText = r.entries[r.band] || '';
  let body = '';
  if(r.mode === 'group'){
    body = `<div class="row" style="margin-top:6px;">
      <input type="text" id="toDoublesText" class="field-input" style="flex:1; min-width:180px;" maxlength="80" value="${escapeAttr(keptText)}" placeholder="e.g. Rest when hurt">
      <button class="btn small" id="btnToDoublesParty">Add party Trait</button>
    </div>`;
  } else {
    const ch = tripleOChar(r.whoId);
    const status = r.mode === 'check' ? 'temporary' : 'default';
    const markRow = r.mode === 'action' && ch && ch.traits.some(t => t.status !== 'prevalent') ? `<div class="row" style="margin-top:6px;">
      <select id="toDoublesMark" class="field-input">${ch.traits.map((t, i) => t.status === 'prevalent' ? '' : `<option value="${i}">${escapeAttr(t.text)}</option>`).join('')}</select>
      <button class="btn small" id="btnToDoublesMark">Mark Prevalent</button>
    </div>` : '';
    body = ch ? `${markRow}<div class="row" style="margin-top:6px;">
      <input type="text" id="toDoublesText" class="field-input" style="flex:1; min-width:180px;" maxlength="80" value="${r.mode === 'check' ? '' : escapeAttr(keptText)}" placeholder="${r.mode === 'check' ? 'e.g. Emboldened, Wounded arm' : 'New Trait'}">
      <button class="btn small" id="btnToDoublesAdd" data-status="${status}">Add ${status === 'temporary' ? 'Temporary ' : ''}Trait to ${escapeAttr(ch.name)}</button>
    </div>` : `<div class="small-note">Pick a character for the Check to add a Trait from here.</div>`;
  }
  return `<div class="banner-note" style="margin-top:8px;">${info.doubles}${body}</div>`;
}

function tripleOResultHtml(){
  if(toPending){
    const p = toPending;
    const btn = (d, i) => {
      const band = tripleOBand(d);
      const text = p.entries[band];
      return `<button class="btn" data-to-keep="${i}"><span class="roll-num">${d}</span> &rarr; <b>${TRIPLE_O_BAND_LABEL[band]}</b>${text ? `: ${escapeAttr(text)}` : ''}</button>`;
    };
    return `<div class="result-box event">Double-Down: 2d6 = <span class="roll-num">${p.dice[0]}</span> and <span class="roll-num">${p.dice[1]}</span>. Keep the die that feels right:
      <div class="row" style="margin-top:8px;">${p.dice.map(btn).join('')}</div></div>`;
  }
  if(!toResult) return '';
  const r = toResult;
  const ch = tripleOChar(r.whoId);
  const text = r.entries[r.band];
  const diceText = r.dice.length > 1 ? `2d6 ${r.dice.join(' / ')}, kept <span class="roll-num">${r.kept}</span>` : `1d6 <span class="roll-num">${r.kept}</span>`;
  const who = r.mode === 'group' ? 'The party' : (ch ? escapeAttr(ch.name) : '');
  return `<div class="result-box ${r.band === 'odd' ? 'no' : r.band === 'option' ? 'event' : ''}">
    ${TRIPLE_O_MODE_INFO[r.mode].label}${who ? ` &middot; ${who}` : ''}${r.question ? ` &middot; <i>${escapeAttr(r.question)}</i>` : ''}<br>
    ${diceText} &rarr; <b class="to-band ${r.band}">${TRIPLE_O_BAND_LABEL[r.band]}</b>:
    ${text ? `<b>${escapeAttr(text)}</b>` : '<i>not defined yet. Define it now: use the Spark tables below for ideas.</i>'}
    ${r.doubles ? tripleODoublesHtml(r) : ''}
  </div>`;
}

function tripleOSheetHtml(ch){
  const editing = toEditChars.has(ch.id);
  const counts = TRIPLE_O_STATUSES.map(s => [s, ch.traits.filter(t => t.status === s).length]).filter(x => x[1]);
  if(!editing){
    const summary = counts.length ? counts.map(([st, n]) => `${n} ${TRIPLE_O_STATUS_LABEL[st]}`).join(' &middot; ') : 'No Traits yet';
    return `<div class="to-sheet-row">
      <span class="to-name">${escapeAttr(ch.name)}</span>
      <span class="to-sheet-details">${ch.details ? escapeAttr(ch.details) : ''}</span>
      <span class="to-sheet-count">${summary}</span>
      <button class="btn small" data-to-edit="${ch.id}">Edit sheet</button>
    </div>`;
  }
  const rows = ch.traits.map((t, i) => `<tr class="to-trait-row ${t.status}">
      <td><select class="field-input to-status" data-to-status="${ch.id}:${i}" aria-label="Status">${TRIPLE_O_STATUSES.map(s => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${TRIPLE_O_STATUS_LABEL[s]}</option>`).join('')}</select></td>
      <td><input type="text" class="field-input to-text" data-to-text="${ch.id}:${i}" maxlength="80" value="${escapeAttr(t.text)}" aria-label="Trait"></td>
      <td><input type="text" class="field-input to-catin" data-to-cat="${ch.id}:${i}" maxlength="6" list="toCategoryList" value="${escapeAttr(t.category)}" aria-label="Category"></td>
      <td><button type="button" class="btn small" data-to-trait-rm="${ch.id}:${i}" title="Remove Trait" aria-label="Remove Trait">&#10005;</button></td>
    </tr>`).join('');
  const full = ch.traits.length >= TRIPLE_O_MAX_TRAITS;
  return `<div class="to-sheet editing">
    <div class="to-sheet-head">
      <input type="text" class="field-input to-name-in" data-to-name="${ch.id}" maxlength="60" value="${escapeAttr(ch.name)}" aria-label="Name">
      <button class="btn small primary" data-to-edit="${ch.id}">Done</button>
      <button class="btn small" data-to-rm="${ch.id}">Remove</button>
    </div>
    <div class="field" style="margin-top:8px;">
      <label for="toDetails_${ch.id}">Details</label>
      <textarea id="toDetails_${ch.id}" class="field-input" rows="2" maxlength="300" data-to-details="${ch.id}" placeholder="Look, age, gear, anything to remember">${escapeAttr(ch.details)}</textarea>
    </div>
    <table class="to-sheet-table">
      <thead><tr><th>Status</th><th>Trait</th><th>Category</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" class="small-note">No Traits yet.</td></tr>'}</tbody>
    </table>
    <div class="row" style="margin-top:8px;">
      <input type="text" id="toNewTrait_${ch.id}" class="field-input" style="flex:1; min-width:180px;" maxlength="80" placeholder="e.g. Cautious to a fault" ${full ? 'disabled' : ''}>
      <button class="btn small" data-to-trait-add="${ch.id}" ${full ? 'disabled' : ''}>Add Trait</button>
    </div>
    <div class="row" style="margin-top:8px;">
      <select id="toSparkTrait_${ch.id}" class="field-input" aria-label="Spark table">
        ${TRIPLE_O_TRAIT_SPARKS.map(s => { const c = TRIPLE_O_COMBOS.find(x => x.id === s.key); return `<option value="${s.key}">${c ? c.label : TRIPLE_O_TABLE_BY_KEY[s.key].label}</option>`; }).join('')}
      </select>
      <button class="btn small" data-to-trait-spark="${ch.id}" ${full ? 'disabled' : ''}>Spark a Trait</button>
      <span class="small-note">${ch.traits.length} / ${TRIPLE_O_MAX_TRAITS} Traits</span>
      <button class="btn small to-fill" data-to-trait-fill="${ch.id}" ${ch.traits.length + TRIPLE_O_FILL_KEYS.length > TRIPLE_O_MAX_TRAITS ? 'disabled' : ''} title="Adds three Traits: one Disposition (PR), one Motivation (MT), one Method (SK)">Fill 3 Traits</button>
    </div>
  </div>`;
}

function renderTripleO(){
  const s = tripleO();
  const d = s.draft;
  const info = TRIPLE_O_MODE_INFO[d.mode];
  const ch = tripleOChar(d.who);

  const modeButtons = TRIPLE_O_MODES.map(m =>
    `<button type="button" class="to-seg${m === d.mode ? ' on' : ''}" data-to-mode="${m}" aria-pressed="${m === d.mode}">${TRIPLE_O_MODE_INFO[m].label}</button>`).join('');

  // Who acts: every Trait Sheet, one under the other. Click a row to pick the
  // character (click it again to clear). A Group Action is the whole party:
  // the rows only show the Traits, and the party Traits come first.
  const group = d.mode === 'group';
  const whoRows = s.chars.map(c => {
    const on = !group && c.id === d.who;
    const traits = tripleOTraitChips(c.traits, 'No Traits yet.', c.id);
    // The row is a div: the pick button and the Trait chip buttons sit side
    // by side (a button cannot hold other buttons). A click on the row
    // outside a chip picks the character too.
    return group
      ? `<div class="to-who"><div class="to-who-name">${escapeAttr(c.name)}</div><div class="to-who-traits">${traits}</div></div>`
      : `<div class="to-who pick${on ? ' on' : ''}" data-to-who-row="${c.id}">
          <button type="button" class="to-who-pick" data-to-who="${c.id}" aria-pressed="${on}">
            <span class="to-who-mark" aria-hidden="true"></span>
            <span class="to-who-name">${escapeAttr(c.name)}</span>
          </button>
          <span class="to-who-traits">${traits}</span>
        </div>`;
  }).join('');
  const partyRow = group ? `<div class="to-who on party"><div class="to-who-name">The party</div><div class="to-who-traits">${tripleOTraitChips(s.party, 'No party Traits yet.', 'party')}</div></div>` : '';
  const pool = tripleOTraitPool();
  const whoList = `<div class="to-who-head">${group ? 'Who decides: the party. Check whose Traits weigh in.' : 'Who acts? Pick a character.'} Click a Trait to change its status (Default &rarr; Prevalent &#9733; &rarr; Temporary).</div>
    <div class="to-who-list" role="${group ? 'list' : 'group'}" aria-label="Characters">
      ${partyRow}${whoRows || '<div class="small-note">No characters yet. Add a Trait Sheet below.</div>'}
    </div>
    <div class="row" style="margin-top:8px;">
      <button class="btn small" id="btnToTraitRoll" ${pool.length ? '' : 'disabled'} title="${group ? 'One Trait across every character' : 'One Trait of the picked character'}; a Prevalent Trait counts twice">Roll a Trait</button>
    </div>
    <div id="toTraitResult">${tripleOTraitRollHtml()}</div>`;
  const entry = band => `<div class="field to-entry ${band}">
      <label for="toEntry_${band}">${TRIPLE_O_BAND_LABEL[band]} <span class="to-odds">${band === 'obvious' ? '4–6' : band === 'option' ? '2–3' : '1'}</span></label>
      <input type="text" id="toEntry_${band}" class="field-input" data-to-entry="${band}" maxlength="200" value="${escapeAttr(d[band])}" placeholder="${escapeAttr(info.prompts[band])}">
    </div>`;

  const single = toSpark && toSpark.parts.length === 1;
  const sparkResult = toSpark ? `<div class="result-box event to-spark-result">
      ${single ? '' : `<b>${escapeAttr(toSpark.label)}</b><br>`}
      ${toSpark.parts.map(p => `<span class="to-spark-part">${escapeAttr(p.table)} <span class="roll-num">${p.code}</span> <span class="to-spark-word">${escapeAttr(p.text)}</span></span>`).join('')}
      ${single && toSpark.parts[0].opp && TRIPLE_O_TABLE_BY_KEY[toSpark.parts[0].key].kind === 'specific'
        ? `<div class="small-note">Does not fit? Opposite combination ${toSpark.parts[0].opp.code}: ${escapeAttr(toSpark.parts[0].opp.text)}</div>` : ''}
      ${toSpark.used ? `<div class="small-note">&#10003; Copied to ${TRIPLE_O_BAND_LABEL[toSpark.used]} in the Triple-O Check.</div>` : ''}
      <div class="row" style="margin-top:8px;">
        ${TRIPLE_O_BANDS.map(b => `<button class="btn small" data-to-use="${b}">Use as ${TRIPLE_O_BAND_LABEL[b].replace('The ', '')}</button>`).join('')}
        ${ch && ch.traits.length < TRIPLE_O_MAX_TRAITS ? `<button class="btn small" id="btnToSparkTrait">Add as Trait to ${escapeAttr(ch.name)}</button>` : ''}
      </div>
    </div>` : '';

  const sparkTables = TRIPLE_O_TABLES.filter(t => t.kind === 'spark');
  const specificTables = TRIPLE_O_TABLES.filter(t => t.kind === 'specific');
  const tableBtn = t => `<button class="btn small" data-to-spark="${t.key}" title="${escapeAttr(t.use)}">${t.label}</button>`;

  const sheets = s.chars.map(tripleOSheetHtml).join('');
  const full = s.chars.length >= TRIPLE_O_MAX_CHARS;
  const partyRows = s.party.map((t, i) => `<li>
      <span class="txt">${tripleOTraitChip(t)}</span>
      <button type="button" data-to-party-rm="${i}" title="Remove">&#10005;</button>
    </li>`).join('');

  const refTables = TRIPLE_O_TABLES.map(t => {
    const rows = tableList(t.key);
    const cells = rows.map((r, i) => {
      const n = Math.floor(i * 36 / rows.length);
      return `<tr><td class="band">${Math.floor(n / 6) + 1}${n % 6 + 1}</td><td>${escapeAttr(r)}</td></tr>`;
    }).join('');
    return `<div style="overflow-x:auto;"><table class="pe-ref-table">
      <thead><tr><th>d66</th><th>${t.label} <span class="small-note">(${t.kind})</span></th></tr></thead><tbody>${cells}</tbody></table></div>`;
  }).join('');

  return `
  ${tabHeader(`Triple-O`, `Play solo from the GM's seat and let the dice decide what the player characters do (<i>Triple-O: The Player Character Emulator</i> by Cezar Capacle). Define a character's <b>Obvious</b>, <b>Option</b> and <b>Odd</b> choice, then roll 1d6. Keep each character's Traits on a Trait Sheet below. This tab does not use the Mythic Chaos Factor or Lists, so it works with any of the other tabs.`, TRIPLE_O_FLOW_HTML)}

  <div class="card to-check">
    <h3 class="block-title">Triple-O Check</h3>
    <div class="to-modes" role="group" aria-label="Procedure">${modeButtons}</div>
    <div class="to-mode-title">${info.title}</div>
    <div class="small-note to-mode-hint">${info.hint}</div>
    ${whoList}
    ${d.mode === 'question' ? `<div class="field" style="margin-top:10px;">
      <label for="toQuestion">Question</label>
      <input type="text" id="toQuestion" class="field-input" maxlength="200" value="${escapeAttr(d.question)}" placeholder="Will they use the gem?">
    </div>` : ''}
    <div class="to-entries">${TRIPLE_O_BANDS.map(entry).join('')}</div>
    <div class="row" style="margin-top:10px;">
      <label class="small-note" style="display:flex; align-items:center; gap:6px; margin:0;">
        <input type="checkbox" id="toDoubleDown" ${d.doubleDown ? 'checked' : ''}> Double-Down (2d6, keep one)
      </label>
      <button class="btn primary" id="btnToCheck">Roll Triple-O Check</button>
      ${d.mode === 'group' ? `<button class="btn" id="btnToRank" title="1d6 per course: highest = Obvious, lowest = Odd">Rank by dice</button>` : ''}
      <button class="btn" id="btnToClear">Clear</button>
    </div>
    ${d.mode === 'group' ? `<div id="toRankResult">${toRankHtml}</div>` : ''}
    <div id="toCheckResult">${tripleOResultHtml()}</div>
  </div>

  <div class="card">
    <h3 class="block-title">Trait Sheets</h3>
    <div class="row">
      <input type="text" id="toNewChar" class="field-input" style="flex:1; min-width:180px;" maxlength="60" placeholder="e.g. Bran, the Warrior" ${full ? 'disabled' : ''}>
      <button class="btn" id="btnToAddChar" ${full ? 'disabled' : ''}>Add character</button>
    </div>
    ${toEditChars.size ? `<div class="small-note">Status: <b>Default</b> (who they are), <b>Prevalent</b> &#9733; (a behavior that grew in play), <b>Temporary</b> (a condition, e.g. Injured leg). Category: a short tag, e.g. ${TRIPLE_O_CATEGORIES.map(([k, v]) => `${k} ${v}`).join(', ')}.</div>` : ''}
    <datalist id="toCategoryList">${TRIPLE_O_CATEGORIES.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</datalist>
    ${sheets ? `<div class="to-sheet-list">${sheets}</div>` : '<div class="small-note" style="margin-top:10px;">No Trait Sheets yet. Add each character you emulate: party members, hirelings, companions.</div>'}
    <h4 class="to-sub">Party Traits</h4>
    ${s.party.length ? `<ul class="gme-list">${partyRows}</ul>` : '<div class="small-note">None yet. Doubles on a Group Action add one.</div>'}
    <div class="row" style="margin-top:8px;">
      <input type="text" id="toNewParty" class="field-input" style="flex:1; min-width:180px;" maxlength="80" placeholder="e.g. Rest when hurt" ${s.party.length >= TRIPLE_O_MAX_TRAITS ? 'disabled' : ''}>
      <button class="btn small" id="btnToAddParty" ${s.party.length >= TRIPLE_O_MAX_TRAITS ? 'disabled' : ''}>Add party Trait</button>
    </div>
  </div>

  <div class="card">
    <h3 class="block-title">Random tables</h3>
    <div class="small-note" style="margin-top:-4px;">Stuck on the Option or the Odd? Roll a spark and interpret it through the character's Traits. Every table is a d66 roll. Edit the rows in &#9881; Settings.</div>
    <div class="to-table-group"><span class="to-group-label">Combos</span>${TRIPLE_O_COMBOS.map(c => `<button class="btn small" data-to-spark="${c.id}" title="${escapeAttr(c.use)}">${c.label}</button>`).join('')}</div>
    <div class="to-table-group"><span class="to-group-label">Spark</span>${sparkTables.map(tableBtn).join('')}</div>
    <div class="to-table-group"><span class="to-group-label">Specific</span>${specificTables.map(tableBtn).join('')}</div>
    <div id="toSparkResult">${sparkResult}</div>
  </div>

  <div class="card">
    <div class="row" style="justify-content:space-between; align-items:center;">
      <h3 class="block-title" style="margin:0; padding:0; border:0;">Reference tables</h3>
      <button class="btn small" id="btnToRefToggle">${toRefOpen ? 'Hide' : 'Show'}</button>
    </div>
    <div class="small-note" style="margin-top:6px;">Triple-O Check: 4&ndash;6 the Obvious, 2&ndash;3 the Option, 1 the Odd. All ${TRIPLE_O_TABLES.length} d66 tables.</div>
    ${toRefOpen ? `<div class="to-ref-grid">${refTables}</div>` : ''}
  </div>
  `;
}

function wireTripleO(){
  const s = () => tripleO();
  const d = () => tripleO().draft;
  const host = document.getElementById('btnToCheck').closest('.card').parentElement;
  const q = sel => host.querySelector(sel);
  const qa = sel => host.querySelectorAll(sel);
  const ref = v => { const [id, i] = String(v).split(':').map(Number); const ch = tripleOChar(id); return { ch, t: ch ? ch.traits[i] : null, i }; };
  const whoName = id => { const ch = tripleOChar(id); return ch ? ch.name : null; };
  const LOG = 'Triple-O';

  /* ----- Triple-O Check ----- */
  qa('[data-to-mode]').forEach(b => b.addEventListener('click', () => {
    if(d().mode === b.dataset.toMode) return;
    d().mode = b.dataset.toMode;
    toPending = null;
    toRankHtml = '';
    persist();
    renderActive();
  }));
  const pickWho = id => {
    d().who = d().who === id ? null : id;
    persist();
    renderActive();
  };
  qa('[data-to-who-row]').forEach(row => row.addEventListener('click', e => {
    if(e.target.closest('[data-to-tstat]')) return;   // a Trait chip changes the status only
    pickWho(Number(row.dataset.toWhoRow));
  }));
  // Trait chip: Default → Prevalent → Temporary → Default.
  qa('[data-to-tstat]').forEach(b => b.addEventListener('click', () => {
    const [owner, idx] = b.dataset.toTstat.split(':');
    const list = owner === 'party' ? s().party : (tripleOChar(owner) || {}).traits;
    const t = list && list[Number(idx)];
    if(!t) return;
    t.status = TRIPLE_O_STATUS_NEXT[t.status] || 'default';
    persist();
    renderActive();
  }));
  q('#btnToTraitRoll').addEventListener('click', () => {
    const r = tripleORollTrait(tripleOTraitPool());
    if(!r) return;
    toTraitRoll = { owner: r.owner, text: r.trait.text, status: r.trait.status, roll: r.roll, total: r.total };
    addLog(LOG, `**Trait roll** (${escapeMd(r.owner)}): 1d${r.total} ${r.roll} → **${escapeMd(r.trait.text)}** (${TRIPLE_O_STATUS_LABEL[r.trait.status]}${r.trait.status === 'prevalent' ? ', weighted ×2' : ''})`);
    renderActive();
  });
  const question = q('#toQuestion');
  if(question) question.addEventListener('input', () => { d().question = question.value.slice(0, 200); persist(); });
  qa('[data-to-entry]').forEach(inp => inp.addEventListener('input', () => {
    d()[inp.dataset.toEntry] = inp.value.slice(0, 200);
    persist();
  }));
  const dd = q('#toDoubleDown');
  dd.addEventListener('change', () => { d().doubleDown = dd.checked; persist(); });

  const snapshot = () => ({
    mode: d().mode, whoId: d().mode === 'group' ? null : d().who,
    question: d().mode === 'question' ? d().question.trim() : '',
    entries: { obvious: d().obvious.trim(), option: d().option.trim(), odd: d().odd.trim() }
  });
  // Records the result of a Check (after the roll, or after the Double-Down pick).
  function finishCheck(snap, dice, kept){
    if(kept == null) kept = dice[0];
    const band = tripleOBand(kept);
    const doubles = dice.length === 2 && dice[0] === dice[1];
    toResult = Object.assign({}, snap, { dice, kept, band, doubles });
    toPending = null;
    const name = snap.mode === 'group' ? 'the party' : whoName(snap.whoId);
    const text = snap.entries[band];
    const roll = dice.length === 2 ? `2d6 ${dice.join('/')}, kept ${kept}` : `1d6 ${kept}`;
    const lines = TRIPLE_O_BANDS.map(b => `${TRIPLE_O_BAND_LABEL[b]}: ${snap.entries[b] ? escapeMd(snap.entries[b]) : '(blank)'}`).join('\n  - ');
    addLog(LOG, `**Triple-O Check — ${TRIPLE_O_MODE_INFO[snap.mode].label}**${name ? ` (${escapeMd(name)})` : ''}${snap.question ? ` — *${escapeMd(snap.question)}*` : ''}: ${roll} → **${TRIPLE_O_BAND_LABEL[band]}**: ${text ? escapeMd(text) : '*not defined yet*'}` +
      (doubles ? `\n  - **Doubles** — ${TRIPLE_O_MODE_INFO[snap.mode].doubles.replace(/^Doubles: /, '')}` : '') +
      `\n  - ${lines}`);
    renderActive();
  }
  q('#btnToCheck').addEventListener('click', () => {
    const snap = snapshot();
    if(d().doubleDown){
      const dice = [rollDie(6), rollDie(6)];
      // the pick matters only when the two dice land on different results
      if(tripleOBand(dice[0]) === tripleOBand(dice[1])){ finishCheck(snap, dice, Math.max(dice[0], dice[1])); return; }
      toResult = null;
      toPending = Object.assign(snap, { dice });
      renderActive();
      return;
    }
    finishCheck(snap, [rollDie(6)], null);
  });
  qa('[data-to-keep]').forEach(b => b.addEventListener('click', () => {
    if(!toPending) return;
    const p = toPending;
    const snap = { mode: p.mode, whoId: p.whoId, question: p.question, entries: p.entries };
    finishCheck(snap, p.dice, p.dice[Number(b.dataset.toKeep)]);
  }));
  q('#btnToClear').addEventListener('click', () => {
    Object.assign(d(), { question: '', obvious: '', option: '', odd: '', doubleDown: false });
    toResult = null;
    toPending = null;
    toRankHtml = '';
    toTraitRoll = null;
    persist();
    renderActive();
  });

  /* ----- Group Actions: Rank by dice ----- */
  const rank = q('#btnToRank');
  if(rank) rank.addEventListener('click', () => {
    const courses = TRIPLE_O_BANDS.map(b => d()[b].trim());
    if(courses.some(c => !c)){
      toRankHtml = '<div class="result-box no">Write all three courses of action first.</div>';
      renderActive();
      return;
    }
    const res = tripleORank(courses);
    TRIPLE_O_BANDS.forEach((b, i) => { d()[b] = res.order[i].text; });
    persist();
    toRankHtml = `<div class="result-box">Ranked by 1d6 each: ${res.order.map((o, i) => `<b>${TRIPLE_O_BAND_LABEL[TRIPLE_O_BANDS[i]]}</b> ${escapeAttr(o.text)} (<span class="roll-num">${o.roll}</span>)`).join(' &middot; ')}
      ${res.rerolls ? `<div class="small-note">Ties rolled again ${res.rerolls}&times; (the rules do not cover ties).</div>` : ''}</div>`;
    addLog(LOG, `**Group Action ranked** (1d6 each): ${res.order.map((o, i) => `${TRIPLE_O_BAND_LABEL[TRIPLE_O_BANDS[i]]} = ${escapeMd(o.text)} (${o.roll})`).join('; ')}` +
      (res.rerolls ? `\n  - Ties: all three dice rolled again ${res.rerolls}× (judgment call: the rules do not cover ties).` : ''));
    renderActive();
  });

  /* ----- Doubles follow-up ----- */
  const addTrait = (ch, text, status, category, how) => {
    if(!ch || !text || ch.traits.length >= TRIPLE_O_MAX_TRAITS) return false;
    ch.traits.push({ text: text.slice(0, 80), status, category: (category || '').slice(0, 6) });
    persist();
    addLog(LOG, `**${escapeMd(ch.name)} — Trait added** (${TRIPLE_O_STATUS_LABEL[status]}${how ? `, ${how}` : ''}): ${escapeMd(text)}`);
    return true;
  };
  const dMark = q('#btnToDoublesMark');
  if(dMark) dMark.addEventListener('click', () => {
    const ch = tripleOChar(toResult && toResult.whoId);
    const t = ch && ch.traits[Number(q('#toDoublesMark').value)];
    if(!t) return;
    t.status = 'prevalent';
    persist();
    addLog(LOG, `**${escapeMd(ch.name)} — Trait marked Prevalent** (doubles): ${escapeMd(t.text)}`);
    toResult.doubles = false;
    renderActive();
  });
  const dAdd = q('#btnToDoublesAdd');
  if(dAdd) dAdd.addEventListener('click', () => {
    const ch = tripleOChar(toResult && toResult.whoId);
    const text = q('#toDoublesText').value.trim();
    if(addTrait(ch, text, dAdd.dataset.status, dAdd.dataset.status === 'temporary' ? 'CN' : '', 'doubles')){
      toResult.doubles = false;
      renderActive();
    }
  });
  const dParty = q('#btnToDoublesParty');
  if(dParty) dParty.addEventListener('click', () => {
    const text = q('#toDoublesText').value.trim();
    if(!text || s().party.length >= TRIPLE_O_MAX_TRAITS) return;
    s().party.push({ text: text.slice(0, 80), status: 'default', category: '' });
    persist();
    addLog(LOG, `**Party Trait added** (doubles): ${escapeMd(text)}`);
    toResult.doubles = false;
    renderActive();
  });

  /* ----- Random tables ----- */
  qa('[data-to-spark]').forEach(b => b.addEventListener('click', () => {
    toSpark = tripleOSpark(b.dataset.toSpark);
    addLog(LOG, `**${escapeMd(toSpark.label)}** (d66): ${toSpark.parts.map(p => `${p.table} ${p.code} → **${escapeMd(p.text)}**`).join(' · ')}`);
    renderActive();
  }));
  qa('[data-to-use]').forEach(b => b.addEventListener('click', () => {
    if(!toSpark) return;
    d()[b.dataset.toUse] = toSpark.text.slice(0, 200);
    toSpark.used = b.dataset.toUse;
    persist();
    renderActive();
  }));
  const sparkTrait = q('#btnToSparkTrait');
  if(sparkTrait) sparkTrait.addEventListener('click', () => {
    if(!toSpark) return;
    const key = toSpark.parts.length === 1 ? toSpark.parts[0].key : '';
    const cat = (TRIPLE_O_TRAIT_SPARKS.find(x => x.key === key) || {}).category || '';
    if(addTrait(tripleOChar(d().who), toSpark.text, 'default', cat, toSpark.label)) renderActive();
  });

  /* ----- Trait Sheets ----- */
  function addChar(){
    const el = q('#toNewChar');
    if(s().chars.length >= TRIPLE_O_MAX_CHARS) return;
    const name = el.value.trim().slice(0, 60) || `Character ${s().chars.length + 1}`;
    const ch = { id: s().nextCharId++, name, details: '', traits: [] };
    s().chars.push(ch);
    if(d().mode !== 'group' && d().who == null) d().who = ch.id;
    toEditChars.add(ch.id);
    persist();
    addLog(LOG, `**Trait Sheet added** — ${escapeMd(name)}.`);
    renderActive();
  }
  q('#btnToAddChar').addEventListener('click', addChar);
  q('#toNewChar').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); addChar(); } });

  qa('[data-to-edit]').forEach(b => b.addEventListener('click', () => {
    const id = Number(b.dataset.toEdit);
    if(toEditChars.has(id)) toEditChars.delete(id); else toEditChars.add(id);
    renderActive();
  }));
  qa('[data-to-rm]').forEach(b => b.addEventListener('click', () => {
    const ch = tripleOChar(b.dataset.toRm);
    if(!ch || !confirm(`Remove the Trait Sheet of ${ch.name}?`)) return;
    s().chars = s().chars.filter(x => x.id !== ch.id);
    if(d().who === ch.id) d().who = null;
    toEditChars.delete(ch.id);
    persist();
    addLog(LOG, `**Trait Sheet removed** — ${escapeMd(ch.name)}.`);
    renderActive();
  }));
  // Text fields save on change without a re-render, so the focus moves on normally.
  qa('[data-to-name]').forEach(inp => inp.addEventListener('change', () => {
    const ch = tripleOChar(inp.dataset.toName);
    if(!ch) return;
    const v = inp.value.trim().slice(0, 60);
    if(v) ch.name = v; else inp.value = ch.name;
    persist();
  }));
  qa('[data-to-details]').forEach(inp => inp.addEventListener('change', () => {
    const ch = tripleOChar(inp.dataset.toDetails);
    if(!ch) return;
    ch.details = inp.value.slice(0, 300);
    persist();
  }));
  qa('[data-to-text]').forEach(inp => inp.addEventListener('change', () => {
    const { t } = ref(inp.dataset.toText);
    if(!t) return;
    const v = inp.value.trim().slice(0, 80);
    if(v) t.text = v; else inp.value = t.text;
    persist();
  }));
  qa('[data-to-cat]').forEach(inp => inp.addEventListener('change', () => {
    const { t } = ref(inp.dataset.toCat);
    if(!t) return;
    t.category = inp.value.trim().slice(0, 6);
    persist();
  }));
  qa('[data-to-status]').forEach(sel => sel.addEventListener('change', () => {
    const { t } = ref(sel.dataset.toStatus);
    if(!t) return;
    t.status = TRIPLE_O_STATUSES.includes(sel.value) ? sel.value : 'default';
    persist();
    renderActive();
  }));
  qa('[data-to-trait-rm]').forEach(b => b.addEventListener('click', () => {
    const { ch, t, i } = ref(b.dataset.toTraitRm);
    if(!t) return;
    ch.traits.splice(i, 1);
    persist();
    renderActive();
  }));
  qa('[data-to-trait-add]').forEach(b => {
    const id = Number(b.dataset.toTraitAdd);
    const inp = q('#toNewTrait_' + id);
    const add = () => {
      const ch = tripleOChar(id);
      const text = inp.value.trim();
      if(!ch || !text || ch.traits.length >= TRIPLE_O_MAX_TRAITS) return;
      ch.traits.push({ text: text.slice(0, 80), status: 'default', category: '' });
      persist();
      renderActive();
      const next = document.getElementById('toNewTrait_' + id);
      if(next) next.focus();
    };
    b.addEventListener('click', add);
    inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); add(); } });
  });
  qa('[data-to-trait-spark]').forEach(b => b.addEventListener('click', () => {
    const id = Number(b.dataset.toTraitSpark);
    const key = q('#toSparkTrait_' + id).value;
    const def = TRIPLE_O_TRAIT_SPARKS.find(x => x.key === key);
    if(!def) return;
    const sp = tripleOSpark(key);
    if(addTrait(tripleOChar(id), sp.text, 'default', def.category, `${sp.label} ${sp.parts.map(p => p.code).join('+')}`)) renderActive();
  }));

  qa('[data-to-trait-fill]').forEach(b => b.addEventListener('click', () => {
    const ch = tripleOChar(b.dataset.toTraitFill);
    if(!ch || ch.traits.length + TRIPLE_O_FILL_KEYS.length > TRIPLE_O_MAX_TRAITS) return;
    const added = TRIPLE_O_FILL_KEYS.map(key => {
      const r = tripleORoll(key);
      const cat = (TRIPLE_O_TRAIT_SPARKS.find(x => x.key === key) || {}).category || '';
      ch.traits.push({ text: r.text.slice(0, 80), status: 'default', category: cat });
      return `${r.table} ${r.code} → **${escapeMd(r.text)}**`;
    });
    persist();
    addLog(LOG, `**${escapeMd(ch.name)} — 3 Traits added** (d66): ${added.join(' · ')}`);
    renderActive();
  }));

  /* ----- Party Traits ----- */
  function addParty(){
    const inp = q('#toNewParty');
    const text = inp.value.trim();
    if(!text || s().party.length >= TRIPLE_O_MAX_TRAITS) return;
    s().party.push({ text: text.slice(0, 80), status: 'default', category: '' });
    persist();
    renderActive();
  }
  q('#btnToAddParty').addEventListener('click', addParty);
  q('#toNewParty').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); addParty(); } });
  qa('[data-to-party-rm]').forEach(b => b.addEventListener('click', () => {
    s().party.splice(Number(b.dataset.toPartyRm), 1);
    persist();
    renderActive();
  }));

  q('#btnToRefToggle').addEventListener('click', () => { toRefOpen = !toRefOpen; renderActive(); });
}

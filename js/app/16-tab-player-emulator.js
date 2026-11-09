/* =========================================================================
   TAB: PLAYER EMULATOR
   -------------------------------------------------------------------------
   A solo-play "player emulator" adapted from *Cloud Empress: Solo Protocol*
   (worlds by watt, 2023). You keep a roster of player characters, each with
   an Outlook and a weighted Character Response Chart, then generate the mood
   of a whole encounter in one roll:

     - every tracked PC produces a response (1d10 on their Response Chart,
       or a fresh 1d100 on the full table if their Outlook is Wild card)
     - every NPC in the encounter has a single mood (1d10 NPC Mood Table)
     - each response / mood carries a conflict rating (+'s escalate, −'s
       de-escalate; a + and a − cancel)
     - sum every rating (plus any manual adjustment for animals / friends /
       foes) — if the tension reaches + + + +, a violent encounter begins

   Character Response Types table is reproduced here re-sorted from the most
   minuses (calming) to the most pluses (violent), which is what makes the
   Advantage / Disadvantage option meaningful: building a chart with
   Advantage rolls 2d100 keep lowest (biased toward calm responses),
   Disadvantage rolls 2d100 keep highest (biased toward violent ones).
   ========================================================================= */

// --- Character Response Types (1d100). Re-sorted most-minus → most-plus;
// alphabetical within an equal rating. `rating` is the signed count of
// +'s / −'s next to the response in the source book. 50 entries, each
// covering two percentiles of a d100.
const PE_RESPONSE_TYPES = [
  // −3
  { name: 'Charming',      rating: -3 },
  { name: 'Flattering',    rating: -3 },
  { name: 'Humble',        rating: -3 },
  { name: 'Patient',       rating: -3 },
  // −2
  { name: 'Adaptive',      rating: -2 },
  { name: 'Collected',     rating: -2 },
  { name: 'Compassionate', rating: -2 },
  { name: 'Creative',      rating: -2 },
  { name: 'Ethical',       rating: -2 },
  { name: 'Flexible',      rating: -2 },
  { name: 'Friendly',      rating: -2 },
  { name: 'Observant',     rating: -2 },
  { name: 'Practical',     rating: -2 },
  { name: 'Prepared',      rating: -2 },
  { name: 'Professional',  rating: -2 },
  { name: 'Trusting',      rating: -2 },
  // −1
  { name: 'Brave',         rating: -1 },
  { name: 'Confident',     rating: -1 },
  { name: 'Decisive',      rating: -1 },
  { name: 'Deductive',     rating: -1 },
  { name: 'Direct',        rating: -1 },
  { name: 'Heroic',        rating: -1 },
  { name: 'Honest',        rating: -1 },
  { name: 'Inspiring',     rating: -1 },
  { name: 'Knowledgeable', rating: -1 },
  { name: 'Mercantile',    rating: -1 },
  // +1
  { name: 'Emotional',     rating: 1 },
  { name: 'Guilty',        rating: 1 },
  { name: 'Haunted',       rating: 1 },
  { name: 'Jealous',       rating: 1 },
  { name: 'Protective',    rating: 1 },
  { name: 'Stealthy',      rating: 1 },
  { name: 'Unforgiving',   rating: 1 },
  // +2
  { name: 'Agitated',      rating: 2 },
  { name: 'Argumentative', rating: 2 },
  { name: 'Arrogant',      rating: 2 },
  { name: 'Bitter',        rating: 2 },
  { name: 'Broken',        rating: 2 },
  { name: 'Critical',      rating: 2 },
  { name: 'Frightened',    rating: 2 },
  { name: 'Haughty',       rating: 2 },
  { name: 'Idealistic',    rating: 2 },
  { name: 'Obsessive',     rating: 2 },
  { name: 'Suspicious',    rating: 2 },
  // +3
  { name: 'Aggressive',    rating: 3 },
  { name: 'Dishonest',     rating: 3 },
  { name: 'Jumpy',         rating: 3 },
  { name: 'Manipulative',  rating: 3 },
  // +4
  { name: 'Brutal',        rating: 4 },
  { name: 'Violent',       rating: 4 }
];

// A 1d100 roll (1–100) maps to one of the 50 rows (two percentiles each).
function peResponseType(roll){
  const idx = Math.max(0, Math.min(PE_RESPONSE_TYPES.length - 1, Math.floor((roll - 1) / 2)));
  return { ...PE_RESPONSE_TYPES[idx], idx };
}

// --- NPC Mood Table (Solo), 1d10. Index 0 == a roll of 1.
const PE_NPC_MOODS = [
  { name: 'Generous',      rating: -3 },
  { name: 'Friendly',      rating: -2 },
  { name: 'Curious',       rating: -1 },
  { name: 'Needy',         rating: 0  },
  { name: 'Disinterested', rating: 1  },
  { name: 'Wary',          rating: 1  },
  { name: 'Afraid',        rating: 2  },
  { name: 'Defensive',     rating: 3  },
  { name: 'Aggressive',    rating: 3  },
  { name: 'Cruel',         rating: 4  }
];
function peNpcMood(roll){
  const i = Math.max(1, Math.min(10, roll)) - 1;
  return { ...PE_NPC_MOODS[i], roll: i + 1 };
}

// --- Outlooks, 1d10. Index 0 == a roll of 1. Displayed as a reminder only;
// the tool does not automate a character leaving the party. The one Outlook
// that changes a roll is Wild card (index 2): that PC ignores their chart and
// rolls a fresh 1d100 on the full table every encounter.
const PE_OUTLOOKS = [
  { name: 'Optimist',             text: 'Leaves the party upon the completion of 3 goals.' },
  { name: 'Pessimist',            text: 'Leaves whenever the party fails three times in a row.' },
  { name: 'Wild card',            text: 'No set response profile — roll 1d100 on the full response table in every encounter and interaction. Leaves when they die or the party is disbanded.' },
  { name: 'Follower',             text: 'Devoted to another party member; leaves when that member leaves.' },
  { name: 'Protector',            text: 'When another party member would die or leave the party, this character leaves instead.' },
  { name: 'Ambitious',            text: 'Leaves whenever the party succeeds three times in a row.' },
  { name: 'Thrill-seeker',        text: 'If total successes and failures are ever equal, leaves the party (min. 5 each).' },
  { name: 'Self-preservationist', text: 'If this character ever has two wounds simultaneously, they leave the party.' },
  { name: 'Half-hearted',         text: 'When the party achieves its next goal, this character leaves.' },
  { name: 'Craven',               text: 'When this character would die from a wound, another character dies instead.' }
];
const PE_WILDCARD_OUTLOOK = 3;   // 1d10 result for "Wild card"

// --- helpers -------------------------------------------------------------

// "+ + +", "− −", or "0" for a signed conflict rating.
function peRatingLabel(n){
  if(!n) return '0';
  return Array(Math.abs(n)).fill(n < 0 ? '−' : '+').join(' ');
}
function peRatingClass(n){ return n < 0 ? 'neg' : n > 0 ? 'pos' : 'zero'; }

// Roll with optional Advantage (keep lowest) / Disadvantage (keep highest).
// mode: 'normal' (1 die) | 'adv' | 'dis' (roll two, keep one).
function peBiasedRoll(sides, mode){
  const a = rollDie(sides);
  if(mode === 'adv' || mode === 'dis'){
    const b = rollDie(sides);
    return { mode, rolls: [a, b], kept: mode === 'adv' ? Math.min(a, b) : Math.max(a, b) };
  }
  return { mode: 'normal', rolls: [a], kept: a };
}
// Character Response Type roll (1d100) and NPC Mood roll (1d10), each Adv/Disadv-able.
function peRollType(mode){ return peBiasedRoll(100, mode); }
function peRollMood(mode){ return peBiasedRoll(10, mode); }

const PE_CHART_MODES = ['normal', 'adv', 'dis'];
const PE_MODE_LABEL = {
  normal: 'Normal (1d100)',
  adv:    'Advantage (2d100 keep lowest)',
  dis:    'Disadvantage (2d100 keep highest)'
};
const PE_MOOD_MODE_LABEL = {
  normal: 'Normal (1d10)',
  adv:    'Advantage (2d10 keep lowest)',
  dis:    'Disadvantage (2d10 keep highest)'
};

// Build a weighted 10-segment Response Chart per the book: repeatedly roll a
// response type (with the given Adv/Disadv mode) and a 1d6 for how many of the
// remaining segments it fills, until all 10 are assigned.
function peBuildChart(mode){
  const entries = [];
  let remaining = 10;
  while(remaining > 0){
    const t = peRollType(mode);
    const rt = peResponseType(t.kept);
    const size = rollDie(6);
    const segments = Math.min(size, remaining);
    entries.push({ name: rt.name, rating: rt.rating, segments, typeRoll: t, sizeRoll: size });
    remaining -= segments;
  }
  return entries;
}

// Which chart entry a 1d10 lands on (segments are laid out in order).
function peChartResponseAt(entries, d10){
  let cum = 0;
  for(const e of entries){ cum += e.segments; if(d10 <= cum) return e; }
  return entries[entries.length - 1];
}

// ---------------------------------------------------------------------------

// transient view state, cached so an unrelated renderActive() doesn't wipe it
let peResponseHtml = {};      // pc id -> last "Roll response" result HTML (shown on the PC card)
let peLastResponse = {};      // pc id -> last response { name, rating, wild, ... } for reuse in an encounter
let peRefOpen = false;        // reference tables collapsed by default
// PC cards are collapsed by default (only the chart and Roll response). This
// Set holds the ids of the cards opened with Show, plus each PC added in
// this tab, so its chart can be built. Not saved: a reload collapses all.
let pePcExpanded = new Set();
let peChartEdit = null;       // the Response Chart editor modal: { pcId, rows:[{name, rating, segments}] } or null

// The chart bar. `labeled` writes each response's name over its colored segment.
function peChartBarHtml(chart, labeled){
  return `<div class="pe-chart${labeled ? ' labeled' : ''}">${chart.map(e => `
    <span class="seg ${peRatingClass(e.rating)}" style="flex:${e.segments}" title="${escapeAttr(e.name)} (${peRatingLabel(e.rating)}) — ${e.segments}/10">${labeled
      ? `<span class="seg-name">${escapeAttr(e.name)}</span><span class="seg-rating">${peRatingLabel(e.rating)}</span>`
      : peRatingLabel(e.rating)}</span>`).join('')}</div>`;
}

// The Encounter Mood, always up to date: every PC's last rolled response
// (peLastResponse, from Roll response), every NPC's mood, and the Extra
// conflict, summed. Nothing is rolled here. A PC with no response yet is
// listed but adds nothing. Total >= +4 = a violent encounter begins.
function peEncounterMood(){
  const data = campaign().playerEmu;
  const lines = [];      // {label, name, rating, detail}
  const waiting = [];    // PCs that can respond but have not rolled yet
  data.pcs.forEach(pc => {
    const res = peLastResponse[pc.id];
    if(res) lines.push({ label: pc.name, name: res.name, rating: res.rating, detail: res.rollText + (res.wild ? ' · Wild card' : '') });
    else if(pc.chart.length || pc.outlook === PE_WILDCARD_OUTLOOK) waiting.push(pc);
  });
  data.npcs.forEach(n => {
    const m = peNpcMood(n.mood);
    lines.push({ label: n.name, name: m.name, rating: m.rating, detail: '1d10 ' + n.mood });
  });
  const total = lines.reduce((sum, l) => sum + l.rating, 0) + data.adjust;
  return { lines, waiting, total, violent: total >= 4, adjust: data.adjust };
}
function peEncounterMoodHtml(){
  const m = peEncounterMood();
  if(!m.lines.length && !m.waiting.length && !m.adjust) return '<div class="small-note">Roll a PC response or add an NPC: the Encounter Mood shows here.</div>';
  const rows = m.lines.map(l => `<tr>
      <td>${escapeAttr(l.label)}</td>
      <td><b>${escapeAttr(l.name)}</b></td>
      <td class="pe-rating ${peRatingClass(l.rating)}">${peRatingLabel(l.rating)}</td>
      <td class="small-note">${escapeAttr(l.detail)}</td>
    </tr>`).join('') + m.waiting.map(pc => `<tr class="pe-waiting">
      <td>${escapeAttr(pc.name)}</td>
      <td colspan="3" class="small-note">No response yet: Roll response on the PC card.</td>
    </tr>`).join('');
  const adjRow = m.adjust
    ? `<tr><td>Extra conflict</td><td>&mdash;</td><td class="pe-rating ${peRatingClass(m.adjust)}">${peRatingLabel(m.adjust)}</td><td class="small-note">manual</td></tr>`
    : '';
  return `<div class="result-box ${m.violent ? 'no' : ''}">
      <div style="overflow-x:auto;"><table class="pe-ref-table">
        <thead><tr><th>Participant</th><th>Response / Mood</th><th>Rating</th><th>Roll</th></tr></thead>
        <tbody>${rows}${adjRow}</tbody>
      </table></div>
      <div style="margin-top:10px;">Total conflict rating:
        <span class="roll-num">${m.total}</span>
        <span class="pe-rating ${peRatingClass(m.total)}" style="margin-left:6px;">${peRatingLabel(m.total)}</span>
      </div>
      <div class="${m.violent ? 'banner-solved' : 'small-note'}" style="margin-top:8px;">
        ${m.violent
          ? '&#9876;&#65039; Violent encounter begins — the tension reached + + + + or more.'
          : 'No violence — the tension stays below + + + +. Play out the interaction.'}
      </div>
    </div>`;
}

function renderPlayerEmu(){
  const pe = campaign().playerEmu || (campaign().playerEmu = freshPlayerEmu());

  const pcCards = pe.pcs.map(pc => {
    const outlook = pc.outlook ? PE_OUTLOOKS[pc.outlook - 1] : null;
    const wild = pc.outlook === PE_WILDCARD_OUTLOOK;
    const total = pc.chart.reduce((s, e) => s + e.rating, 0);

    const collapsed = !pePcExpanded.has(pc.id);
    const rollBtn = `<button class="btn primary" data-pc-roll="${pc.id}" ${pc.chart.length || wild ? '' : 'disabled'}>Roll response</button>`;
    const toggleBtn = `<button class="btn small" data-pc-collapse="${pc.id}" aria-expanded="${!collapsed}" title="${collapsed ? 'Show the whole card' : 'Show only the chart and Roll response'}">${collapsed ? 'Show' : 'Hide'}</button>`;
    if(collapsed){
      return `
    <div class="pe-pc collapsed" data-pc="${pc.id}">
      <div class="pe-pc-head">
        <span class="pe-name-txt">${escapeAttr(pc.name)}${outlook
          ? ` <span class="pe-outlook-txt" title="${escapeAttr(outlook.text)}">Outlook ${escapeAttr(outlook.name)}</span>`
          : ''}</span>
        ${toggleBtn}
      </div>
      ${pc.chart.length ? peChartBarHtml(pc.chart, true) : `<div class="small-note">No Response Chart yet.</div>`}
      <div class="row pe-collapsed-roll">${rollBtn}</div>
      <div id="peResponseResult_${pc.id}" style="margin-top:10px;">${peResponseHtml[pc.id] || ''}</div>
    </div>`;
    }

    const chartBar = pc.chart.length
      ? `${peChartBarHtml(pc.chart, false)}
        <div class="pe-legend">${pc.chart.map((e, i) => {
          const lo = pc.chart.slice(0, i).reduce((s, x) => s + x.segments, 0) + 1;
          const hi = lo + e.segments - 1;
          return `<span><span class="small-note">${lo === hi ? lo : lo + '–' + hi}</span> <span class="rt">${escapeAttr(e.name)}</span> <span class="pe-rating ${peRatingClass(e.rating)}">${peRatingLabel(e.rating)}</span></span>`;
        }).join('')}</div>`
      : `<div class="small-note">No Response Chart yet — build one to include this PC in an encounter${wild ? ' (or rely on the Wild card Outlook)' : ''}.</div>`;

    return `
    <div class="pe-pc" data-pc="${pc.id}">
      <div class="pe-pc-head">
        <input type="text" class="field-input pe-name" data-pc-name="${pc.id}" value="${escapeAttr(pc.name)}" placeholder="Character name">
        <button class="btn small" data-pc-outlook="${pc.id}">Roll Outlook</button>
        <button class="btn small danger" data-pc-rm="${pc.id}">Remove</button>
        ${toggleBtn}
      </div>
      <div class="small-note" style="margin-top:6px;">
        ${outlook
          ? `Outlook <b>${escapeAttr(outlook.name)}</b> — ${escapeAttr(outlook.text)}`
          : 'No Outlook rolled.'}
      </div>
      <div class="divider" style="margin:12px 0;"></div>
      <div class="row" style="align-items:flex-end;">
        <div class="field">
          <label for="peChartMode_${pc.id}">Response Chart roll</label>
          <select id="peChartMode_${pc.id}" class="field-input" data-pc-mode="${pc.id}">
            ${PE_CHART_MODES.map(m => `<option value="${m}" ${pc.chartMode === m ? 'selected' : ''}>${PE_MODE_LABEL[m]}</option>`).join('')}
          </select>
        </div>
        <button class="btn" data-pc-build="${pc.id}">${pc.chart.length ? 'Rebuild Response Chart' : 'Build Response Chart'}</button>
        <button class="btn" data-pc-edit-chart="${pc.id}">Edit chart</button>
        ${rollBtn}
      </div>
      ${chartBar}
      ${pc.chart.length ? `<div class="small-note">Chart conflict rating sums to <span class="pe-rating ${peRatingClass(total)}">${peRatingLabel(total)}</span> across its 10 segments.</div>` : ''}
      <div id="peResponseResult_${pc.id}" style="margin-top:10px;">${peResponseHtml[pc.id] || ''}</div>
    </div>`;
  }).join('');

  const npcRows = pe.npcs.map(n => {
    const m = peNpcMood(n.mood);
    return `<li>
      <span class="txt">${escapeAttr(n.name)} — <b>${escapeAttr(m.name)}</b> <span class="pe-rating ${peRatingClass(m.rating)}">${peRatingLabel(m.rating)}</span></span>
      <button type="button" data-npc-edit="${n.id}" title="Edit name">Edit</button>
      <button type="button" data-npc-reroll="${n.id}" title="Reroll mood">&#8635;</button>
      <button type="button" data-npc-rm="${n.id}" title="Remove">&#10005;</button>
    </li>`;
  }).join('');

  const refRows = PE_RESPONSE_TYPES.map((t, i) => {
    const lo = 2 * i + 1, hi = 2 * i + 2;
    return `<tr><td class="band">${lo}–${hi}</td><td>${t.name}</td><td class="pe-rating ${peRatingClass(t.rating)}">${peRatingLabel(t.rating)}</td></tr>`;
  }).join('');
  const moodRows = PE_NPC_MOODS.map((m, i) => `<tr><td class="band">${i + 1}</td><td>${m.name}</td><td class="pe-rating ${peRatingClass(m.rating)}">${peRatingLabel(m.rating)}</td></tr>`).join('');
  const outlookRows = PE_OUTLOOKS.map((o, i) => `<tr><td class="band">${i + 1}</td><td><b>${o.name}</b> — ${o.text}</td></tr>`).join('');

  return `
  ${tabHeader(`Player Emulator`, `Emulate a traveling party from <i>Cloud Empress: Solo Protocol</i>. Give each PC an Outlook and a weighted Character Response Chart, then generate the mood of an encounter in one roll: every PC responds, every NPC has a mood, the +/− conflict ratings are summed (a + and a − cancel), and if the tension reaches <b>+ + + +</b> a violent encounter begins.`)}

  <div class="card">
    <h3 class="block-title">Player Characters</h3>
    <div class="row">
      <input type="text" id="peNewPcName" class="field-input" style="flex:1; min-width:180px;" placeholder="New character name…">
      <button class="btn" id="btnPeAddPc">Add PC</button>
    </div>
    ${pcCards || '<div class="small-note" style="margin-top:12px;">No player characters yet. Add one, roll its Outlook, and build its Response Chart.</div>'}
  </div>

  <div class="card">
    <h3 class="block-title">Encounter</h3>
    <p class="small-note" style="margin-top:-4px;">Add the NPCs present. Each NPC gets one mood. The Encounter Mood below sums the PCs' rolled responses, the NPC moods and the Extra conflict, and updates by itself.</p>
    <div class="row" style="align-items:flex-end;">
      <input type="text" id="peNewNpcName" class="field-input" style="flex:1; min-width:160px;" placeholder="NPC name (optional)…">
      <div class="field">
        <label for="peNpcMoodMode">Mood roll</label>
        <select id="peNpcMoodMode" class="field-input" style="min-width:200px;">
          ${PE_CHART_MODES.map(m => `<option value="${m}" ${pe.npcMoodMode === m ? 'selected' : ''}>${PE_MOOD_MODE_LABEL[m]}</option>`).join('')}
        </select>
      </div>
      <button class="btn" id="btnPeAddNpc">Add NPC &amp; roll mood</button>
    </div>
    ${pe.npcs.length ? `<ul class="gme-list">${npcRows}</ul><div class="small-note">${pe.npcs.length} NPC${pe.npcs.length === 1 ? '' : 's'} in the encounter</div>` : '<div class="small-note" style="margin-top:8px;">No NPCs added.</div>'}
    <div class="row pe-encounter-bar">
      <button class="btn" id="btnPeClearEncounter" ${pe.npcs.length || Object.keys(peLastResponse).length ? '' : 'disabled'} title="Removes the NPCs and every PC's last response">Clear encounter</button>
      <label class="pe-adjust" for="peAdjust" title="Animals, friends and foes not listed: + escalates, − calms">Extra conflict
        <input type="number" id="peAdjust" class="field-input" value="${pe.adjust}" min="-20" max="20" step="1">
      </label>
    </div>
    <h4 class="pe-mood-title">Encounter Mood</h4>
    <div id="peEncounterResult">${peEncounterMoodHtml()}</div>
  </div>

  <div class="card">
    <div class="row" style="justify-content:space-between; align-items:center;">
      <h3 class="block-title" style="margin:0; padding:0; border:0;">Reference tables</h3>
      <button class="btn small" id="btnPeRefToggle">${peRefOpen ? 'Hide' : 'Show'}</button>
    </div>
    <div class="small-note" style="margin-top:6px;">Character Response Types re-sorted from most minuses (calming) to most pluses (violent).</div>
    ${peRefOpen ? `
    <div class="grid2" style="margin-top:10px;">
      <div style="overflow-x:auto;">
        <table class="pe-ref-table">
          <thead><tr><th>1d100</th><th>Character Response Type</th><th>Rating</th></tr></thead>
          <tbody>${refRows}</tbody>
        </table>
      </div>
      <div>
        <div style="overflow-x:auto;">
          <table class="pe-ref-table">
            <thead><tr><th>1d10</th><th>NPC Mood</th><th>Rating</th></tr></thead>
            <tbody>${moodRows}</tbody>
          </table>
        </div>
        <div style="overflow-x:auto; margin-top:14px;">
          <table class="pe-ref-table">
            <thead><tr><th>1d10</th><th>Outlook</th></tr></thead>
            <tbody>${outlookRows}</tbody>
          </table>
        </div>
      </div>
    </div>` : ''}
  </div>
  `;
}

function wirePlayerEmu(){
  const pe = () => campaign().playerEmu;
  const pcById = id => pe().pcs.find(p => p.id === Number(id));
  const npcById = id => pe().npcs.find(n => n.id === Number(id));

  const ratingChip = (name, rating) => `<span class="word-chip"><b>${escapeAttr(name)}</b></span> <span class="pe-rating ${peRatingClass(rating)}">${peRatingLabel(rating)}</span>`;

  /* ----- roster: add / rename / remove PCs ----- */
  function addPc(){
    const el = document.getElementById('peNewPcName');
    const name = el.value.trim() || `PC ${pe().pcs.length + 1}`;
    const id = pe().nextPcId++;
    pe().pcs.push({ id, name, outlook: null, chartMode: 'normal', chart: [] });
    pePcExpanded.add(id);   // a new PC opens expanded, to roll its Outlook and build its chart
    persist();
    addLog('Player Emulator', `**PC added** — "${escapeMd(name)}".`);
    renderActive();
  }
  document.getElementById('btnPeAddPc').addEventListener('click', addPc);
  document.getElementById('peNewPcName').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); addPc(); } });

  document.querySelectorAll('[data-pc-name]').forEach(inp => inp.addEventListener('change', () => {
    const pc = pcById(inp.dataset.pcName);
    if(!pc) return;
    pc.name = inp.value.trim().slice(0, 60) || pc.name;
    persist();
    renderActive();
  }));

  document.querySelectorAll('[data-pc-rm]').forEach(b => b.addEventListener('click', () => {
    const pc = pcById(b.dataset.pcRm);
    if(!pc || !confirm(`Remove ${pc.name}?`)) return;
    pe().pcs = pe().pcs.filter(p => p.id !== pc.id);
    delete peResponseHtml[pc.id];
    delete peLastResponse[pc.id];
    pePcExpanded.delete(pc.id);
    persist();
    addLog('Player Emulator', `**PC removed** — "${escapeMd(pc.name)}".`);
    renderActive();
  }));

  document.querySelectorAll('[data-pc-mode]').forEach(sel => sel.addEventListener('change', () => {
    const pc = pcById(sel.dataset.pcMode);
    if(!pc) return;
    pc.chartMode = PE_CHART_MODES.includes(sel.value) ? sel.value : 'normal';
    persist();
  }));

  /* ----- collapse a card / edit the chart ----- */
  document.querySelectorAll('[data-pc-collapse]').forEach(b => b.addEventListener('click', () => {
    const id = Number(b.dataset.pcCollapse);
    if(pePcExpanded.has(id)) pePcExpanded.delete(id); else pePcExpanded.add(id);
    renderActive();
  }));
  document.querySelectorAll('[data-pc-edit-chart]').forEach(b => b.addEventListener('click', () => openPeChartEditor(Number(b.dataset.pcEditChart))));

  /* ----- Outlook ----- */
  document.querySelectorAll('[data-pc-outlook]').forEach(b => b.addEventListener('click', () => {
    const pc = pcById(b.dataset.pcOutlook);
    if(!pc) return;
    const r = rollDie(10);
    pc.outlook = r;
    persist();
    addLog('Player Emulator', `**${escapeMd(pc.name)} — Outlook** (1d10: ${r}) → **${PE_OUTLOOKS[r - 1].name}**. ${escapeMd(PE_OUTLOOKS[r - 1].text)}`);
    renderActive();
  }));

  /* ----- build the weighted Response Chart ----- */
  document.querySelectorAll('[data-pc-build]').forEach(b => b.addEventListener('click', () => {
    const pc = pcById(b.dataset.pcBuild);
    if(!pc) return;
    const mode = pc.chartMode || 'normal';
    const built = peBuildChart(mode);
    pc.chart = built.map(e => ({ name: e.name, rating: e.rating, segments: e.segments }));
    delete peLastResponse[pc.id];   // the old rolled response no longer matches this chart
    delete peResponseHtml[pc.id];
    persist();

    const detail = built.map(e => {
      const rr = e.typeRoll.rolls.length > 1 ? `${e.typeRoll.rolls.join('/')} → ${e.typeRoll.kept}` : `${e.typeRoll.kept}`;
      return `**${e.name}** (${peRatingLabel(e.rating)}) ×${e.segments} — type 1d100 ${rr}, size 1d6 ${e.sizeRoll}`;
    }).join('\n  - ');
    addLog('Player Emulator', `**${escapeMd(pc.name)} — Response Chart built** [${PE_MODE_LABEL[mode]}]\n  - ${detail}`);
    renderActive();
  }));

  /* ----- solo response roll (outside a full encounter) ----- */
  document.querySelectorAll('[data-pc-roll]').forEach(b => b.addEventListener('click', () => {
    const pc = pcById(b.dataset.pcRoll);
    if(!pc) return;
    const res = pePcResponse(pc);
    if(!res) return;
    peLastResponse[pc.id] = res;
    peResponseHtml[pc.id] = `<div class="result-box ${res.rating >= 4 ? 'no' : ''}">${res.rollText} &nbsp;→&nbsp; ${ratingChip(res.name, res.rating)}${res.wild ? ' <span class="small-note">(Wild card — full table)</span>' : ''}</div>`;
    addLog('Player Emulator', `**${escapeMd(pc.name)} — response** ${res.logText} → **${res.name}** (${peRatingLabel(res.rating)}).`);
    renderActive();   // the Encounter Mood follows the new response
  }));

  /* ----- encounter NPCs ----- */
  // "1d10 7" / "1d10 3/9 → 9" describing how a mood roll landed.
  const moodRollText = roll => roll.rolls.length > 1 ? `1d10 ${roll.rolls.join('/')} → ${roll.kept}` : `1d10 ${roll.kept}`;

  function addNpc(){
    const el = document.getElementById('peNewNpcName');
    const name = el.value.trim().slice(0, 60) || `NPC ${pe().npcs.length + 1}`;
    const mode = pe().npcMoodMode || 'normal';
    const roll = peRollMood(mode);
    pe().npcs.push({ id: pe().nextNpcId++, name, mood: roll.kept });
    persist();
    const m = peNpcMood(roll.kept);
    addLog('Player Emulator', `**NPC "${escapeMd(name)}" — mood** [${PE_MOOD_MODE_LABEL[mode]}] (${moodRollText(roll)}) → **${m.name}** (${peRatingLabel(m.rating)}).`);
    renderActive();
  }
  document.getElementById('btnPeAddNpc').addEventListener('click', addNpc);
  document.getElementById('peNewNpcName').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); addNpc(); } });

  const moodMode = document.getElementById('peNpcMoodMode');
  moodMode.addEventListener('change', () => {
    pe().npcMoodMode = PE_CHART_MODES.includes(moodMode.value) ? moodMode.value : 'normal';
    persist();
  });

  document.querySelectorAll('[data-npc-reroll]').forEach(b => b.addEventListener('click', () => {
    const n = npcById(b.dataset.npcReroll);
    if(!n) return;
    const mode = pe().npcMoodMode || 'normal';
    const roll = peRollMood(mode);
    n.mood = roll.kept;
    persist();
    const m = peNpcMood(n.mood);
    addLog('Player Emulator', `**NPC "${escapeMd(n.name)}" — mood reroll** [${PE_MOOD_MODE_LABEL[mode]}] (${moodRollText(roll)}) → **${m.name}** (${peRatingLabel(m.rating)}).`);
    renderActive();
  }));
  document.querySelectorAll('[data-npc-edit]').forEach(b => b.addEventListener('click', () => {
    const n = npcById(b.dataset.npcEdit);
    if(!n) return;
    editListEntry(b, n.name, v => { n.name = v.slice(0, 60); persist(); });
  }));
  document.querySelectorAll('[data-npc-rm]').forEach(b => b.addEventListener('click', () => {
    const n = npcById(b.dataset.npcRm);
    if(!n) return;
    pe().npcs = pe().npcs.filter(x => x.id !== n.id);
    persist();
    renderActive();
  }));

  const adj = document.getElementById('peAdjust');
  adj.addEventListener('change', () => {
    let v = Math.round(Number(adj.value));
    if(!Number.isFinite(v)) v = 0;
    pe().adjust = Math.max(-20, Math.min(20, v));
    persist();
    renderActive();
  });

  document.getElementById('btnPeClearEncounter').addEventListener('click', () => {
    pe().npcs = [];
    peLastResponse = {};
    peResponseHtml = {};
    persist();
    addLog('Player Emulator', '**Encounter cleared** — NPCs and PC responses removed.');
    renderActive();
  });

  /* ----- reference tables toggle ----- */
  document.getElementById('btnPeRefToggle').addEventListener('click', () => {
    peRefOpen = !peRefOpen;
    renderActive();
  });
}

// One PC's response for an encounter. Wild card Outlook rolls a fresh 1d100 on
// the full table; everyone else rolls 1d10 on their weighted chart.
function pePcResponse(pc){
  if(pc.outlook === PE_WILDCARD_OUTLOOK){
    const r = rollDie(100);
    const rt = peResponseType(r);
    return { name: rt.name, rating: rt.rating, wild: true, rollText: `1d100 ${r} (Wild card)`, logText: `(Wild card, 1d100: ${r})` };
  }
  if(!pc.chart.length) return null;
  const d10 = rollDie(10);
  const e = peChartResponseAt(pc.chart, d10);
  return { name: e.name, rating: e.rating, wild: false, rollText: `1d10 ${d10} on chart`, logText: `(1d10: ${d10} on chart)` };
}

/* ----- Response Chart editor (modal) -----
   One overlay, made on first use (div#peChartModal, a .settings-overlay).
   It edits a copy of the chart in `peChartEdit.rows`; Save writes it to the
   PC only when the rows are valid: 1-10 rows, each with a name, a rating
   -4..+4 and 1-10 segments, and the segments sum to 10. Save logs the new
   chart and drops the PC's held response (it may not be on the chart now). */
const PE_RATINGS = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

function peChartEditErrors(rows){
  const errs = [];
  if(!rows.length) errs.push('Add at least one response.');
  if(rows.length > 10) errs.push('A chart has at most 10 responses.');
  if(rows.some(r => !String(r.name).trim())) errs.push('Every response needs a name.');
  if(rows.some(r => !Number.isInteger(r.segments) || r.segments < 1 || r.segments > 10)) errs.push('Each response fills 1 to 10 segments.');
  const sum = rows.reduce((n, r) => n + (Number.isInteger(r.segments) ? r.segments : 0), 0);
  if(sum !== 10) errs.push(`The segments sum to ${sum}; they must sum to 10.`);
  return errs;
}

function peChartModalEl(){
  let el = document.getElementById('peChartModal');
  if(el) return el;
  el = document.createElement('div');
  el.id = 'peChartModal';
  el.className = 'settings-overlay pe-chart-modal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'peChartModalTitle');
  document.body.appendChild(el);
  el.addEventListener('click', e => { if(e.target === el) closePeChartEditor(); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && peChartEdit) closePeChartEditor(); });
  return el;
}

function openPeChartEditor(pcId){
  const pc = (campaign().playerEmu.pcs || []).find(p => p.id === pcId);
  if(!pc) return;
  peChartEdit = { pcId, rows: pc.chart.map(e => ({ name: e.name, rating: e.rating, segments: e.segments })) };
  if(!peChartEdit.rows.length) peChartEdit.rows.push({ name: '', rating: 0, segments: 10 });
  renderPeChartEditor();
  peChartModalEl().classList.add('open');
}
function closePeChartEditor(){
  peChartEdit = null;
  const el = document.getElementById('peChartModal');
  if(el){ el.classList.remove('open'); el.innerHTML = ''; }
}

function renderPeChartEditor(){
  const el = peChartModalEl();
  const ed = peChartEdit;
  if(!ed) return;
  const pc = campaign().playerEmu.pcs.find(p => p.id === ed.pcId);
  if(!pc){ closePeChartEditor(); return; }
  const rows = ed.rows;
  const rowHtml = rows.map((r, i) => `<tr>
      <td><input type="text" class="field-input" data-pce-name="${i}" maxlength="40" list="peTypeList" value="${escapeAttr(r.name)}" aria-label="Response ${i + 1} name"></td>
      <td><select class="field-input" data-pce-rating="${i}" aria-label="Response ${i + 1} rating">${PE_RATINGS.map(n => `<option value="${n}" ${r.rating === n ? 'selected' : ''}>${peRatingLabel(n)}</option>`).join('')}</select></td>
      <td><input type="number" class="field-input" data-pce-seg="${i}" min="1" max="10" step="1" value="${r.segments}" aria-label="Response ${i + 1} segments"></td>
      <td class="pe-chart-edit-btns">
        <button type="button" class="btn small" data-pce-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">&uarr;</button>
        <button type="button" class="btn small" data-pce-down="${i}" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="Move down">&darr;</button>
        <button type="button" class="btn small" data-pce-rm="${i}" ${rows.length <= 1 ? 'disabled' : ''} aria-label="Remove">&#10005;</button>
      </td>
    </tr>`).join('');
  el.innerHTML = `<div class="settings-inner pe-chart-edit">
    <button type="button" class="btn small settings-close" id="peChartClose" aria-label="Close">&times;</button>
    <h3 id="peChartModalTitle" class="block-title">${escapeAttr(pc.name)} — Response Chart</h3>
    <p class="small-note">A 1d10 on the chart lands on the segments in this order. Pick a Response Type from the list to fill its rating, or type your own.</p>
    <div id="peChartPreview"></div>
    <table class="pe-chart-edit-table">
      <thead><tr><th>Response</th><th>Rating</th><th>Segments</th><th></th></tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>
    <datalist id="peTypeList">${PE_RESPONSE_TYPES.map(t => `<option value="${escapeAttr(t.name)}">${peRatingLabel(t.rating)}</option>`).join('')}</datalist>
    <div class="row" style="margin-top:8px;">
      <button type="button" class="btn small" id="btnPceAdd" ${rows.length >= 10 ? 'disabled' : ''}>Add response</button>
    </div>
    <div id="peChartErrors" class="small-note" style="margin-top:10px;"></div>
    <div class="row" style="margin-top:14px; justify-content:flex-end;">
      <button type="button" class="btn" id="btnPceCancel">Cancel</button>
      <button type="button" class="btn primary" id="btnPceSave">Save chart</button>
    </div>
  </div>`;

  // Preview, errors and Save update in place, so typing keeps the focus.
  const refresh = () => {
    const errs = peChartEditErrors(rows);
    const valid = rows.filter(r => Number.isInteger(r.segments) && r.segments > 0);
    document.getElementById('peChartPreview').innerHTML = valid.length ? peChartBarHtml(valid, true) : '';
    document.getElementById('peChartErrors').innerHTML = errs.map(escapeAttr).join('<br>');
    document.getElementById('btnPceSave').disabled = errs.length > 0;
  };
  const q = sel => el.querySelectorAll(sel);
  q('[data-pce-name]').forEach(inp => {
    inp.addEventListener('input', () => { rows[Number(inp.dataset.pceName)].name = inp.value.slice(0, 40); refresh(); });
    inp.addEventListener('change', () => {
      const i = Number(inp.dataset.pceName);
      const t = PE_RESPONSE_TYPES.find(x => x.name.toLowerCase() === inp.value.trim().toLowerCase());
      if(t){ rows[i].name = t.name; rows[i].rating = t.rating; renderPeChartEditor(); }
    });
  });
  q('[data-pce-rating]').forEach(sel => sel.addEventListener('change', () => {
    const n = Number(sel.value);
    rows[Number(sel.dataset.pceRating)].rating = PE_RATINGS.includes(n) ? n : 0;
    refresh();
  }));
  q('[data-pce-seg]').forEach(inp => inp.addEventListener('input', () => {
    const n = Number(inp.value);
    rows[Number(inp.dataset.pceSeg)].segments = Number.isFinite(n) ? n : 0;
    refresh();
  }));
  const move = (i, j) => { const [r] = rows.splice(i, 1); rows.splice(j, 0, r); renderPeChartEditor(); };
  q('[data-pce-up]').forEach(b => b.addEventListener('click', () => { const i = Number(b.dataset.pceUp); move(i, i - 1); }));
  q('[data-pce-down]').forEach(b => b.addEventListener('click', () => { const i = Number(b.dataset.pceDown); move(i, i + 1); }));
  q('[data-pce-rm]').forEach(b => b.addEventListener('click', () => { rows.splice(Number(b.dataset.pceRm), 1); renderPeChartEditor(); }));
  document.getElementById('btnPceAdd').addEventListener('click', () => {
    if(rows.length >= 10) return;
    const used = rows.reduce((n, r) => n + (Number.isInteger(r.segments) ? r.segments : 0), 0);
    rows.push({ name: '', rating: 0, segments: Math.max(1, Math.min(10, 10 - used)) });
    renderPeChartEditor();
    const inputs = el.querySelectorAll('[data-pce-name]');
    if(inputs.length) inputs[inputs.length - 1].focus();
  });
  document.getElementById('peChartClose').addEventListener('click', closePeChartEditor);
  document.getElementById('btnPceCancel').addEventListener('click', closePeChartEditor);
  document.getElementById('btnPceSave').addEventListener('click', () => {
    if(peChartEditErrors(rows).length) return;
    const pc2 = campaign().playerEmu.pcs.find(p => p.id === ed.pcId);
    if(!pc2){ closePeChartEditor(); return; }
    pc2.chart = rows.map(r => ({ name: String(r.name).trim().slice(0, 40), rating: r.rating, segments: r.segments }));
    delete peLastResponse[pc2.id];
    delete peResponseHtml[pc2.id];
    persist();
    addLog('Player Emulator', `**${escapeMd(pc2.name)} — Response Chart edited**\n  - ${pc2.chart.map(e => `**${escapeMd(e.name)}** (${peRatingLabel(e.rating)}) ×${e.segments}`).join('\n  - ')}`);
    closePeChartEditor();
    renderActive();
  });
  refresh();
}

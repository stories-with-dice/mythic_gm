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
let peEncounterHtml = '';
let peResponseHtml = {};      // pc id -> last "Roll response" result HTML (shown on the PC card)
let peLastResponse = {};      // pc id -> last response { name, rating, wild, ... } for reuse in an encounter
let peRefOpen = false;        // reference tables collapsed by default

function renderPlayerEmu(){
  const pe = campaign().playerEmu || (campaign().playerEmu = freshPlayerEmu());

  const pcCards = pe.pcs.map(pc => {
    const outlook = pc.outlook ? PE_OUTLOOKS[pc.outlook - 1] : null;
    const wild = pc.outlook === PE_WILDCARD_OUTLOOK;
    const total = pc.chart.reduce((s, e) => s + e.rating, 0);

    const chartBar = pc.chart.length
      ? `<div class="pe-chart">${pc.chart.map(e => `
          <span class="seg ${peRatingClass(e.rating)}" style="flex:${e.segments}" title="${escapeAttr(e.name)} (${peRatingLabel(e.rating)}) — ${e.segments}/10">${peRatingLabel(e.rating)}</span>`).join('')}</div>
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
        <button class="btn primary" data-pc-roll="${pc.id}" ${pc.chart.length || wild ? '' : 'disabled'}>Roll response</button>
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
      <button type="button" data-npc-reroll="${n.id}" title="Reroll mood">&#8635;</button>
      <button type="button" data-npc-rm="${n.id}" title="Remove">&#10005;</button>
    </li>`;
  }).join('');

  const canGenerate = pe.pcs.some(p => p.chart.length || p.outlook === PE_WILDCARD_OUTLOOK) || pe.npcs.length;

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
    <p class="small-note" style="margin-top:-4px;">Add the NPCs, animals, friends and foes present, then generate the party's mood. Each NPC gets one mood.</p>
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
    <div class="row" style="margin-top:12px; align-items:flex-end;">
      <div class="field">
        <label for="peAdjust">Extra conflict (animals, friends, foes not listed)</label>
        <input type="number" id="peAdjust" class="field-input" style="min-width:90px;" value="${pe.adjust}" min="-20" max="20" step="1">
      </div>
      <button class="btn primary" id="btnPeGenerateMood" ${canGenerate ? '' : 'disabled'}>Generate Encounter Mood</button>
      <button class="btn" id="btnPeClearEncounter" ${pe.npcs.length || peEncounterHtml ? '' : 'disabled'}>Clear encounter</button>
    </div>
    <label class="small-note" style="display:flex; align-items:center; gap:6px; margin-top:8px;">
      <input type="checkbox" id="peUseHeldResponses" ${pe.useHeldResponses !== false ? 'checked' : ''}>
      Reuse each PC's last rolled response where one exists (uncheck to roll every PC fresh)
    </label>
    <div id="peEncounterResult" style="margin-top:12px;">${peEncounterHtml}</div>
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
    pe().pcs.push({ id: pe().nextPcId++, name, outlook: null, chartMode: 'normal', chart: [] });
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
    document.getElementById('peResponseResult_' + pc.id).innerHTML = peResponseHtml[pc.id];
    addLog('Player Emulator', `**${escapeMd(pc.name)} — response** ${res.logText} → **${res.name}** (${peRatingLabel(res.rating)}).`);
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

  const useHeldCb = document.getElementById('peUseHeldResponses');
  useHeldCb.addEventListener('change', () => { pe().useHeldResponses = useHeldCb.checked; persist(); });

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

  /* ----- generate the whole encounter's mood ----- */
  document.getElementById('btnPeGenerateMood').addEventListener('click', () => {
    const data = pe();
    const active = data.pcs.filter(p => p.chart.length || p.outlook === PE_WILDCARD_OUTLOOK);
    const skipped = data.pcs.filter(p => !p.chart.length && p.outlook !== PE_WILDCARD_OUTLOOK);

    if(!active.length && !data.npcs.length){
      peEncounterHtml = '<div class="result-box">Nothing to roll — add a PC with a Response Chart, or an NPC.</div>';
      document.getElementById('peEncounterResult').innerHTML = peEncounterHtml;
      return;
    }

    const useHeld = data.useHeldResponses !== false;   // default on, incl. pre-existing session campaigns
    let heldCount = 0;
    const lines = [];   // {label, name, rating, detail}
    active.forEach(pc => {
      let res, held = false;
      if(useHeld && peLastResponse[pc.id]){
        res = peLastResponse[pc.id];
        held = true;
        heldCount++;
      } else {
        res = pePcResponse(pc);
        peLastResponse[pc.id] = res;
        peResponseHtml[pc.id] = `<div class="result-box ${res.rating >= 4 ? 'no' : ''}">${res.rollText} &nbsp;→&nbsp; ${ratingChip(res.name, res.rating)}${res.wild ? ' <span class="small-note">(Wild card — full table)</span>' : ''}</div>`;
      }
      lines.push({ label: pc.name, name: res.name, rating: res.rating, detail: held ? 'held from earlier roll' : res.rollText + (res.wild ? ' · Wild card' : '') });
    });
    data.npcs.forEach(n => {
      const m = peNpcMood(n.mood);
      lines.push({ label: n.name, name: m.name, rating: m.rating, detail: '1d10 ' + n.mood });
    });

    const partySum = lines.reduce((s, l) => s + l.rating, 0);
    const total = partySum + data.adjust;
    const violent = total >= 4;

    const rows = lines.map(l => `<tr>
      <td>${escapeAttr(l.label)}</td>
      <td><b>${escapeAttr(l.name)}</b></td>
      <td class="pe-rating ${peRatingClass(l.rating)}">${peRatingLabel(l.rating)}</td>
      <td class="small-note">${escapeAttr(l.detail)}</td>
    </tr>`).join('');
    const adjRow = data.adjust
      ? `<tr><td>Extra conflict</td><td>&mdash;</td><td class="pe-rating ${peRatingClass(data.adjust)}">${peRatingLabel(data.adjust)}</td><td class="small-note">manual</td></tr>`
      : '';

    peEncounterHtml = `<div class="result-box ${violent ? 'no' : ''}">
      <div style="overflow-x:auto;"><table class="pe-ref-table">
        <thead><tr><th>Participant</th><th>Response / Mood</th><th>Rating</th><th>Roll</th></tr></thead>
        <tbody>${rows}${adjRow}</tbody>
      </table></div>
      <div style="margin-top:10px;">Total conflict rating:
        <span class="roll-num">${total}</span>
        <span class="pe-rating ${peRatingClass(total)}" style="margin-left:6px;">${peRatingLabel(total)}</span>
      </div>
      <div class="${violent ? 'banner-solved' : 'small-note'}" style="margin-top:8px;">
        ${violent
          ? '&#9876;&#65039; Violent encounter begins — the tension reached + + + + or more.'
          : 'No violence — the tension stays below + + + +. Play out the interaction.'}
      </div>
      ${heldCount ? `<div class="small-note">Reused ${heldCount} held PC response${heldCount === 1 ? '' : 's'} (checkbox on).</div>` : ''}
      ${skipped.length ? `<div class="small-note">${skipped.length} PC${skipped.length === 1 ? '' : 's'} skipped (no Response Chart): ${skipped.map(p => escapeAttr(p.name)).join(', ')}.</div>` : ''}
    </div>`;

    const logRows = lines.map(l => `${escapeMd(l.label)}: ${l.name} (${peRatingLabel(l.rating)}) [${l.detail}]`).join('\n  - ');
    addLog('Player Emulator',
      `**Encounter Mood** — total ${total} (${peRatingLabel(total)}) → **${violent ? 'Violent encounter begins' : 'no violence'}**\n  - ${logRows}` +
      (data.adjust ? `\n  - Extra conflict: ${peRatingLabel(data.adjust)}` : '') +
      (heldCount ? `\n  - Reused ${heldCount} held PC response${heldCount === 1 ? '' : 's'}` : '') +
      (skipped.length ? `\n  - Skipped (no chart): ${skipped.map(p => escapeMd(p.name)).join(', ')}` : ''));
    renderActive();
  });

  document.getElementById('btnPeClearEncounter').addEventListener('click', () => {
    pe().npcs = [];
    peEncounterHtml = '';
    persist();
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

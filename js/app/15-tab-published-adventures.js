/* =========================================================================
   TAB: PUBLISHED ADVENTURES  ("Deconstruct The Known" — Mythic Magazine #50)
   -------------------------------------------------------------------------
   Runs a prepared adventure as a giant Meaning table. This tab SHARES the
   campaign's Chaos Factor, scene number, Threads/Characters Lists and Random
   Event Focus Table with the Mythic GME tab (all on `campaign().gme`); the
   deconstructed-specific state lives in `campaign().gme.deconstructed`:

     - Adventure Die (by page count) + running page counter + section (1d6)
     - Adventure Meaning List (<=20 single words), fed by every Adventure Element
     - Crisis Scenes: a 4th Scene type (even roll ABOVE the Chaos Factor) with
       its own Crisis Scene Progress Points and element/special/conclusion tables
     - Diminisher Value + a divide-a-value helper

   Scene test here uses the Deconstructed variant:
       roll > CF & odd  -> Expected
       roll > CF & even -> CRISIS SCENE          (10 counts as even)
       roll <= CF & odd -> Altered  + Adventure Element
       roll <= CF & even-> Interrupt + Event Focus + Adventure Element
   ========================================================================= */

// Adventure Die table (Mythic Magazine #50). Some page bands offer a choice.
const ADVENTURE_DIE_BANDS = [
  { max: 16,       dice: ['d4'] },
  { max: 24,       dice: ['d6'] },
  { max: 32,       dice: ['d8'] },
  { max: 40,       dice: ['d10'] },
  { max: 48,       dice: ['d12'] },
  { max: 80,       dice: ['d20'] },
  { max: 160,      dice: ['2d20', 'd100'] },
  { max: 240,      dice: ['3d20', 'd100'] },
  { max: 320,      dice: ['4d20', 'd100'] },
  { max: Infinity, dice: ['d100'] }
];
function adventureDieOptions(pages){
  if(!pages || pages < 1) return ADVENTURE_DICE.slice();
  return (ADVENTURE_DIE_BANDS.find(b => pages <= b.max) || ADVENTURE_DIE_BANDS[ADVENTURE_DIE_BANDS.length - 1]).dice;
}
function rollAdventureDie(spec){
  const m = /^(\d*)d(\d+)$/.exec(spec || '');
  if(!m) return rollDie(100);
  const n = m[1] ? Number(m[1]) : 1;
  const sides = Number(m[2]);
  let total = 0;
  for(let i = 0; i < n; i++) total += rollDie(sides);
  return total;
}

const PAGE_SECTIONS = ['upper left', 'upper right', 'middle left', 'middle right', 'lower left', 'lower right'];

// Crisis Scene Element Table (1d10 + Crisis Progress Points)
function crisisElement(total){
  if(total <= 9)   return { key: 'element',       label: 'Adventure Element' };
  if(total <= 11)  return { key: 'list',          label: '1d10 List or Adventure Element' };
  if(total === 12) return { key: 'element',       label: 'Adventure Element' };
  if(total === 13) return { key: 'special',       label: 'Special' };
  if(total === 14) return { key: 'listPP',        label: '1d10 + Progress Points List or Adventure Element' };
  if(total === 15) return { key: 'conclusion',    label: 'Conclusion' };
  return { key: 'elementMinus6', label: 'Adventure Element, Progress Points −6' };
}

// Special Elements Table (1d100) — every row rolls an Adventure Element
function specialElement(roll){
  if(roll <= 20) return { label: 'WATCH OUT!',        note: 'Interpret the Adventure Element with greater intensity and urgency — kick it up a notch.', pp: 1 };
  if(roll <= 45) return { label: 'THIS IS BAD',       note: 'Interpret the Adventure Element as something unfortunate or negative for the PC.',          pp: 1 };
  if(roll <= 70) return { label: 'THIS IS GOOD',      note: 'Interpret the Adventure Element as something fortunate or positive for the PC.',             pp: 1 };
  if(roll <= 80) return { label: 'MOVING ALONG',      note: 'Add 3 Crisis Progress Points instead of 1.',                                                 pp: 3 };
  if(roll <= 85) return { label: 'ROLLING BACK',      note: 'Subtract 2 Crisis Progress Points instead of adding 1.',                                     pp: -2 };
  return { label: 'ADVENTURE ELEMENT', note: 'Just roll an Adventure Element.', pp: 1 };
}

const DIMINISHER_CONTEXT = {
  '1/3':  'Maybe simplify challenges a little.',
  '1/5':  'Simplify challenges a lot. Think "one person" instead of a group.',
  '1/7':  'Difficult challenges must be reduced so much you may need to reinterpret them into something closer to what your PC can handle.',
  '1/10': 'Reinterpret the challenge a magnitude or two lower and simpler; some challenges may have to be removed entirely.'
};
const DIMINISHER_DIV = { '1/3': 3, '1/5': 5, '1/7': 7, '1/10': 10 };

// Roll one Adventure Element: advance the page counter by the Adventure Die
// (wrapping at the page count), then roll 1d6 for the section of the page.
function rollAdventureElement(d){
  const dieResult = rollAdventureDie(d.adventureDie);
  const raw = (d.latestPage || 0) + dieResult;
  const pc = d.pageCount || 0;
  let page = raw, wrapped = false;
  if(pc > 0){ while(page > pc){ page -= pc; wrapped = true; } }
  const secRoll = rollDie(6);
  d.latestPage = page;
  d.pageHistory.push(page);
  persist();
  return { dieResult, raw, page, wrapped, secRoll, section: PAGE_SECTIONS[secRoll - 1] };
}

// transient result HTML, cached against renderActive()
let pubSceneTestHtml = '';
let pubCrisisHtml = '';
let pubElementHtml = '';
let pubMeaningRollHtml = '';
let pubFlowOpen = false;   // "How it works" flowchart, collapsed by default

const PUB_FLOW_HTML = `
<div class="pub-flow">
  <div class="flow-group">
    <h4>Setup — once</h4>
    <div class="flow-step"><b>1.</b> Pick a prepared adventure. Enter its <b>total page count</b> to get the <b>Adventure Die</b>.</div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>2.</b> Choose a <b>Diminisher Value</b> (1/3&ndash;1/10) for how outmatched your lone PC is.</div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>3.</b> <b>Roll Adventure Element(s)</b> &mdash; a page + a 1d6 section &mdash; and weave them into a <b>First Scene</b> concept.</div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>4.</b> Seed the <b>Threads &amp; Characters Lists</b> from that concept, and add one summary word per Element to the <b>Adventure Meaning List</b>.</div>
  </div>

  <div class="flow-group">
    <h4>Each Scene — repeat</h4>
    <div class="flow-step"><b>A.</b> Write your <b>Expected Scene</b> &mdash; what you think happens next.</div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>B.</b> <b>Test vs Chaos Factor</b> (1d10):</div>
    <ul class="flow-branch">
      <li>&gt; CF &amp; <b>odd</b> &rarr; <b>Expected Scene</b> &mdash; play it as written, no Element.</li>
      <li>&gt; CF &amp; <b>even</b> &rarr; <b>Crisis Scene</b> &mdash; roll 1d10 + Crisis PP on the Crisis Scene Element Table and resolve it.</li>
      <li>&le; CF &amp; <b>odd</b> &rarr; <b>Altered Scene</b> &mdash; keep the Expected Scene, add a rolled Adventure Element.</li>
      <li>&le; CF &amp; <b>even</b> &rarr; <b>Interrupt Scene</b> &mdash; roll Event Focus, then an Adventure Element instead of a Meaning word.</li>
    </ul>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>C.</b> Interpret every Adventure Element rolled (apply the <b>Diminisher</b> to any stats), then add a one-word summary to the Meaning List (max 20).</div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>D.</b> Play the scene out with Fate Questions and the Meaning tables.</div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>E.</b> <b>Bookkeeping</b> &mdash; update the Lists, set the Chaos Factor (PC in control &minus;1 / not +1), advance the scene.</div>
    <div class="flow-loop">&#8635; back to A for the next Scene.</div>
  </div>
</div>`;

function renderPublished(){
  const g = campaign().gme;
  const d = g.deconstructed;

  const dieOpts = adventureDieOptions(d.pageCount);
  const dieOptionEls = dieOpts.map(o => `<option value="${o}" ${o === d.adventureDie ? 'selected' : ''}>${o}</option>`).join('');
  const histTail = d.pageHistory.slice(-16);
  const histStr = (d.pageHistory.length > 16 ? '… → ' : '') + (histTail.length ? histTail.join(' → ') : 'none yet');

  const meaningRows = d.meaningList.map((w, i) => `
    <li>
      <span class="mnum">${i + 1}</span>
      <span class="txt">${escapeAttr(w)}</span>
      <button type="button" data-mn-rm="${i}" title="Remove">&#10005;</button>
    </li>`).join('');

  const dim = DIMINISHER_VALUES.map(v => `<option value="${v}" ${v === d.diminisher ? 'selected' : ''}>${v}</option>`).join('');

  return `
  <h2 class="tool-title">Published Adventures — Deconstruct The Known</h2>
  <p class="tool-desc">Run a prepared adventure as one giant Meaning table. Roll a page, roll a section, and interpret what you find into the ongoing story. Chaos Factor, scene count, Lists and the Event Focus Table are shared with the <b>Mythic GME</b> tab.</p>

  <div class="card">
    <div class="row" style="justify-content:space-between; align-items:center;">
      <h3 class="block-title" style="margin:0; padding:0; border:0;">How it works</h3>
      <button class="btn small" id="btnPubFlowToggle">${pubFlowOpen ? 'Hide' : 'Show'}</button>
    </div>
    ${pubFlowOpen ? PUB_FLOW_HTML : '<div class="small-note" style="margin-top:6px;">A quick flowchart of the Deconstructed Adventures loop.</div>'}
  </div>

  <div class="card">
    <h3 class="block-title">The Prepared Adventure</h3>
    <div class="row" style="align-items:flex-end;">
      <div class="field" style="flex:1; min-width:200px;">
        <label for="pubTitle">Adventure title</label>
        <input type="text" id="pubTitle" class="field-input" value="${escapeAttr(d.title)}" placeholder="e.g. The Sword Of Cacinth Castle">
      </div>
      <div class="field">
        <label for="pubPageCount">Total pages</label>
        <input type="number" id="pubPageCount" class="field-input" style="width:90px;" min="0" value="${d.pageCount || ''}" placeholder="256">
      </div>
      <div class="field">
        <label for="pubAdvDie">Adventure Die</label>
        <select id="pubAdvDie" class="field-input">${dieOptionEls}</select>
      </div>
    </div>
    <div class="field" style="margin-top:12px;">
      <label for="pubFirstScene">First Scene concept</label>
      <textarea id="pubFirstScene" class="field-input" rows="2" style="width:100%; resize:vertical;" placeholder="Roll a few Adventure Elements below, then weave them into why the PC is here.">${escapeAttr(d.firstSceneConcept)}</textarea>
    </div>
  </div>

  <div class="card">
    <h3 class="block-title">Adventure Element</h3>
    <div class="row" style="gap:26px; align-items:center;">
      <div class="pp-readout"><span class="num">${d.latestPage || '—'}</span><span class="lbl">latest page</span></div>
      <button class="btn primary" id="btnPubRollElement">Roll Adventure Element</button>
      <button class="btn small" id="btnPubResetPages" ${d.pageHistory.length ? '' : 'disabled'}>Reset page tracker</button>
    </div>
    <div class="small-note" style="margin-top:8px;">Pages rolled: ${histStr}</div>
    <div id="pubElementResult" style="margin-top:12px;">${pubElementHtml}</div>
  </div>

  <div class="card">
    <h3 class="block-title">Chaos Factor &amp; Scene (Deconstructed test)</h3>
    <div class="row" style="gap:26px; align-items:center;">
      <div class="pp-readout"><span class="num">${g.chaosFactor}</span><span class="lbl">Chaos Factor (1–9)</span></div>
      <div class="row">
        <button class="btn small" id="btnPubCfMinus">CF &minus;1</button>
        <button class="btn small" id="btnPubCfPlus">CF +1</button>
      </div>
      <div class="pp-readout"><span class="num">${g.sceneNumber}</span><span class="lbl">Scene</span></div>
    </div>
    <div class="field" style="margin-top:14px;">
      <label for="pubExpectedScene">Expected Scene — how you think Scene ${g.sceneNumber} will start</label>
      <textarea id="pubExpectedScene" class="field-input" rows="2" style="width:100%; resize:vertical;" placeholder="e.g. Gandle explores the next layer of the cavern.">${escapeAttr(g.expectedScene)}</textarea>
    </div>
    <div class="row"><button class="btn primary" id="btnPubTestScene">Test vs Chaos Factor</button></div>
    <div class="small-note" style="margin-top:-2px;">&gt; CF &amp; odd → Expected &nbsp;·&nbsp; &gt; CF &amp; even → <b>Crisis Scene</b> &nbsp;·&nbsp; ≤ CF → Altered (odd) / Interrupt (even), each with an Adventure Element.</div>
    <div id="pubSceneTestResult" style="margin-top:12px;">${pubSceneTestHtml}</div>
    <div class="divider"></div>
    <div class="row" style="align-items:flex-end;">
      <div class="field">
        <label for="pubControl">End of Scene — was the PC in control?</label>
        <select id="pubControl" class="field-input">
          <option value="in">Yes — in control (Chaos Factor −1)</option>
          <option value="out">No — not in control (Chaos Factor +1)</option>
        </select>
      </div>
      <button class="btn" id="btnPubEndScene">End Scene &amp; Update CF</button>
    </div>
  </div>

  <div class="card">
    <h3 class="block-title">Crisis Scenes</h3>
    <p class="small-note" style="margin-top:-4px;">A 4th Scene type: an even roll <i>above</i> the Chaos Factor. Each Crisis adds a Crisis Progress Point (some results change that). Generated automatically by the Deconstructed test, or on demand here.</p>
    <div class="row" style="gap:26px; align-items:center;">
      <div class="pp-readout"><span class="num">${d.crisisPP}</span><span class="lbl">Crisis Progress Points</span></div>
      <div class="row">
        <button class="btn small" id="btnPubCppMinus">−1</button>
        <button class="btn small" id="btnPubCppPlus">+1</button>
      </div>
      <button class="btn primary" id="btnPubCrisis">Generate Crisis Scene</button>
    </div>
    <div id="pubCrisisResult" style="margin-top:12px;">${pubCrisisHtml}</div>
  </div>

  <div class="grid2">
    <div class="card">
      <h3 class="block-title">Adventure Meaning List</h3>
      <p class="small-note" style="margin-top:-4px;">One word per Adventure Element you interpret (max 20). Rolled during Crisis Scenes.</p>
      <div class="row">
        <input type="text" id="pubMeaningInput" class="field-input" style="flex:1; min-width:160px;" placeholder="A single word…" ${d.meaningList.length >= 20 ? 'disabled' : ''}>
        <button class="btn" id="btnPubAddMeaning" ${d.meaningList.length >= 20 ? 'disabled' : ''}>Add</button>
        <button class="btn primary" id="btnPubRollMeaning" ${d.meaningList.length ? '' : 'disabled'}>Roll 1d10</button>
      </div>
      <div id="pubMeaningRollResult" style="margin-top:10px;">${pubMeaningRollHtml}</div>
      ${d.meaningList.length
        ? `<ul class="gme-list pub-meaning-list">${meaningRows}</ul><div class="small-note">${d.meaningList.length} / 20</div>`
        : `<div class="small-note">No words yet.</div>`}
    </div>

    <div class="card">
      <h3 class="block-title">Diminisher Value</h3>
      <p class="small-note" style="margin-top:-4px;">Scale a party-sized adventure down to your lone PC.</p>
      <div class="field" style="max-width:120px;">
        <label for="pubDiminisher">Diminisher</label>
        <select id="pubDiminisher" class="field-input">${dim}</select>
      </div>
      <div class="small-note" style="margin-top:8px;">${DIMINISHER_CONTEXT[d.diminisher]}</div>
      <div class="row" style="margin-top:12px; align-items:flex-end;">
        <div class="field">
          <label for="pubScaleValue">Scale a value</label>
          <input type="number" id="pubScaleValue" class="field-input" style="width:120px;" placeholder="e.g. 200">
        </div>
        <div class="pp-readout"><span class="num" id="pubScaleResult">—</span><span class="lbl">÷ ${d.diminisher}, rounded</span></div>
      </div>
    </div>
  </div>
  `;
}

function wirePublished(){
  const g = () => campaign().gme;
  const d = () => campaign().gme.deconstructed;

  const applyMd = lines => `<div class="result-box event">${
    lines.map(l => l.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>')).join('<br>')
  }</div>`;

  function rollElementLines(why){
    const ae = rollAdventureElement(d());
    return {
      ae,
      line: `Adventure Element${why ? ` (${why})` : ''}: ${d().adventureDie}(${ae.dieResult})${ae.wrapped ? ' — wrapped past the end' : ''} → page **${ae.page}**, 1d6(${ae.secRoll}) → **${ae.section}**. Read that section, interpret it, then add a one-word summary to the Meaning List.`
    };
  }

  document.getElementById('btnPubFlowToggle').addEventListener('click', () => {
    pubFlowOpen = !pubFlowOpen;
    renderActive();
  });

  /* ---- The Prepared Adventure ---- */
  const title = document.getElementById('pubTitle');
  title.addEventListener('input', () => { d().title = title.value; persist(); });
  const firstScene = document.getElementById('pubFirstScene');
  firstScene.addEventListener('input', () => { d().firstSceneConcept = firstScene.value; persist(); });

  document.getElementById('pubPageCount').addEventListener('change', e => {
    const v = Math.max(0, Math.round(Number(e.target.value)) || 0);
    d().pageCount = v;
    const opts = adventureDieOptions(v);
    if(!opts.includes(d().adventureDie)) d().adventureDie = opts[0];
    persist();
    renderActive();
  });
  document.getElementById('pubAdvDie').addEventListener('change', e => { d().adventureDie = e.target.value; persist(); });

  /* ---- Adventure Element ---- */
  document.getElementById('btnPubRollElement').addEventListener('click', () => {
    const { line } = rollElementLines();
    pubElementHtml = applyMd([line]);
    addLog('Published Adventures', `**Adventure Element** — ` + line);
    renderActive();
  });
  document.getElementById('btnPubResetPages').addEventListener('click', () => {
    if(!d().pageHistory.length) return;
    if(!confirm('Reset the page tracker (latest page and history)?')) return;
    d().latestPage = 0;
    d().pageHistory = [];
    pubElementHtml = '';
    persist();
    addLog('Published Adventures', '**Page tracker reset.**');
    renderActive();
  });

  /* ---- Chaos Factor / Scene ---- */
  document.getElementById('btnPubCfMinus').addEventListener('click', () => {
    g().chaosFactor = Math.max(1, g().chaosFactor - 1);
    persist(); addLog('Published Adventures', `**Chaos Factor** lowered to ${g().chaosFactor}.`); renderActive();
  });
  document.getElementById('btnPubCfPlus').addEventListener('click', () => {
    g().chaosFactor = Math.min(9, g().chaosFactor + 1);
    persist(); addLog('Published Adventures', `**Chaos Factor** raised to ${g().chaosFactor}.`); renderActive();
  });
  const exp = document.getElementById('pubExpectedScene');
  exp.addEventListener('input', () => { g().expectedScene = exp.value; persist(); });

  document.getElementById('btnPubEndScene').addEventListener('click', () => {
    const inControl = document.getElementById('pubControl').value === 'in';
    const gme = g();
    const ended = gme.sceneNumber;
    gme.chaosFactor = inControl ? Math.max(1, gme.chaosFactor - 1) : Math.min(9, gme.chaosFactor + 1);
    gme.sceneNumber += 1;
    gme.expectedScene = '';
    pubSceneTestHtml = '';
    persist();
    addLog('Published Adventures', `**Scene ${ended} ended** — PC ${inControl ? 'in control → Chaos Factor −1' : 'not in control → Chaos Factor +1'} (now ${gme.chaosFactor}). Beginning Scene ${gme.sceneNumber}.`);
    renderActive();
  });

  document.getElementById('btnPubTestScene').addEventListener('click', () => {
    const cf = g().chaosFactor;
    const roll = rollDie(10);
    const even = roll % 2 === 0;
    const over = roll > cf;
    let type;
    if(over) type = even ? 'Crisis Scene' : 'Expected Scene';
    else type = even ? 'Interrupt Scene' : 'Altered Scene';

    const expText = (g().expectedScene || '').trim();
    const lines = [`1d10: **${roll}** vs Chaos Factor **${cf}** → **${type}**`];
    if(expText) lines.push(`Expected: *${escapeMd(expText)}*`);

    if(type === 'Expected Scene'){
      lines.push('Your Expected Scene starts as imagined. Play it as a normal Mythic Scene — no Adventure Element.');
    } else if(type === 'Altered Scene'){
      lines.push('Use your Expected Scene, but add a rolled Adventure Element:');
      lines.push(rollElementLines().line);
    } else if(type === 'Interrupt Scene'){
      const fRoll = rollDie(100);
      const focus = rollEventFocus(g().eventFocusTable, fRoll);
      lines.push(`Event Focus (1d100: ${fRoll}) → **${escapeMd(focus)}**. Instead of a Meaning word, roll an Adventure Element:`);
      lines.push(rollElementLines().line);
    } else { // Crisis Scene
      lines.push('An even roll above the Chaos Factor triggers a **Crisis Scene** — generated below:');
      lines.push(...crisisSceneLines());
    }

    pubSceneTestHtml = applyMd(lines);
    document.getElementById('pubSceneTestResult').innerHTML = pubSceneTestHtml;
    if(type === 'Crisis Scene'){ pubCrisisHtml = pubSceneTestHtml; }
    addLog('Published Adventures', `**Test Expected Scene ${g().sceneNumber}** —\n  - ` + lines.join('\n  - '));
    renderActive();
  });

  /* ---- Crisis Scene generation ---- */
  function crisisSceneLines(){
    const dec = d();
    const cpp = dec.crisisPP;
    const r = rollDie(10);
    const total = r + cpp;
    const el = crisisElement(total);
    const lines = [`Crisis Scene Element — 1d10(${r}) + ${cpp} Crisis PP = **${total}** → **${el.label}**`];
    let ppDelta = el.key === 'elementMinus6' ? -6 : 1;

    if(el.key === 'element' || el.key === 'elementMinus6'){
      lines.push(rollElementLines().line);
    } else if(el.key === 'list'){
      if(dec.meaningList.length){
        const slot = rollDie(10);
        const word = dec.meaningList[slot - 1];
        if(word){
          lines.push(`1d10 on the Meaning List → slot ${slot} → **${word}**. Interpret it as a dramatic Crisis; if you can't, roll an Adventure Element to combine with it.`);
        } else {
          lines.push(`1d10 on the Meaning List → slot ${slot} → *(blank)* → roll an Adventure Element instead:`);
          lines.push(rollElementLines().line);
        }
      } else {
        lines.push('Meaning List is empty → roll an Adventure Element instead:');
        lines.push(rollElementLines().line);
      }
    } else if(el.key === 'listPP'){
      const r2 = rollDie(10);
      const t2 = r2 + cpp;
      const word = dec.meaningList[t2 - 1];
      if(t2 <= 20 && word){
        lines.push(`1d10(${r2}) + ${cpp} PP = ${t2} on the Meaning List → **${word}**. Interpret it as a dramatic Crisis.`);
      } else {
        lines.push(`1d10(${r2}) + ${cpp} PP = ${t2} on the Meaning List → ${t2 > 20 ? 'over 20' : 'blank / empty'} → roll an Adventure Element instead:`);
        lines.push(rollElementLines().line);
      }
    } else if(el.key === 'special'){
      const sr = rollDie(100);
      const sp = specialElement(sr);
      ppDelta = sp.pp;
      lines.push(`Special — 1d100(${sr}) → **${sp.label}**: ${sp.note}`);
      lines.push(rollElementLines().line);
    } else if(el.key === 'conclusion'){
      lines.push('**Conclusion** — build a Scene where the adventure\'s main goal could be resolved (a final showdown, etc.). It needn\'t actually end the adventure. Roll an Adventure Element from the panel above if you want more inspiration.');
    }

    const before = dec.crisisPP;
    dec.crisisPP = Math.max(0, dec.crisisPP + ppDelta);
    lines.push(`Crisis Progress Points: ${before} ${ppDelta >= 0 ? '+' : '−'} ${Math.abs(ppDelta)} → **${dec.crisisPP}**`);
    persist();
    return lines;
  }

  document.getElementById('btnPubCrisis').addEventListener('click', () => {
    const lines = crisisSceneLines();
    pubCrisisHtml = applyMd(lines);
    addLog('Published Adventures', `**Crisis Scene** —\n  - ` + lines.join('\n  - '));
    renderActive();
  });
  document.getElementById('btnPubCppMinus').addEventListener('click', () => {
    d().crisisPP = Math.max(0, d().crisisPP - 1); persist(); renderActive();
  });
  document.getElementById('btnPubCppPlus').addEventListener('click', () => {
    d().crisisPP += 1; persist(); renderActive();
  });

  /* ---- Adventure Meaning List ---- */
  function addMeaning(){
    const el = document.getElementById('pubMeaningInput');
    const v = el.value.trim();
    if(!v || d().meaningList.length >= 20) return;
    d().meaningList.push(v);
    persist();
    addLog('Published Adventures', `**Meaning List** — added "${escapeMd(v)}" (${d().meaningList.length}/20).`);
    renderActive();
  }
  document.getElementById('btnPubAddMeaning').addEventListener('click', addMeaning);
  document.getElementById('pubMeaningInput').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); addMeaning(); } });
  document.querySelectorAll('[data-mn-rm]').forEach(b => b.addEventListener('click', () => {
    const [removed] = d().meaningList.splice(Number(b.dataset.mnRm), 1);
    persist();
    addLog('Published Adventures', `**Meaning List** — removed "${escapeMd(removed)}".`);
    renderActive();
  }));
  document.getElementById('btnPubRollMeaning').addEventListener('click', () => {
    const list = d().meaningList;
    if(!list.length) return;
    const slot = rollDie(10);
    const word = list[slot - 1];
    pubMeaningRollHtml = `<div class="result-box"><span class="roll-num">${slot}</span> → ${word ? `<b>${escapeAttr(word)}</b>` : '<i>(blank slot — roll an Adventure Element instead)</i>'}</div>`;
    addLog('Published Adventures', `**Roll on Meaning List** — 1d10: ${slot} → ${word ? `**${escapeMd(word)}**` : '*(blank)*'}`);
    document.getElementById('pubMeaningRollResult').innerHTML = pubMeaningRollHtml;
  });

  /* ---- Diminisher ---- */
  document.getElementById('pubDiminisher').addEventListener('change', e => {
    d().diminisher = e.target.value; persist(); renderActive();
  });
  const scaleIn = document.getElementById('pubScaleValue');
  scaleIn.addEventListener('input', () => {
    const v = Number(scaleIn.value);
    const out = document.getElementById('pubScaleResult');
    out.textContent = Number.isFinite(v) && scaleIn.value !== '' ? String(Math.round(v / DIMINISHER_DIV[d().diminisher])) : '—';
  });
}

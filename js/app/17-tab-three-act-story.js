/* =========================================================================
   TAB: 3-ACT STORY  (Mythic Magazine Volume 42 — "3-Act Structure For
   Mythic Adventures")
   -------------------------------------------------------------------------
   Digitizes the "Mythic 3-Act Story Structure" worksheet: a screenwriting
   3-act overlay (Setup / Conflict / Resolution) on top of normal Mythic
   play. SHARES the campaign's Chaos Factor, scene number, Threads/Characters
   Lists and Random Event Focus Table with the Mythic GME tab (all on
   `campaign().gme`); this tab's own state is `campaign().gme.threeAct`.

   The worksheet has, per Act, two circle tracks:
     - OUTER track (4 circles, the last one red): mark one per distinct
       Story Beat achieved in a Scene (max one per category per Scene).
       Reaching the 4th (red) circle ends the Act.
     - INNER track (uncapped, cycles the last entry once exhausted): mark
       one whenever a Scene goes by with NO Story Beat. Most inner marks
       trigger a specific Act Event dictating what the next Scene must be.
   Circle counts/order below were read directly off the worksheet graphic
   (Mythic Magazine #42, p.16) since the OCR'd page text scrambles the
   spiral layout.
   ========================================================================= */

// Story Beat categories per Act (checkbox list for "record this Scene").
// `once:true` categories are removed from the list forever after they fire.
const THREE_ACT_BEATS = [
  [ { key: 'establish', label: 'Establish Story Thread', once: true },
    { key: 'npc',       label: 'Introduce Important NPC(s)' },
    { key: 'progress',  label: 'Story Thread Progress Or Regression' } ],
  [ { key: 'conflict',  label: 'Conflict' },
    { key: 'twist',     label: 'A Twist' },
    { key: 'progress',  label: 'Story Thread Progress Or Regression' } ],
  [ { key: 'progress',  label: 'Story Thread Progress Or Regression' },
    { key: 'tension',   label: 'Tension' } ]
];

// Inner-track Act Event sequence per Act, in worksheet order. Once a Scene
// count exceeds the list, the last entry repeats (the catch-all events —
// Story Thread Activity / Tension — are explicitly "can happen any time").
const THREE_ACT_INNER_EVENTS = [
  ['incident', 'introduceNpc', 'threadActivity', 'threadActivity'],
  ['conflict', 'conflict', 'conflict', 'progress', 'twist', 'newConflict', 'threadActivity'],
  ['threadActivity', 'threadActivity', 'threadActivity', 'tension', 'tension']
];

const THREE_ACT_EVENT_LABELS = {
  incident: 'Incident Scene', introduceNpc: 'Introduce NPC', threadActivity: 'Story Thread Activity',
  conflict: 'Conflict', progress: 'Progress', twist: 'Twist?', newConflict: 'New Conflict?', tension: 'Tension'
};

const THREE_ACT_NAMES = ['Setup', 'Conflict', 'Resolution'];

function threeActInnerEvent(actIdx, n){
  const seq = THREE_ACT_INNER_EVENTS[actIdx];
  return seq[Math.min(n, seq.length) - 1];
}

// Resolve one triggered inner-track Act Event: rolls dice where the rules
// call for it, rolls a Meaning word pair for flavor (every triggered event
// becomes an Interrupt Scene in play), and returns markdown-ish lines plus
// an optional suggested new-Thread text (the Conflict 8-10 / New Conflict
// branches, which call for Discovering Meaning to create a blocking Thread).
function fireThreeActEvent(type, ta){
  const lines = [];
  let addThreadSuggestion = null;
  const wordPair = () => {
    const w = randomEventWords();
    lines.push(`Meaning: **${w.a.word} / ${w.d.word}**`);
    return w;
  };

  if(type === 'incident'){
    if(ta.storyThread.trim()){
      lines.push('Story Thread already established — this Act Event is skipped. Generate the next Scene normally.');
    } else {
      lines.push('**Incident Scene** — the next Scene is an Interrupt. Interpret the Random Event as your Story Thread.');
      wordPair();
      lines.push('Write the Story Thread once you\'ve interpreted the Scene, then record it as an "Establish Story Thread" beat below.');
    }
  } else if(type === 'introduceNpc'){
    if(ta.npcIntroduced){
      lines.push('An NPC tied to the Story Thread already exists — this Act Event is skipped. Generate the next Scene normally.');
    } else {
      lines.push('**Introduce NPC** — the next Scene is an Interrupt, Event Focus: **New NPC**, related to the Story Thread.');
      wordPair();
    }
  } else if(type === 'threadActivity'){
    const r = rollDie(10);
    const away = r >= 6;
    lines.push(`**Story Thread Activity** — 1d10: **${r}** (1&ndash;5 Move Toward / 6&ndash;10 Move Away) → Interrupt, Event Focus: **${away ? 'Move Away From A Thread' : 'Move Toward A Thread'}** (the Story Thread).`);
    wordPair();
  } else if(type === 'progress'){
    lines.push('**Progress** — the next Scene is an Interrupt, Event Focus: **Move Toward A Thread** (the Story Thread). Your PC catches a break.');
    wordPair();
  } else if(type === 'conflict'){
    const r = rollDie(10);
    lines.push(`**Conflict** — 1d10: **${r}** (1&ndash;4 Move Away / 5&ndash;7 PC Negative / 8&ndash;10 New Thread) → Interrupt.`);
    if(r <= 4){
      lines.push('Event Focus: **Move Away From A Thread** (the Story Thread).');
    } else if(r <= 7){
      lines.push('Event Focus: **PC Negative**.');
    } else {
      lines.push('Discover Meaning to create a **new Thread** that must be resolved before the Story Thread can be resolved — a necessary side-quest.');
    }
    const w = wordPair();
    if(r >= 8) addThreadSuggestion = `${w.a.word} ${w.d.word}`;
  } else if(type === 'twist'){
    const r = rollDie(10);
    if(r <= 5){
      lines.push(`**Twist?** — 1d10: **${r}** (1&ndash;5 no Twist) → No Twist. Proceed normally.`);
    } else {
      lines.push(`**Twist?** — 1d10: **${r}** (6&ndash;10 Twist!) → Interrupt. Discover Meaning to change some aspect of the Story Thread.`);
      wordPair();
    }
  } else if(type === 'newConflict'){
    const r = rollDie(10);
    if(r <= 5){
      lines.push(`**New Conflict?** — 1d10: **${r}** (1&ndash;5 no new conflict) → No new conflict. Proceed normally.`);
    } else {
      lines.push(`**New Conflict?** — 1d10: **${r}** (6&ndash;10) → treat this as **Conflict**:`);
      const res = fireThreeActEvent('conflict', ta);
      lines.push(...res.lines);
      addThreadSuggestion = res.addThreadSuggestion;
    }
  } else if(type === 'tension'){
    lines.push('**Tension** — whatever the next Scene is, it includes an extra disadvantage for the PC. Early in the Scene, generate a Random Event with Focus: **PC Negative**.');
    wordPair();
  }
  return { lines, addThreadSuggestion };
}

// transient result HTML, cached against renderActive() (see AGENTS.md gotcha)
let threeActResultHtml = '';
let threeActThreadSuggestion = null;
let threeActFlowOpen = false;

const THREE_ACT_FLOW_HTML = `
<div class="pub-flow">
  <div class="flow-group">
    <h4>Each Act</h4>
    <div class="flow-step"><b>Story Beat happens in a Scene</b> → mark the next <b>outer</b> circle (one per distinct category, max once per Scene). The 4th, red circle ends the Act.</div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>No Story Beat happens</b> → mark the next <b>inner</b> circle. This usually triggers an Act Event that dictates the next Scene (skip it if its one-time condition already happened).</div>
  </div>
  <div class="flow-group">
    <h4>The three Acts</h4>
    <div class="flow-step"><b>Act 1 — Setup:</b> Establish Story Thread &middot; Introduce Important NPCs &middot; Progress/Regression.</div>
    <div class="flow-step"><b>Act 2 — Conflict:</b> Conflict &middot; A Twist? &middot; Progress/Regression.</div>
    <div class="flow-step"><b>Act 3 — Resolution:</b> Progress/Regression &middot; Tension.</div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step">Act 3's outer track ends → <b>Resolution</b> Scene (Expected — resolve the Story Thread) → <b>Closing</b> Scene (Expected — the epilogue).</div>
  </div>
  <div class="flow-group">
    <h4>Protected Story Thread</h4>
    <div class="flow-step">The Story Thread can't be resolved until the Resolution Scene. Anything that would end it early — your own actions, a Random Event — gets re-interpreted so it survives.</div>
  </div>
</div>`;

function renderThreeAct(){
  const g = campaign().gme;
  const ta = g.threeAct;
  const actIdx = ta.act - 1;
  const established = !!ta.storyThread.trim();

  const actCard = (idx) => {
    const n = idx + 1;
    const outerPips = Array.from({ length: 4 }, (_, i) => {
      const filled = i < ta.outer[idx];
      const final = i === 3;
      return `<span class="beat-pip${filled ? ' filled' : ''}${final ? ' final' : ''}"></span>`;
    }).join('');
    const beats = THREE_ACT_BEATS[idx].map(b => b.label).join(' &middot; ');
    const nextInner = THREE_ACT_EVENT_LABELS[threeActInnerEvent(idx, ta.inner[idx] + 1)];
    return `
    <div class="act-card${n === ta.act && ta.phase === 'acts' ? ' current' : ''}">
      <h4>Act ${n} &mdash; ${THREE_ACT_NAMES[idx]}</h4>
      <div class="small-note">${beats}</div>
      <div class="beat-track">${outerPips}</div>
      <div class="small-note">Outer (Story Beats): ${ta.outer[idx]} / 4 &nbsp;&middot;&nbsp; Inner (no-beat Scenes): ${ta.inner[idx]}</div>
      ${n === ta.act && ta.phase === 'acts' ? `<div class="small-note">If nothing happens next: <b>${nextInner}</b></div>` : ''}
    </div>`;
  };

  const overview = `<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px;">${[0,1,2].map(actCard).join('')}</div>`;

  const protectedBanner = ta.phase === 'acts'
    ? `<div class="banner-note">The Story Thread is <b>protected</b> — it cannot be resolved until the Resolution Scene. Re-interpret anything that would end it early.</div>`
    : '';

  let bodyHtml = '';
  if(ta.phase === 'acts'){
    const beats = THREE_ACT_BEATS[actIdx].filter(b => !(b.key === 'establish' && established));
    const needsThreadInput = actIdx === 0 && !established;
    const beatRows = beats.map(b => `<label><input type="checkbox" data-beat="${b.key}"> ${b.label}</label>`).join('');
    const canStartInMediaRes = ta.act === 1 && ta.outer[0] === 0 && ta.inner[0] === 0 && !established;

    bodyHtml = `
    <div class="card">
      <h3 class="block-title">The Story Thread</h3>
      <p class="small-note" style="margin-top:-4px;">A single, important Thread your adventure resolves. Pick any Thread from the shared Threads List, or let Act 1 generate one for you (mark a Scene with no Story Beat).</p>
      <div class="field">
        <label for="threeActThreadInput">Story Thread</label>
        <input type="text" id="threeActThreadInput" class="field-input" style="width:100%;" value="${escapeAttr(ta.storyThread)}" placeholder="e.g. Find the journal">
      </div>
      ${canStartInMediaRes ? `<div class="row" style="margin-top:10px;"><button class="btn" id="btn3aMediaRes">Start In Media Res</button></div>
      <div class="small-note">Fires Incident Scene, Introduce NPC and Story Thread Activity all at once, so the first Scene starts in the thick of it (Mythic Mag #42, "In Media Res").</div>` : ''}
      <div class="row" style="margin-top:10px;">
        <label style="display:flex; align-items:center; gap:8px; font-size:13px;"><input type="checkbox" id="threeActPcProtected" ${ta.pcProtected ? 'checked' : ''}> Protect the PC (Tension can't remove them from play — house rule, p.24)</label>
      </div>
    </div>

    <div class="card">
      <h3 class="block-title">Bookkeeping &mdash; Record This Scene</h3>
      <p class="small-note" style="margin-top:-4px;">Check every Story Beat that happened in the Scene you just played (each only counts once per Scene, even if it happened more than once). Leave everything unchecked if no Story Beat happened.</p>
      ${needsThreadInput ? `<div class="small-note" style="margin-bottom:6px;">Checking "Establish Story Thread" saves whatever you've typed above as the Story Thread.</div>` : ''}
      <div class="beat-checks">${beatRows}</div>
      <button class="btn primary" id="btn3aRecordScene">Record Scene</button>
    </div>

    <div id="threeActResult">${threeActResultHtml}</div>
    ${threeActThreadSuggestion ? `
    <div class="card">
      <div class="small-note">Suggested new (blocking) Thread: <b>${escapeAttr(threeActThreadSuggestion)}</b></div>
      <button type="button" class="btn small" id="btn3aAddSuggestedThread" style="margin-top:6px;">Add to Threads List</button>
    </div>` : ''}
    `;
  } else if(ta.phase === 'resolution'){
    bodyHtml = `
    <div class="card">
      <h3 class="block-title">Resolution</h3>
      <p>Act 3 is complete. The next Scene is <b>Expected</b>, where the Context is everything needed to resolve the Story Thread. Discover Meaning or ask Fate Questions to build the Scene if you need more to work with.</p>
      <p class="small-note">The Story Thread is no longer protected &mdash; it can finally be resolved. If this Scene ends without resolving it, keep playing Expected Scenes until it does; no more Act Events trigger.</p>
      <div class="row"><button class="btn" id="btn3aRollResolutionWords">Roll inspiration words</button></div>
      <div id="threeActResult" style="margin-top:10px;">${threeActResultHtml}</div>
      <div class="divider"></div>
      <button class="btn primary" id="btn3aMarkResolved">Story Thread Resolved &rarr; Move To Closing</button>
    </div>`;
  } else if(ta.phase === 'closing'){
    bodyHtml = `
    <div class="card">
      <h3 class="block-title">Closing</h3>
      <p>One more Scene: the <b>Closing Scene</b> (Expected). Context: any important open questions get resolved now &mdash; this is the epilogue. Cover what the PC and NPCs do next, lingering enemies, rest &amp; reflection, and maybe the seeds of a follow-on adventure.</p>
      <div class="row"><button class="btn" id="btn3aRollClosingWords">Roll inspiration words</button></div>
      <div id="threeActResult" style="margin-top:10px;">${threeActResultHtml}</div>
      <div class="divider"></div>
      <button class="btn primary" id="btn3aComplete">Complete The Adventure</button>
    </div>`;
  } else { // done
    bodyHtml = `
    <div class="card">
      <h3 class="block-title">Adventure Complete</h3>
      <p>Story Thread resolved: <b>${escapeAttr(ta.storyThread) || '(unnamed)'}</b></p>
      <p class="small-note">Start a new 3-Act Story whenever you're ready to run another adventure. Threads, Characters and Chaos Factor stay as they are (shared with the Mythic GME tab).</p>
      <button class="btn primary" id="btn3aReset">Start A New 3-Act Story</button>
    </div>`;
  }

  return `
  <h2 class="tool-title">3-Act Story Structure</h2>
  <p class="tool-desc">A classic screenwriting Setup / Conflict / Resolution overlay on top of Mythic play (Mythic Magazine #42). Chaos Factor, Scenes, Lists and the Event Focus Table are shared with the <b>Mythic GME</b> tab.</p>

  <div class="card">
    <div class="row" style="justify-content:space-between; align-items:center;">
      <h3 class="block-title" style="margin:0; padding:0; border:0;">How it works</h3>
      <button class="btn small" id="btn3aFlowToggle">${threeActFlowOpen ? 'Hide' : 'Show'}</button>
    </div>
    ${threeActFlowOpen ? THREE_ACT_FLOW_HTML : '<div class="small-note" style="margin-top:6px;">A quick flowchart of the outer/inner circle tracks and the three Acts.</div>'}
  </div>

  ${protectedBanner}
  <div class="card">
    <h3 class="block-title">Progress</h3>
    ${overview}
  </div>

  ${bodyHtml}
  `;
}

function wireThreeAct(){
  const g = () => campaign().gme;
  const ta = () => campaign().gme.threeAct;

  const applyMd = lines => `<div class="result-box event">${
    lines.map(l => l.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>')).join('<br>')
  }</div>`;

  document.getElementById('btn3aFlowToggle').addEventListener('click', () => {
    threeActFlowOpen = !threeActFlowOpen;
    renderActive();
  });

  if(ta().phase === 'acts'){
    const threadInput = document.getElementById('threeActThreadInput');
    threadInput.addEventListener('input', () => { ta().storyThread = threadInput.value; persist(); });

    document.getElementById('threeActPcProtected').addEventListener('change', e => {
      ta().pcProtected = e.target.checked; persist();
    });

    const mediaResBtn = document.getElementById('btn3aMediaRes');
    if(mediaResBtn){
      mediaResBtn.addEventListener('click', () => {
        const t = ta();
        const lines = ['**In Media Res** — starting Act 1 in the thick of it. Fires all three opening Act Events at once:'];
        t.inner[0] = 3;
        t.outer[0] = Math.min(4, t.outer[0] + 3);
        t.npcIntroduced = true;
        ['incident', 'introduceNpc', 'threadActivity'].forEach(type => {
          const w = randomEventWords();
          lines.push(`- **${THREE_ACT_EVENT_LABELS[type]}** — Meaning: **${w.a.word} / ${w.d.word}**`);
        });
        lines.push('Interpret the first Scene using these three prompts, then write the Story Thread above once you land on it.');
        threeActResultHtml = applyMd(lines);
        persist();
        addLog('3-Act Story', `**In Media Res** —\n  - ` + lines.slice(1).join('\n  - '));
        renderActive();
      });
    }

    document.getElementById('btn3aRecordScene').addEventListener('click', () => {
      const t = ta();
      const actIdx = t.act - 1;
      const checked = Array.from(document.querySelectorAll('.beat-checks input[type=checkbox]:checked')).map(el => el.dataset.beat);
      const lines = [];

      if(checked.length === 0){
        t.inner[actIdx] += 1;
        const type = threeActInnerEvent(actIdx, t.inner[actIdx]);
        const res = fireThreeActEvent(type, t);
        lines.push(`No Story Beat this Scene — inner mark ${t.inner[actIdx]} → **${THREE_ACT_EVENT_LABELS[type]}**`, ...res.lines);
        threeActThreadSuggestion = res.addThreadSuggestion;
      } else {
        threeActThreadSuggestion = null;
        const beatDefs = THREE_ACT_BEATS[actIdx];
        checked.forEach(key => {
          if(t.outer[actIdx] >= 4) return;
          t.outer[actIdx] += 1;
          const def = beatDefs.find(b => b.key === key);
          lines.push(`Story Beat achieved: **${def ? def.label : key}** — outer mark ${t.outer[actIdx]} / 4`);
          if(key === 'establish'){
            const txt = (document.getElementById('threeActThreadInput') || {}).value || '';
            t.storyThread = txt.trim();
          }
          if(key === 'npc') t.npcIntroduced = true;
        });
        if(t.outer[actIdx] >= 4){
          if(t.act < 3){
            t.act += 1;
            lines.push(`**Act ${actIdx + 1} complete** → moving to Act ${t.act}.`);
          } else {
            t.phase = 'resolution';
            lines.push('**Act 3 complete** → moving to Resolution.');
          }
        }
      }

      threeActResultHtml = applyMd(lines);
      persist();
      addLog('3-Act Story', `**Act ${actIdx + 1} Bookkeeping** —\n  - ` + lines.join('\n  - '));
      renderActive();
    });
  } else if(ta().phase === 'resolution'){
    document.getElementById('btn3aRollResolutionWords').addEventListener('click', () => {
      const w = randomEventWords();
      const lines = [`Meaning: **${w.a.word} / ${w.d.word}**`];
      threeActResultHtml = applyMd(lines);
      addLog('3-Act Story', `**Resolution inspiration** — Meaning: **${w.a.word} / ${w.d.word}**`);
      renderActive();
    });
    document.getElementById('btn3aMarkResolved').addEventListener('click', () => {
      const t = ta();
      t.phase = 'closing';
      threeActResultHtml = '';
      persist();
      addLog('3-Act Story', `**Story Thread resolved**: "${escapeMd(t.storyThread)}" → moving to Closing.`);
      renderActive();
    });
  } else if(ta().phase === 'closing'){
    document.getElementById('btn3aRollClosingWords').addEventListener('click', () => {
      const w = randomEventWords();
      const lines = [`Meaning: **${w.a.word} / ${w.d.word}**`];
      threeActResultHtml = applyMd(lines);
      addLog('3-Act Story', `**Closing inspiration** — Meaning: **${w.a.word} / ${w.d.word}**`);
      renderActive();
    });
    document.getElementById('btn3aComplete').addEventListener('click', () => {
      const t = ta();
      t.phase = 'done';
      threeActResultHtml = '';
      persist();
      addLog('3-Act Story', `**Adventure complete** — Story Thread: "${escapeMd(t.storyThread)}".`);
      renderActive();
    });
  } else { // done
    document.getElementById('btn3aReset').addEventListener('click', () => {
      if(!confirm('Start a new 3-Act Story? This resets the Story Thread and both circle tracks (Threads/Characters/Chaos Factor are unaffected).')) return;
      campaign().gme.threeAct = freshThreeAct();
      threeActResultHtml = '';
      threeActThreadSuggestion = null;
      persist();
      addLog('3-Act Story', '**Started a new 3-Act Story.**');
      renderActive();
    });
  }

  const addSuggestedBtn = document.getElementById('btn3aAddSuggestedThread');
  if(addSuggestedBtn){
    addSuggestedBtn.addEventListener('click', () => {
      if(!threeActThreadSuggestion) return;
      g().threads.push(threeActThreadSuggestion);
      addLog('3-Act Story', `**Threads List** — added "${escapeMd(threeActThreadSuggestion)}" (blocking Thread).`);
      threeActThreadSuggestion = null;
      persist();
      renderActive();
    });
  }
}

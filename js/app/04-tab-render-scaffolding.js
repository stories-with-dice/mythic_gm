/* =========================================================================
   TAB / RENDER SCAFFOLDING
   -------------------------------------------------------------------------
   Split view: right-clicking a tab pins it to a second pane on the right
   (`rightTab`), instead of switching the main pane's `currentTab`. The two
   are kept mutually exclusive (a tab can't be both at once) so every tab's
   DOM ids stay unique on the page — see the invariant enforced in
   renderTabNav()'s contextmenu handler below.

   View state: `currentTab`, `rightTab` and the open "?" intros are saved in
   the current campaign (`campaign().ui`, see freshUi() in 03), so they are
   exported and synced with the campaign. applyCampaignView() loads them at
   boot and on a campaign switch; saveView() writes them back after every
   change. Only the window scroll position stays in sessionStorage
   (VIEW_KEY): it is per browser tab, not per campaign.
   ========================================================================= */
// `group` puts the tab under a label in the tab bar (TAB_GROUPS).
const TABS = [
  {id:'gme', label:'Mythic GME', group:'mythic'},
  {id:'pub', label:'Published Adventures', group:'mythic'},
  {id:'threeAct', label:'3-Act Story', group:'mythic'},
  {id:'nodes', label:'Node Narratives', group:'mythic'},
  {id:'gm', label:'Game Master', group:'onePage'},
  {id:'adventure', label:'Adventure Crafter', group:'onePage'},
  {id:'location', label:'Location Crafter', group:'onePage'},
  {id:'creature', label:'Creature Crafter', group:'onePage'},
  {id:'character', label:'Character Crafter', group:'onePage'},
  {id:'mystery', label:'Mystery Matrix', group:'onePage'},
  {id:'playerEmu', label:'Player Emulator', group:'players'},
  {id:'tripleO', label:'Triple-O', group:'players'}
];
const TAB_GROUPS = [
  {id:'mythic', label:'Mythic 2e'},
  {id:'onePage', label:'One-Page'},
  {id:'players', label:'Players'}
];
// The tabs that share the Chaos Factor and the Scene number (gme.*). While
// one of them is on screen, the Scene strip (#sceneStrip) shows under the
// tab bar: one set of Chaos Factor and End Scene controls for all of them.
const SCENE_TABS = ['gme', 'pub', 'threeAct', 'nodes'];
let currentTab = 'gme';
let rightTab = null;   // tab id pinned to the split-right pane, or null when unsplit

const VIEW_KEY = 'mythicToolkit_view';

// Tab intros: the `tool-desc` paragraph under each tab's title. A "?"
// toggle beside every tab's title (tabHeader()). Each tab has its own
// open state, collapsed by default and saved with the campaign's UI state,
// so a "?" in one pane does not open the other pane's intro. A tab can pass
// `moreHtml` (the Published Adventures and 3-Act Story "How it works"
// flowcharts) to show below the intro.
let introOpen = new Set();   // tab ids whose intro is open
let introTab = null;         // the tab renderActive() is rendering, for tabHeader()

function knownTab(id){ return TABS.some(t => t.id === id); }

// Puts the current campaign's saved UI state in the live view. Unknown tab
// ids are dropped, and the currentTab/rightTab invariant is enforced again.
// A campaign from before `ui` existed gets a fresh one.
function applyCampaignView(){
  const c = campaign();
  const ui = c.ui = sanitizeUi(c.ui);
  currentTab = knownTab(ui.currentTab) ? ui.currentTab : 'gme';
  rightTab = knownTab(ui.rightTab) && ui.rightTab !== currentTab ? ui.rightTab : null;
  introOpen = new Set(ui.intros.filter(knownTab));
}
// The live view as a `ui` object (without `at`).
function liveView(){ return { currentTab, rightTab, intros: TABS.map(t => t.id).filter(id => introOpen.has(id)) }; }
// Called after every tab or intro change, and on pagehide (which also fires
// on reload) for the scroll position. Writes the campaign (and so queues a
// Dropbox upload) only when the UI state really changed.
function saveView(){
  const c = campaign();
  const live = liveView();
  const old = c.ui || {};
  if(old.currentTab !== live.currentTab || old.rightTab !== live.rightTab || JSON.stringify(old.intros) !== JSON.stringify(live.intros)){
    c.ui = Object.assign(live, { at: Date.now() });
    persist();
  }
  try{ sessionStorage.setItem(VIEW_KEY, JSON.stringify({ scrollY: Math.round(window.scrollY) })); }catch(_){}
}
// The scroll position saved before a reload, or 0.
function loadScroll(){
  try{
    const v = JSON.parse(sessionStorage.getItem(VIEW_KEY));
    return v && Number.isFinite(v.scrollY) && v.scrollY > 0 ? v.scrollY : 0;
  }catch(_){ return 0; }
}
// Called first in the DOMContentLoaded handler (22-init.js), before the
// first render. Returns the scroll position to restore.
function restoreViewTabs(){
  applyCampaignView();
  return { scrollY: loadScroll() };
}
// A campaign switch (campaign bar, Dropbox pull): show that campaign's UI state.
function switchCampaignView(){
  applyCampaignView();
  renderTabNav();
}

function isIntroOpen(tab){ return introOpen.has(tab); }
function setIntroOpen(tab, open){
  if(open) introOpen.add(tab); else introOpen.delete(tab);
  saveView();
}
// Inline Edit for one `.gme-list` row (Threads / Characters Lists, Adventure
// Meaning List, NPCs). `btn` is the row's Edit button. It swaps the row's
// `.txt` for an <input> holding `value`. Enter or leaving the field calls
// `save(newValue)` when the trimmed text is not empty and changed, then
// renderActive(); Escape cancels. The row's buttons hide while it edits.
function editListEntry(btn, value, save){
  const li = btn.closest('li');
  const txt = li && li.querySelector('.txt');
  if(!txt || li.classList.contains('editing')) return;
  li.classList.add('editing');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'field-input list-edit';
  input.value = value;
  input.setAttribute('aria-label', 'Edit entry');
  txt.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = keep => {
    if(done) return;
    done = true;
    const v = input.value.trim();
    if(keep && v && v !== value) save(v);
    renderActive();
  };
  input.addEventListener('keydown', e => {
    if(e.key === 'Enter' && !isComposing(e)){ e.preventDefault(); finish(true); }
    else if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

function tabHeader(title, descHtml, moreHtml){
  const tab = introTab;
  const open = isIntroOpen(tab);
  return `<div class="tool-head">
    <h2 class="tool-title">${title}</h2>
    <button type="button" class="btn small intro-toggle${open ? ' open' : ''}" data-intro-toggle="${tab}" aria-expanded="${open}" title="${open ? 'Hide' : 'Show'} what this tab does" aria-label="${open ? 'Hide' : 'Show'} the tab intro">?</button>
  </div>
  ${open ? `<p class="tool-desc">${descHtml}</p>${moreHtml ? `<div class="tool-intro-more">${moreHtml}</div>` : ''}` : ''}`;
}
function renderTab(id){
  introTab = id;
  try{ return tabRenderers()[id](); } finally { introTab = null; }
}

// Lazy lookups (not top-level object literals) because these name functions
// defined in files that load *after* this one; only safe to call once
// everything has loaded, i.e. from inside renderActive()/wireActive().
function tabRenderers(){
  return { gm:renderGM, adventure:renderAdventure, location:renderLocation, creature:renderCreature, character:renderCharacter, mystery:renderMystery, gme:renderMythicGME, pub:renderPublished, playerEmu:renderPlayerEmu, threeAct:renderThreeAct, nodes:renderNodeNarratives, tripleO:renderTripleO };
}
function tabWirers(){
  return { gm:wireGM, adventure:wireAdventure, location:wireLocation, creature:wireCreature, character:wireCharacter, mystery:wireMystery, gme:wireMythicGME, pub:wirePublished, playerEmu:wirePlayerEmu, threeAct:wireThreeAct, nodes:wireNodeNarratives, tripleO:wireTripleO };
}

function setSplit(id){
  rightTab = id && id !== currentTab ? id : null;
  renderTabNav();
  renderActive();
  saveView();
}

function renderTabNav(){
  const nav = document.getElementById('tabNav');
  // stack multi-word labels (one word per line) so tabs stay narrow
  const btn = t => {
    const cls = [t.id===currentTab?'active':'', t.id===rightTab?'split-right':''].filter(Boolean).join(' ');
    const sel = t.id === currentTab;
    return `<button data-tab="${t.id}" class="${cls}" role="tab" id="tab-${t.id}" aria-selected="${sel}" aria-controls="panelHost" tabindex="${sel ? 0 : -1}" title="Right-click to open beside the current tab">${t.label.split(' ').join('<br>')}</button>`;
  };
  nav.innerHTML = TAB_GROUPS.map(g => `<div class="tab-group" role="presentation">
      <span class="tab-group-label" aria-hidden="true">${g.label}</span>
      <div class="tab-group-tabs" role="presentation">${TABS.filter(t => t.group === g.id).map(btn).join('')}</div>
    </div>`).join('');
  const buttons = Array.from(nav.querySelectorAll('button[data-tab]'));
  buttons.forEach((b, i)=>{
    b.addEventListener('click', ()=>{
      const id = b.dataset.tab;
      if(id === rightTab) rightTab = null;   // reclaim a split-out tab into the main pane
      currentTab = id;
      renderTabNav();
      renderActive();
      saveView();
      const again = document.getElementById('tab-' + id);
      if(again && document.activeElement === document.body) again.focus({ preventScroll:true });
    });
    b.addEventListener('contextmenu', (e)=>{
      e.preventDefault();
      const id = b.dataset.tab;
      if(id === rightTab){ rightTab = null; renderTabNav(); renderActive(); saveView(); return; }   // right-click again = close split
      if(id === currentTab) currentTab = (TABS.find(t=>t.id!==id) || {id:currentTab}).id;  // don't collide with the new rightTab
      rightTab = id;
      renderTabNav();
      renderActive();
      saveView();
    });
    // Tablist keys: Left / Right / Home / End move to a tab and open it.
    b.addEventListener('keydown', e => {
      const n = buttons.length;
      const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n
        : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
      if(to < 0) return;
      e.preventDefault();
      buttons[to].click();
      const next = document.getElementById('tab-' + buttons[to].dataset.tab);
      if(next) next.focus();
    });
  });
  document.getElementById('panelHost').setAttribute('aria-labelledby', 'tab-' + currentTab);
  // Keep the active tab visible when the bar scrolls sideways (phone width).
  const active = nav.querySelector('button.active');
  if(active && nav.scrollWidth > nav.clientWidth){
    const l = active.offsetLeft - nav.offsetLeft, r = l + active.offsetWidth;
    if(l < nav.scrollLeft || r > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = Math.max(0, l - 24);
  }
  updateNavFade();
  if(!nav.dataset.fadeWired){
    nav.dataset.fadeWired = '1';
    nav.addEventListener('scroll', updateNavFade, { passive:true });
    window.addEventListener('resize', updateNavFade);
  }
}
// A fade at the edge of the tab bar shows that more tabs are off-screen.
function updateNavFade(){
  const nav = document.getElementById('tabNav');
  if(!nav) return;
  nav.classList.toggle('more-right', nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2);
  nav.classList.toggle('more-left', nav.scrollLeft > 2);
}

/* ----- Scene strip: shared Chaos Factor + End Scene ----- */
// One strip under the tab bar while any SCENE_TABS tab is on screen (either
// pane). It reads and writes campaign().gme.chaosFactor / sceneNumber. The
// tabs keep their own Expected Scene test. End Scene clears every tab's last
// Scene test result (gmeSceneTestHtml, pubSceneTestHtml, nodeSceneTestHtml).
function sceneStripTab(){
  return SCENE_TABS.includes(currentTab) ? currentTab : SCENE_TABS.includes(rightTab) ? rightTab : null;
}
// End Scene is one button. A click shows the "PC in control?" select (and a
// Cancel); picking an answer ends the Scene at once. Not saved.
let sceneEndOpen = false;
function renderSceneStrip(){
  const host = document.getElementById('sceneStrip');
  if(!host) return;
  const tab = sceneStripTab();
  host.hidden = !tab;
  if(!tab){ host.innerHTML = ''; return; }
  const g = campaign().gme;
  host.innerHTML = `
    <div class="scene-strip-group" role="group" aria-label="Chaos Factor">
      <span class="scene-strip-lbl">Chaos Factor</span>
      <button class="btn small" id="btnSceneCfMinus" aria-label="Lower the Chaos Factor" ${g.chaosFactor <= 1 ? 'disabled' : ''}>&minus;</button>
      <span class="scene-strip-num" id="sceneCf">${g.chaosFactor}</span>
      <button class="btn small" id="btnSceneCfPlus" aria-label="Raise the Chaos Factor" ${g.chaosFactor >= 9 ? 'disabled' : ''}>+</button>
    </div>
    <div class="scene-strip-group">
      <span class="scene-strip-lbl">Scene</span>
      <span class="scene-strip-num" id="sceneNum">${g.sceneNumber}</span>
    </div>
    <span class="scene-strip-divider" aria-hidden="true"></span>
    <div class="scene-strip-group scene-strip-end">
      ${sceneEndOpen ? `
      <label class="scene-strip-lbl" for="sceneControl">Scene ${g.sceneNumber}: PC in control?</label>
      <select id="sceneControl" class="field-input">
        <option value="" selected disabled>Choose…</option>
        <option value="in">Yes (CF &minus;1)</option>
        <option value="out">No (CF +1)</option>
      </select>
      <button class="btn small" id="btnSceneEndCancel" aria-label="Cancel End Scene" title="Cancel">&times;</button>` : `
      <button class="btn small" id="btnSceneEnd" title="Ends Scene ${g.sceneNumber}: you say if the PCs were in control, then the Chaos Factor changes and Scene ${g.sceneNumber + 1} starts">End Scene ${g.sceneNumber}</button>`}
    </div>`;
  const label = TABS.find(t => t.id === tab).label;
  const gme = () => campaign().gme;
  document.getElementById('btnSceneCfMinus').addEventListener('click', ()=>{
    gme().chaosFactor = Math.max(1, gme().chaosFactor - 1);
    persist(); addLog(label, `**Chaos Factor** lowered to ${gme().chaosFactor}.`); renderActive();
  });
  document.getElementById('btnSceneCfPlus').addEventListener('click', ()=>{
    gme().chaosFactor = Math.min(9, gme().chaosFactor + 1);
    persist(); addLog(label, `**Chaos Factor** raised to ${gme().chaosFactor}.`); renderActive();
  });
  const endBtn = document.getElementById('btnSceneEnd');
  if(endBtn) endBtn.addEventListener('click', ()=>{
    sceneEndOpen = true;
    renderSceneStrip();
    const sel = document.getElementById('sceneControl');
    if(sel) sel.focus();
  });
  const cancel = () => {
    sceneEndOpen = false;
    renderSceneStrip();
    const b = document.getElementById('btnSceneEnd');
    if(b) b.focus();
  };
  const cancelBtn = document.getElementById('btnSceneEndCancel');
  if(cancelBtn) cancelBtn.addEventListener('click', cancel);
  const control = document.getElementById('sceneControl');
  if(control) control.addEventListener('keydown', e => { if(e.key === 'Escape'){ e.stopPropagation(); cancel(); } });
  if(control) control.addEventListener('change', ()=>{
    if(control.value !== 'in' && control.value !== 'out') return;
    const inControl = control.value === 'in';
    sceneEndOpen = false;
    const g2 = gme();
    const ended = g2.sceneNumber;
    g2.chaosFactor = inControl ? Math.max(1, g2.chaosFactor - 1) : Math.min(9, g2.chaosFactor + 1);
    g2.sceneNumber += 1;
    g2.expectedScene = '';
    gmeSceneTestHtml = ''; pubSceneTestHtml = ''; nodeSceneTestHtml = '';
    persist();
    addLog(label, `**Scene ${ended} ended** — PC ${inControl ? 'in control → Chaos Factor −1' : 'not in control → Chaos Factor +1'} (now ${g2.chaosFactor}). Beginning Scene ${g2.sceneNumber}.`);
    renderActive();
  });
}

/* ----- Undo toast ----- */
// showUndoToast('Deleted "X".', undoFn): a toast with an Undo button for
// UNDO_MS. A new toast replaces the old one (its undo is no longer offered).
const UNDO_MS = 10000;
let toastTimer = null;
function hideToast(){
  clearTimeout(toastTimer); toastTimer = null;
  const t = document.getElementById('toast');
  if(t){ t.hidden = true; t.innerHTML = ''; }
}
function showUndoToast(msg, undo){
  const t = document.getElementById('toast');
  if(!t) return;
  clearTimeout(toastTimer);
  t.innerHTML = `<span class="toast-msg"></span><button type="button" class="btn small" id="btnToastUndo">Undo</button><button type="button" class="toast-x" id="btnToastClose" aria-label="Close">&times;</button>`;
  t.querySelector('.toast-msg').textContent = msg;
  t.hidden = false;
  document.getElementById('btnToastUndo').addEventListener('click', ()=>{ hideToast(); undo(); });
  document.getElementById('btnToastClose').addEventListener('click', hideToast);
  toastTimer = setTimeout(hideToast, UNDO_MS);
}

/* ----- New results: highlight + announce ----- */
// renderActive() rebuilds every result box, so a box is "new" only when its
// text was not on screen before. New boxes get a short highlight
// (.result-new). Result containers get aria-live so a screen reader reads a
// result that a handler writes with innerHTML.
let shownResults = new Set();
let resultsPrimed = false;   // false until the first render, so the boot render flashes nothing
function markNewResults(){
  const boxes = Array.from(document.querySelectorAll('#panelSplit .result-box'));
  const now = new Set();
  boxes.forEach(b => {
    const key = b.textContent.replace(/\s+/g, ' ').trim();
    now.add(key);
    if(resultsPrimed && !shownResults.has(key)){
      b.classList.remove('result-new'); void b.offsetWidth; b.classList.add('result-new');
    }
  });
  shownResults = now;
  resultsPrimed = true;
}
function watchResults(){
  const host = document.getElementById('panelSplit');
  if(!host || host.dataset.watched) return;
  host.dataset.watched = '1';
  new MutationObserver(markNewResults).observe(host, { childList:true, subtree:true });
}
function liveResultRegions(){
  document.querySelectorAll('#panelSplit [id$="Result"], #panelSplit [id$="ResultBox"], #discoverWords').forEach(el => {
    if(!el.hasAttribute('aria-live')) el.setAttribute('aria-live', 'polite');
  });
}

/* ----- Auto-growing text areas ----- */
// A textarea with data-autogrow starts at its `rows` and grows with its text. CSS does it
// (`field-sizing: content` in app.css); this JS fallback runs only where that is not supported.
function autogrow(el){ el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; }
function wireAutogrow(){
  if(window.CSS && CSS.supports('field-sizing', 'content')) return;
  document.querySelectorAll('textarea[data-autogrow]').forEach(el => {
    if(el.value) autogrow(el);
    el.addEventListener('input', () => autogrow(el));
  });
}

function renderActive(){
  document.getElementById('panelHost').innerHTML = renderTab(currentTab);

  const splitWrap = document.getElementById('panelSplit');
  const rightHost = document.getElementById('panelHostRight');
  document.body.classList.toggle('split-view', !!rightTab);   // css: a wider .wrap while split
  if(rightTab){
    splitWrap.classList.add('split');
    rightHost.innerHTML = `
      <div class="split-right-head">
        <span class="split-right-title">${TABS.find(t=>t.id===rightTab).label}</span>
        <button type="button" class="btn small split-close" id="btnCloseSplit" title="Close split view" aria-label="Close split view">&times;</button>
      </div>
      <div class="split-right-body">${renderTab(rightTab)}</div>`;
  } else {
    splitWrap.classList.remove('split');
    rightHost.innerHTML = '';
  }

  renderSceneStrip();
  wireActive();
  if(settingsOpen) renderSettingsTables();   // 21-settings.js: keep the table editors in step
}
function wireActive(){
  // The intro toggle is the same in every tab (and in both panes); it flips only its own tab.
  document.querySelectorAll('[data-intro-toggle]').forEach(b => b.addEventListener('click', ()=>{
    const tab = b.dataset.introToggle;
    setIntroOpen(tab, !isIntroOpen(tab));
    renderActive();
  }));
  tabWirers()[currentTab]();
  if(rightTab){
    tabWirers()[rightTab]();
    document.getElementById('btnCloseSplit').addEventListener('click', ()=> setSplit(null));
  }
  wireAutogrow();
  liveResultRegions();
  watchResults();
}

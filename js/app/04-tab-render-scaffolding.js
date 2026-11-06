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
const TABS = [
  {id:'gme', label:'Mythic GME'},
  {id:'pub', label:'Published Adventures'},
  {id:'threeAct', label:'3-Act Story'},
  {id:'nodes', label:'Node Narratives'},
  {id:'gm', label:'Game Master'},
  {id:'adventure', label:'Adventure Crafter'},
  {id:'location', label:'Location Crafter'},
  {id:'creature', label:'Creature Crafter'},
  {id:'character', label:'Character Crafter'},
  {id:'mystery', label:'Mystery Matrix'},
  {id:'playerEmu', label:'Player Emulator'}
];
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
    if(e.key === 'Enter'){ e.preventDefault(); finish(true); }
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
  return { gm:renderGM, adventure:renderAdventure, location:renderLocation, creature:renderCreature, character:renderCharacter, mystery:renderMystery, gme:renderMythicGME, pub:renderPublished, playerEmu:renderPlayerEmu, threeAct:renderThreeAct, nodes:renderNodeNarratives };
}
function tabWirers(){
  return { gm:wireGM, adventure:wireAdventure, location:wireLocation, creature:wireCreature, character:wireCharacter, mystery:wireMystery, gme:wireMythicGME, pub:wirePublished, playerEmu:wirePlayerEmu, threeAct:wireThreeAct, nodes:wireNodeNarratives };
}

function renderTabNav(){
  const nav = document.getElementById('tabNav');
  // stack multi-word labels (one word per line) so tabs stay narrow
  nav.innerHTML = TABS.map(t=>{
    const cls = [t.id===currentTab?'active':'', t.id===rightTab?'split-right':''].filter(Boolean).join(' ');
    return `<button data-tab="${t.id}" class="${cls}" title="Right-click to open in a split view">${t.label.split(' ').join('<br>')}</button>`;
  }).join('');
  nav.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id = b.dataset.tab;
      if(id === rightTab) rightTab = null;   // reclaim a split-out tab into the main pane
      currentTab = id;
      renderTabNav();
      renderActive();
      saveView();
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
  });
}

function renderActive(){
  document.getElementById('panelHost').innerHTML = renderTab(currentTab);

  const splitWrap = document.getElementById('panelSplit');
  const rightHost = document.getElementById('panelHostRight');
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
    document.getElementById('btnCloseSplit').addEventListener('click', ()=>{
      rightTab = null;
      renderTabNav();
      renderActive();
      saveView();
    });
  }
}

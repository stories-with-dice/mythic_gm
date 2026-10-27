/* =========================================================================
   TAB / RENDER SCAFFOLDING
   -------------------------------------------------------------------------
   Split view: right-clicking a tab pins it to a second pane on the right
   (`rightTab`), instead of switching the main pane's `currentTab`. The two
   are kept mutually exclusive (a tab can't be both at once) so every tab's
   DOM ids stay unique on the page — see the invariant enforced in
   renderTabNav()'s contextmenu handler below.

   View state: `currentTab`, `rightTab` and the window scroll position are
   kept in sessionStorage (VIEW_KEY) by saveView(), so a reload of this
   browser tab comes back to the same tabs at the same place. Like STORE,
   it clears when the browser tab closes, and it is not exported or synced.
   ========================================================================= */
const TABS = [
  {id:'gme', label:'Mythic GME'},
  {id:'pub', label:'Published Adventures'},
  {id:'threeAct', label:'3-Act Story'},
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

// Called after every tab change, and on pagehide (which also fires on reload)
// for the scroll position.
function saveView(){
  try{
    sessionStorage.setItem(VIEW_KEY, JSON.stringify({ currentTab, rightTab, scrollY: Math.round(window.scrollY) }));
  }catch(_){}
}
// Reads the saved view, or null. Unknown tab ids are dropped, and the
// currentTab/rightTab invariant is enforced again.
function loadView(){
  try{
    const v = JSON.parse(sessionStorage.getItem(VIEW_KEY));
    if(!v || typeof v !== 'object') return null;
    const known = id => TABS.some(t => t.id === id);
    const main = known(v.currentTab) ? v.currentTab : 'gme';
    const right = known(v.rightTab) && v.rightTab !== main ? v.rightTab : null;
    const scrollY = Number.isFinite(v.scrollY) && v.scrollY > 0 ? v.scrollY : 0;
    return { currentTab: main, rightTab: right, scrollY };
  }catch(_){ return null; }
}
// Called first in the DOMContentLoaded handler (22-init.js), before the first render.
function restoreViewTabs(){
  const v = loadView();
  if(!v) return null;
  currentTab = v.currentTab;
  rightTab = v.rightTab;
  return v;
}

// Tab intros: the `tool-desc` paragraph under each tab's title. A "?"
// toggle beside every tab's title (tabHeader()). Each tab has its own
// open state, collapsed by default and remembered in this browser
// (localStorage, like the theme), so a "?" in one pane does not open the
// other pane's intro. A tab can pass `moreHtml` (the Published Adventures
// and 3-Act Story "How it works" flowcharts) to show below the intro.
let introOpen = null;   // Set of tab ids; read lazily: the key prefix is set in 19-dropbox-sync.js
let introTab = null;    // the tab renderActive() is rendering, for tabHeader()
function introKey(){ return DBX_KEY_PREFIX + 'mythicToolkit_intro'; }
function introOpenTabs(){
  if(introOpen === null){
    let ids = [];
    try{ ids = JSON.parse(localStorage.getItem(introKey()) || '[]'); }catch(_){}
    introOpen = new Set(Array.isArray(ids) ? ids.filter(id => TABS.some(t => t.id === id)) : []);
  }
  return introOpen;
}
function isIntroOpen(tab){ return introOpenTabs().has(tab); }
function setIntroOpen(tab, open){
  const ids = introOpenTabs();
  if(open) ids.add(tab); else ids.delete(tab);
  try{ localStorage.setItem(introKey(), JSON.stringify([...ids])); }catch(_){}
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
  return { gm:renderGM, adventure:renderAdventure, location:renderLocation, creature:renderCreature, character:renderCharacter, mystery:renderMystery, gme:renderMythicGME, pub:renderPublished, playerEmu:renderPlayerEmu, threeAct:renderThreeAct };
}
function tabWirers(){
  return { gm:wireGM, adventure:wireAdventure, location:wireLocation, creature:wireCreature, character:wireCharacter, mystery:wireMystery, gme:wireMythicGME, pub:wirePublished, playerEmu:wirePlayerEmu, threeAct:wireThreeAct };
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

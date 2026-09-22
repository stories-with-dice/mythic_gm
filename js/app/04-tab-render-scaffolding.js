/* =========================================================================
   TAB / RENDER SCAFFOLDING
   -------------------------------------------------------------------------
   Split view: right-clicking a tab pins it to a second pane on the right
   (`rightTab`), instead of switching the main pane's `currentTab`. The two
   are kept mutually exclusive (a tab can't be both at once) so every tab's
   DOM ids stay unique on the page — see the invariant enforced in
   renderTabNav()'s contextmenu handler below. Neither `currentTab` nor
   `rightTab` is persisted (same as before the split view existed); a
   reload always lands back on the default tab, unsplit.
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
    });
    b.addEventListener('contextmenu', (e)=>{
      e.preventDefault();
      const id = b.dataset.tab;
      if(id === rightTab){ rightTab = null; renderTabNav(); renderActive(); return; }   // right-click again = close split
      if(id === currentTab) currentTab = (TABS.find(t=>t.id!==id) || {id:currentTab}).id;  // don't collide with the new rightTab
      rightTab = id;
      renderTabNav();
      renderActive();
    });
  });
}

function renderActive(){
  document.getElementById('panelHost').innerHTML = tabRenderers()[currentTab]();

  const splitWrap = document.getElementById('panelSplit');
  const rightHost = document.getElementById('panelHostRight');
  if(rightTab){
    splitWrap.classList.add('split');
    rightHost.innerHTML = `
      <div class="split-right-head">
        <span class="split-right-title">${TABS.find(t=>t.id===rightTab).label}</span>
        <button type="button" class="btn small split-close" id="btnCloseSplit" title="Close split view" aria-label="Close split view">&times;</button>
      </div>
      <div class="split-right-body">${tabRenderers()[rightTab]()}</div>`;
  } else {
    splitWrap.classList.remove('split');
    rightHost.innerHTML = '';
  }

  wireActive();
}
function wireActive(){
  tabWirers()[currentTab]();
  if(rightTab){
    tabWirers()[rightTab]();
    document.getElementById('btnCloseSplit').addEventListener('click', ()=>{
      rightTab = null;
      renderTabNav();
      renderActive();
    });
  }
}

/* =========================================================================
   TAB / RENDER SCAFFOLDING
   ========================================================================= */
const TABS = [
  {id:'gme', label:'Mythic GME'},
  {id:'gm', label:'Game Master'},
  {id:'adventure', label:'Adventure Crafter'},
  {id:'location', label:'Location Crafter'},
  {id:'creature', label:'Creature Crafter'},
  {id:'character', label:'Character Crafter'},
  {id:'mystery', label:'Mystery Matrix'}
];
let currentTab = 'gme';

function renderTabNav(){
  const nav = document.getElementById('tabNav');
  nav.innerHTML = TABS.map(t=>`<button data-tab="${t.id}" class="${t.id===currentTab?'active':''}">${t.label}</button>`).join('');
  nav.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{ currentTab=b.dataset.tab; renderTabNav(); renderActive(); });
  });
}

function renderActive(){
  const host = document.getElementById('panelHost');
  const renderers = { gm:renderGM, adventure:renderAdventure, location:renderLocation, creature:renderCreature, character:renderCharacter, mystery:renderMystery, gme:renderMythicGME };
  host.innerHTML = renderers[currentTab]();
  wireActive();
}
function wireActive(){
  const wirers = { gm:wireGM, adventure:wireAdventure, location:wireLocation, creature:wireCreature, character:wireCharacter, mystery:wireMystery, gme:wireMythicGME };
  wirers[currentTab]();
}

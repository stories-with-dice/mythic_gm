/* =========================================================================
   CAMPAIGN BAR
   ========================================================================= */
function renderCampaignBar(){
  const sel = document.getElementById('campaignSelect');
  sel.innerHTML = Object.keys(STORE.campaigns).map(name=>`<option value="${name}" ${name===STORE.current?'selected':''}>${name}</option>`).join('');
}
// Hint text (placeholders) shows only while the current campaign is new:
// a campaign made more than HINT_MAX_AGE ago, or one with no `createdAt`
// (from before the field existed), gets `html.no-hints`, which app.css
// uses to hide every placeholder. Checked at boot and on a campaign switch.
const HINT_MAX_AGE = 24 * 60 * 60 * 1000;
function campaignIsNew(c){ return !!(c && Number.isFinite(c.createdAt) && Date.now() - c.createdAt < HINT_MAX_AGE); }
function updateHints(){ document.documentElement.classList.toggle('no-hints', !campaignIsNew(campaign())); }
function clearNoteDraft(){ if(noteMDE){ noteMDE.value(''); } }
// Adds one imported campaign (always through sanitizeCampaign()) under a free
// name and returns that name. Does not persist or re-render: see finishImport().
function importCampaign(name, data){
  const baseName = (typeof name === 'string' && name.trim()) ? name.trim() : 'Imported Campaign';
  let finalName = STORE.campaigns[baseName] ? `${baseName} (imported)` : baseName;
  let n = 2;
  while(STORE.campaigns[finalName]){ finalName = `${baseName} (imported ${n})`; n++; }
  STORE.campaigns[finalName] = sanitizeCampaign(data);
  return finalName;
}
function finishImport(){
  switchCampaignView();
  updateHints();
  persist();
  renderCampaignBar();
  clearNoteDraft();
  renderActive();
  renderLogSection();
}
// Shows STORE.current after a delete or an undo: its view, its hints, its log.
function showCampaign(){
  switchCampaignView();
  updateHints();
  persist();
  renderCampaignBar();
  renderActive();
  clearNoteDraft();
  renderLogSection();
}
// "Not saved" badge: the campaigns live in this tab's sessionStorage only,
// so closing the tab deletes them unless Dropbox sync is on. Called by
// renderDropbox() (19) on every sync status change, and at boot.
function updateSaveBadge(){
  const b = document.getElementById('saveBadge');
  if(b) b.hidden = typeof dbxConfig !== 'undefined' && !!dbxConfig.enabled;
}
// True when closing the tab would lose work: Dropbox sync is off and a
// campaign has log entries. The beforeunload handler (22) asks first.
function unsavedWork(){
  if(typeof dbxConfig !== 'undefined' && dbxConfig.enabled) return false;
  return Object.values(STORE.campaigns).some(c => c && Array.isArray(c.log) && c.log.length);
}
function wireCampaignBar(){
  // "Campaign ⋯" menu (Rename / Export / Import / Delete): closes after a
  // pick, on a click outside it, and on Escape.
  const menu = document.getElementById('campaignMenu');
  menu.querySelector('.campaign-menu-list').addEventListener('click', e => { if(e.target.closest('button')) menu.open = false; });
  document.addEventListener('click', e => { if(menu.open && !menu.contains(e.target)) menu.open = false; });
  menu.addEventListener('keydown', e => { if(e.key === 'Escape' && menu.open){ menu.open = false; menu.querySelector('summary').focus(); } });
  document.getElementById('saveBadge').addEventListener('click', ()=> openSettings());

  document.getElementById('campaignSelect').addEventListener('change', e=>{
    STORE.current = e.target.value;
    switchCampaignView();
    updateHints();
    persist();
    renderActive();
    clearNoteDraft();
    renderLogSection();
  });
  document.getElementById('btnNewCampaign').addEventListener('click', ()=>{
    const name = prompt("Name for the new campaign:");
    if(!name) return;
    if(STORE.campaigns[name]){ alert("A campaign with that name already exists."); return; }
    // A new campaign starts with the view on screen now (tabs, split, intros).
    STORE.campaigns[name] = Object.assign(newCampaign(), { ui: Object.assign(liveView(), { at: Date.now() }) });
    STORE.current = name;
    updateHints();
    persist();
    renderCampaignBar();
    renderActive();
    clearNoteDraft();
    renderLogSection();
  });
  document.getElementById('btnRenameCampaign').addEventListener('click', ()=>{
    const oldName = STORE.current;
    const name = prompt("Rename campaign:", oldName);
    if(!name || name===oldName) return;
    if(STORE.campaigns[name]){ alert("A campaign with that name already exists."); return; }
    STORE.campaigns[name] = STORE.campaigns[oldName];
    delete STORE.campaigns[oldName];
    STORE.current = name;
    persist();
    renderCampaignBar();
    renderActive();
    renderLogSection();
  });
  // Delete runs at once; the toast offers Undo for UNDO_MS (04).
  document.getElementById('btnDeleteCampaign').addEventListener('click', ()=>{
    const names = Object.keys(STORE.campaigns);
    if(names.length<=1){ alert("At least one campaign must remain."); return; }
    const name = STORE.current, data = STORE.campaigns[name], at = names.indexOf(name);
    delete STORE.campaigns[name];
    STORE.current = Object.keys(STORE.campaigns)[0];
    showCampaign();
    showUndoToast(`Deleted campaign "${name}".`, ()=>{
      if(STORE.campaigns[name]) return;   // a new campaign took the name
      const order = Object.keys(STORE.campaigns);
      order.splice(Math.min(at, order.length), 0, name);
      const back = {};
      order.forEach(n => { back[n] = n === name ? data : STORE.campaigns[n]; });
      STORE.campaigns = back;
      STORE.current = name;
      showCampaign();
    });
  });

  document.getElementById('btnExportCampaign').addEventListener('click', ()=>{
    const name = STORE.current;
    const payload = {
      mythicToolkitCampaign: true,
      version: 1,
      name,
      exportedAt: timestamp(),
      data: campaign()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9\-_]+/gi,'_')}_campaign.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  document.getElementById('btnImportCampaign').addEventListener('click', ()=>{
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', (e)=>{
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file later
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      let parsed;
      try{ parsed = JSON.parse(reader.result); }
      catch(err){ alert("That file isn't valid JSON — could not import."); return; }
      // The Dropbox sync file (19-dropbox-sync.js) holds every campaign:
      // import each one, renamed on a name clash like a single export.
      if(parsed && parsed.mythicToolkitSync && parsed.campaigns && typeof parsed.campaigns === 'object'){
        const names = Object.keys(parsed.campaigns).filter(n => n && n !== '__proto__');
        if(!names.length){ alert("That Dropbox file has no campaigns."); return; }
        const added = names.map(n => importCampaign(n, parsed.campaigns[n]));
        STORE.current = added[0];
        finishImport();
        alert(`Imported ${added.length} campaign${added.length===1?'':'s'}: ${added.join(', ')}.`);
        return;
      }
      if(!parsed || typeof parsed !== 'object' || !parsed.mythicToolkitCampaign || !parsed.data){
        alert("That doesn't look like a Mythic Toolkit campaign export.");
        return;
      }
      const finalName = importCampaign(parsed.name, parsed.data);
      STORE.current = finalName;
      finishImport();
      alert(`Imported as campaign "${finalName}".`);
    };
    reader.onerror = ()=>{ alert("Could not read that file."); };
    reader.readAsText(file);
  });
}

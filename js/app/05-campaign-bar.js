/* =========================================================================
   CAMPAIGN BAR
   ========================================================================= */
function renderCampaignBar(){
  const sel = document.getElementById('campaignSelect');
  sel.innerHTML = Object.keys(STORE.campaigns).map(name=>`<option value="${name}" ${name===STORE.current?'selected':''}>${name}</option>`).join('');
}
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
  persist();
  renderCampaignBar();
  clearNoteDraft();
  renderActive();
  renderLogSection();
}
function wireCampaignBar(){
  document.getElementById('campaignSelect').addEventListener('change', e=>{
    STORE.current = e.target.value;
    persist();
    renderActive();
    clearNoteDraft();
    renderLogSection();
  });
  document.getElementById('btnNewCampaign').addEventListener('click', ()=>{
    const name = prompt("Name for the new campaign:");
    if(!name) return;
    if(STORE.campaigns[name]){ alert("A campaign with that name already exists."); return; }
    STORE.campaigns[name] = freshCampaign();
    STORE.current = name;
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
  document.getElementById('btnDeleteCampaign').addEventListener('click', ()=>{
    const names = Object.keys(STORE.campaigns);
    if(names.length<=1){ alert("At least one campaign must remain."); return; }
    if(!confirm(`Delete campaign "${STORE.current}"? This cannot be undone.`)) return;
    delete STORE.campaigns[STORE.current];
    STORE.current = Object.keys(STORE.campaigns)[0];
    persist();
    renderCampaignBar();
    renderActive();
    clearNoteDraft();
    renderLogSection();
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

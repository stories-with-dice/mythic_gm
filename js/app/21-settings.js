/* =========================================================================
   SETTINGS
   The Settings modal ("⚙ Settings" in the campaign bar). It holds the Theme
   picker (20-themes.js), the Dropbox sync panel (19-dropbox-sync.js), and
   collapsible editors for the campaign's editable random tables:
   - Random Event Focus Table (gme.eventFocusTable; Mythic GME + Published
     Adventures tabs)
   - Random Inspiration Source (gm.inspiration.entries; Game Master tab)

   wireSettings() builds the shell once. The Theme and Dropbox sections are
   filled once by wireTheme() / wireDropbox() and never rebuilt, so a
   half-typed Dropbox code survives. Only #settingsTables is rebuilt
   (renderSettingsTables()), on every edit and on every renderActive() while
   the modal is open, so it follows campaign switches and Dropbox pulls.
   ========================================================================= */
let settingsOpen = false;
// Which table editors are expanded; kept across re-renders and re-opens.
let settingsTablesOpen = { eventFocus: false, inspiration: false };

function renderSettingsShellHtml(){
  return `
  <div class="settings-inner" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
    <button class="btn small settings-close" id="settingsClose" title="Close" aria-label="Close">&times;</button>
    <h2 class="tool-title" id="settingsTitle">Settings</h2>
    <section class="settings-section">
      <h3 class="block-title">Theme</h3>
      <div class="field">
        <label for="themeSelect">Color and font theme</label>
        <select id="themeSelect" class="field-input"></select>
      </div>
      <div class="small-note">Saved in this browser only. It is not exported or synced.</div>
    </section>
    <section class="settings-section">
      <h3 class="block-title">Dropbox sync</h3>
      <div id="settingsDropbox"></div>
    </section>
    <section class="settings-section">
      <h3 class="block-title">Random tables</h3>
      <div id="settingsTables"></div>
    </section>
  </div>`;
}

function renderEventFocusEditorHtml(){
  const table = campaign().gme.eventFocusTable;
  const rows = table.map((r, i) => {
    const lo = (i === 0 ? 0 : table[i - 1].max) + 1;
    return `<tr>
      <td class="range"><span class="small-note">${lo <= r.max ? lo : r.max}&ndash;</span><input type="number" min="1" max="100" data-focus-max="${i}" class="field-input" value="${r.max}"></td>
      <td><input type="text" data-focus-result="${i}" class="field-input" value="${escapeAttr(r.result)}"></td>
      <td><button class="btn small danger" data-focus-rm="${i}" ${table.length <= 1 ? 'disabled' : ''}>&#10005;</button></td>
    </tr>`;
  }).join('');
  return `
    <div class="small-note">Rolled (1d100) when a Scene test comes up <b>Interrupt</b>, on the Mythic GME and Published Adventures tabs.</div>
    <div style="overflow-x:auto;">
      <table class="gme-focus-table">
        <thead><tr><th>Range (1d100)</th><th>Event Focus</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="row" style="margin-top:10px;">
      <button class="btn small" id="btnGmeFocusAdd">Add row</button>
      <button class="btn small" id="btnGmeFocusReset">Reset to default</button>
    </div>
    <div class="small-note" style="margin-top:6px;">Ranges run in order from 1; each row sets the top of its band. A roll above the last row uses the last row.</div>`;
}

function renderInspirationEditorHtml(){
  const entries = campaign().gm.inspiration.entries;
  const rows = entries.map((e, i) => `
    <tr>
      <td><input type="text" data-insp-label="${i}" class="field-input" value="${escapeAttr(e.label)}"></td>
      <td class="weight"><input type="number" min="1" max="100" data-insp-weight="${i}" class="field-input" value="${e.weight}"></td>
      <td><button class="btn small danger" data-insp-rm="${i}" ${entries.length <= 1 ? 'disabled' : ''}>&#10005;</button></td>
    </tr>`).join('');
  return `
    <div class="small-note">Rolled on the Game Master tab, under Discover Meaning. Weight an entry higher to make it more likely.</div>
    <div style="overflow-x:auto;">
      <table class="gm-insp-table">
        <thead><tr><th>Source</th><th>Weight</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="row" style="margin-top:10px;">
      <button class="btn small" id="btnGmInspAdd">Add entry</button>
      <button class="btn small" id="btnGmInspReset">Reset to default</button>
    </div>`;
}

function renderSettingsTables(){
  const host = document.getElementById('settingsTables');
  if(!host) return;
  const c = campaign();
  const focusCustomised = JSON.stringify(c.gme.eventFocusTable) !== JSON.stringify(DEFAULT_EVENT_FOCUS);
  const inspCustomised = JSON.stringify(c.gm.inspiration.entries) !== JSON.stringify(freshInspirationEntries());
  const tag = on => on ? ' <span class="settings-tag">customised</span>' : '';
  host.innerHTML = `
    <div class="small-note">These tables belong to the campaign &ldquo;${escapeAttr(STORE.current)}&rdquo;. Each campaign has its own copy.</div>
    <details class="settings-table" data-settings-table="eventFocus" ${settingsTablesOpen.eventFocus ? 'open' : ''}>
      <summary>Random Event Focus Table${tag(focusCustomised)}</summary>
      ${renderEventFocusEditorHtml()}
    </details>
    <details class="settings-table" data-settings-table="inspiration" ${settingsTablesOpen.inspiration ? 'open' : ''}>
      <summary>Random Inspiration Source${tag(inspCustomised)}</summary>
      ${renderInspirationEditorHtml()}
    </details>`;
  wireSettingsTables();
}

// A structural edit re-renders the tabs (their "Customised" notes) and, via
// renderActive(), this editor too.
function settingsTableChanged(){
  persist();
  renderActive();
}

function wireSettingsTables(){
  const host = document.getElementById('settingsTables');
  const all = sel => host.querySelectorAll(sel);
  const on = (id, fn) => { const el = document.getElementById(id); if(el) el.addEventListener('click', fn); };
  all('details[data-settings-table]').forEach(d => d.addEventListener('toggle', () => {
    settingsTablesOpen[d.dataset.settingsTable] = d.open;
  }));

  /* ----- Random Event Focus Table ----- */
  const focus = () => campaign().gme.eventFocusTable;
  all('[data-focus-max]').forEach(el => el.addEventListener('change', () => {
    const i = Number(el.dataset.focusMax);
    let v = Math.round(Number(el.value));
    if(!Number.isFinite(v)) v = focus()[i].max;
    focus()[i].max = Math.max(1, Math.min(100, v));
    focus().sort((a, b) => a.max - b.max);
    settingsTableChanged();
  }));
  // Text edits save without a re-render, so the focus moves on normally.
  all('[data-focus-result]').forEach(el => el.addEventListener('change', () => {
    focus()[Number(el.dataset.focusResult)].result = el.value.trim() || '(unnamed)';
    persist();
  }));
  all('[data-focus-rm]').forEach(b => b.addEventListener('click', () => {
    if(focus().length <= 1) return;
    focus().splice(Number(b.dataset.focusRm), 1);
    settingsTableChanged();
  }));
  on('btnGmeFocusAdd', () => {
    focus().push({ max: 100, result: 'New Focus' });
    focus().sort((a, b) => a.max - b.max);
    settingsTableChanged();
  });
  on('btnGmeFocusReset', () => {
    if(!confirm('Reset the Random Event Focus Table to the default 12 rows?')) return;
    campaign().gme.eventFocusTable = DEFAULT_EVENT_FOCUS.map(r => ({ ...r }));
    addLog('Mythic GME', '**Random Event Focus Table** reset to default.');
    settingsTableChanged();
  });

  /* ----- Random Inspiration Source ----- */
  const insp = () => campaign().gm.inspiration.entries;
  all('[data-insp-label]').forEach(el => el.addEventListener('change', () => {
    const e = insp()[Number(el.dataset.inspLabel)];
    e.label = el.value.trim() || e.label;
    persist();
  }));
  all('[data-insp-weight]').forEach(el => el.addEventListener('change', () => {
    const e = insp()[Number(el.dataset.inspWeight)];
    let v = Math.round(Number(el.value));
    if(!Number.isFinite(v)) v = e.weight;
    e.weight = Math.max(1, Math.min(100, v));
    settingsTableChanged();
  }));
  all('[data-insp-rm]').forEach(b => b.addEventListener('click', () => {
    if(insp().length <= 1) return;
    insp().splice(Number(b.dataset.inspRm), 1);
    settingsTableChanged();
  }));
  on('btnGmInspAdd', () => {
    insp().push({ label: 'New Source', weight: 1 });
    settingsTableChanged();
  });
  on('btnGmInspReset', () => {
    if(!confirm('Reset the Random Inspiration Source list to the default 5 entries?')) return;
    campaign().gm.inspiration.entries = freshInspirationEntries();
    addLog('Random Inspiration Source', '**Random Inspiration Source** list reset to default.');
    settingsTableChanged();
  });
}

// `table` ('eventFocus' | 'inspiration'), optional, expands that editor and scrolls to it.
function openSettings(table){
  if(table) settingsTablesOpen[table] = true;
  settingsOpen = true;
  renderSettingsTables();
  renderDropbox();
  document.getElementById('settingsOverlay').classList.add('open');
  if(table){
    const d = document.querySelector(`#settingsTables details[data-settings-table="${table}"]`);
    if(d && d.scrollIntoView) d.scrollIntoView({ block: 'nearest' });
  }
}
function closeSettings(){
  settingsOpen = false;
  const overlay = document.getElementById('settingsOverlay');
  if(overlay) overlay.classList.remove('open');
}

// Called from 22-init.js before wireTheme() and wireDropbox(), which fill
// #themeSelect and #settingsDropbox.
function wireSettings(){
  const overlay = document.getElementById('settingsOverlay');
  overlay.innerHTML = renderSettingsShellHtml();
  document.getElementById('btnSettings').addEventListener('click', () => openSettings());
  document.getElementById('settingsClose').addEventListener('click', closeSettings);
  overlay.addEventListener('click', e => { if(e.target === overlay) closeSettings(); });
  // Escape closes the Dropbox conflict dialog first (it sits on top), then Settings.
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    const modal = document.getElementById('dropboxModal');
    if(modal && modal.classList.contains('open')) closeDropboxModal();
    else if(settingsOpen) closeSettings();
  });
}

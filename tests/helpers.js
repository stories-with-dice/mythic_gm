/* =========================================================================
   App-specific test helpers
   -------------------------------------------------------------------------
   These lean on the fact that the app's files are plain (non-module) scripts
   sharing one global scope, so STORE / currentTab / the render+wire funcs are
   all reachable here by name.
   ========================================================================= */

/* Wipe persisted state and rebuild the whole UI from a clean campaign, exactly
   the way a fresh page load would. Call in beforeEach for isolation. */
window.resetApp = function resetApp() {
  try { sessionStorage.removeItem('mythicToolkit_v1'); } catch (_) {}
  STORE = loadStore();                 // global `let` from 03-state-persistence.js
  currentTab = 'gme';                  // global `let` from 04-tab-render-scaffolding.js (default landing tab)
  rightTab = null;                     // global `let` from 04-tab-render-scaffolding.js (split view, off by default)

  // transient per-tab view state (module-level `let`s) — clear so tests don't
  // leak rolled words / cached "last result" HTML into each other
  gmWordLog = [];
  creatureDescList = [];
  charWords = { identity: [], mind: [], body: [], talent: [] };
  lastAreaResultHtml = '';
  lastTurningPointHtml = '';
  lastSinglePlotHtml = '';
  lastDiscoveryHtml = '';
  gmeSceneTestHtml = '';
  gmeListRollHtml = { threads: '', characters: '' };
  gmeTrackResultHtml = {};
  gmeFocusEditorOpen = false;
  gmInspEditorOpen = false;
  lastInspirationHtml = '';
  pubSceneTestHtml = '';
  pubCrisisHtml = '';
  pubElementHtml = '';
  pubMeaningRollHtml = '';
  pubScaleInput = '';
  pubFlowOpen = false;
  peEncounterHtml = '';
  peResponseHtml = {};
  peLastResponse = {};
  peRefOpen = false;
  threeActResultHtml = '';
  threeActThreadSuggestion = null;
  threeActFlowOpen = false;
  helpOpen = false;
  const helpOverlay = document.getElementById('helpOverlay');
  if(helpOverlay){ helpOverlay.classList.remove('open'); helpOverlay.innerHTML = ''; }

  // Dropbox sync (19-dropbox-sync.js): off, no tokens, no bookkeeping. The
  // keys carry the test prefix set in tests.html, never the real app's.
  clearTimeout(dbx.timer);
  try {
    localStorage.removeItem(DBX_CONFIG_KEY);
    localStorage.removeItem(DBX_TOKEN_KEY);
    sessionStorage.removeItem(DBX_SYNC_KEY);
  } catch (_) {}
  dbxConfig = dropboxLoadConfig();
  dbxSync = dropboxLoadSync();
  dbx = dropboxFreshRuntime();
  closeDropboxModal();
  closeDropboxPanel();
  renderDropbox();

  renderCampaignBar();
  renderTabNav();
  renderActive();                      // also runs wireActive()
  renderLogSection();
  // Quick Note editor is not campaign-scoped; leave the existing EasyMDE
  // instance alone unless a spec asks for a fresh one.
};

/* Switch to a tab and return #panelHost, wired and rendered. */
window.showTab = function showTab(id) {
  if (id === rightTab) rightTab = null;   // mirror the real click handler's invariant
  currentTab = id;
  renderTabNav();
  renderActive();
  return document.getElementById('panelHost');
};

/* Right-click a tab button (opens/moves/closes the split-right pane). */
window.rightClickTab = function rightClickTab(id) {
  const btn = document.querySelector('#tabNav button[data-tab="' + id + '"]');
  if (!btn) throw new Error('rightClickTab: no tab button for ' + id);
  btn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  return document.getElementById('panelHostRight');
};

window.$ = (sel, root) => (root || document).querySelector(sel);
window.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

/* Fire a real click event. */
window.click = function click(elOrSel) {
  const el = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
  if (!el) throw new Error('click: no element for ' + elOrSel);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return el;
};

/* Set an <input>/<select> value and dispatch input+change. */
window.setValue = function setValue(elOrSel, value) {
  const el = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
  if (!el) throw new Error('setValue: no element for ' + elOrSel);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return el;
};

/* Force dice outcomes. Pass an array (consumed in order, then repeats last) or
   a function(sides)->roll. Restores Math.random after cb() (supports async). */
window.withRolls = async function withRolls(seq, cb) {
  const realRandom = Math.random;
  let i = 0;
  if (Array.isArray(seq)) {
    // rollDie(sides) === 1 + floor(random()*sides); to get target T on `sides`,
    // random() must land in [(T-1)/sides, T/sides). We don't know `sides` here,
    // so approximate with the midpoint for the *next* requested roll via a queue
    // keyed only by call order. Simplest robust approach: monkeypatch rollDie.
    const realRollDie = window.rollDie;
    window.rollDie = function (sides) {
      const t = i < seq.length ? seq[i] : seq[seq.length - 1];
      i++;
      return Math.min(Math.max(1, t), sides);
    };
    try { return await cb(); }
    finally { window.rollDie = realRollDie; }
  } else {
    Math.random = function () { return 0; };
    const realRollDie = window.rollDie;
    window.rollDie = function (sides) { return Math.min(seq(sides) || 1, sides); };
    try { return await cb(); }
    finally { Math.random = realRandom; window.rollDie = realRollDie; }
  }
};

/* Stub window.confirm / prompt / alert for a callback, then restore. */
window.withDialogs = async function withDialogs(opts, cb) {
  const real = { confirm: window.confirm, prompt: window.prompt, alert: window.alert };
  window.confirm = () => ('confirm' in opts ? opts.confirm : true);
  window.prompt = () => ('prompt' in opts ? opts.prompt : '');
  window.alert = () => {};
  try { return await cb(); }
  finally { Object.assign(window, real); }
};

/* The current campaign's log entries (array of {ts, section, md}). */
window.logEntries = () => campaign().log;
window.lastLog = () => campaign().log[campaign().log.length - 1];

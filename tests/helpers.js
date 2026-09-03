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
  pubSceneTestHtml = '';
  pubCrisisHtml = '';
  pubElementHtml = '';
  pubMeaningRollHtml = '';
  pubFlowOpen = false;

  renderCampaignBar();
  renderTabNav();
  renderActive();                      // also runs wireActive()
  renderLogSection();
  // Quick Note editor is not campaign-scoped; leave the existing EasyMDE
  // instance alone unless a spec asks for a fresh one.
};

/* Switch to a tab and return #panelHost, wired and rendered. */
window.showTab = function showTab(id) {
  currentTab = id;
  renderTabNav();
  renderActive();
  return document.getElementById('panelHost');
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

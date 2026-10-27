/* =========================================================================
   THEMES
   Color + font themes, picked in the Settings modal (#themeSelect). A theme is
   only <html data-theme="...">: css/app.css redefines the :root tokens per
   theme. The choice is a per-device preference, so it lives in localStorage
   (THEME_KEY), not in STORE, and is not synced to Dropbox.
   ========================================================================= */
const UI_THEMES = [
  { id:'classic', label:'Case file' },
  { id:'fantasy', label:'Fantasy' },
  { id:'sf',      label:'Sci-fi' },
  { id:'horror',  label:'Horror' },
];
// Same prefix as the Dropbox keys, so a test run never changes the real app's theme.
const THEME_KEY = DBX_KEY_PREFIX + 'mythicToolkit_theme';

function loadTheme(){
  try{
    const id = localStorage.getItem(THEME_KEY);
    return UI_THEMES.some(t => t.id === id) ? id : 'classic';
  }catch(_){ return 'classic'; }
}

function applyTheme(id){
  if(!UI_THEMES.some(t => t.id === id)) id = 'classic';
  if(id === 'classic') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = id;
  const sel = document.getElementById('themeSelect');
  if(sel) sel.value = id;
  return id;
}

function setTheme(id){
  id = applyTheme(id);
  try{ localStorage.setItem(THEME_KEY, id); }catch(_){}
}

function wireTheme(){
  const sel = document.getElementById('themeSelect');
  if(!sel) return;
  sel.innerHTML = UI_THEMES.map(t => `<option value="${t.id}">${escapeAttr(t.label)}</option>`).join('');
  sel.value = loadTheme();
  sel.addEventListener('change', () => setTheme(sel.value));
}

// Apply at load, before the first render, so the page doesn't flash the default theme.
applyTheme(loadTheme());

/* =========================================================================
   DROPBOX SYNC  (optional — off until the user clicks Dropbox → Connect)
   -------------------------------------------------------------------------
   Ported from the osr_keeper project's js/dropbox.js. When it is on, every
   campaign in STORE is one JSON file in the app's Dropbox folder
   (Apps/<app name>/"Mythic Toolkit campaigns.json"), and every persist()
   (03-state-persistence.js calls dropboxNoteSave) uploads it again a few
   seconds later. Because STORE itself is session-only, the Dropbox copy is
   also how campaigns come back in a new browser tab.

   Sign-in is Dropbox OAuth 2 with PKCE and no redirect URI: Connect opens
   Dropbox in a new tab, Dropbox shows a code, and the user pastes it back. The
   code buys a refresh token (token_access_type=offline) that does not expire,
   so the app gets new 4-hour access tokens by itself, with no backend and no
   app secret. Nothing redirects back to the page, so it works from file://
   and from the single-file release. The calls are plain fetch to
   api.dropboxapi.com / content.dropboxapi.com — the app's one network
   dependency (see AGENTS.md "Dropbox sync"). The app is an "App folder" app:
   it sees only its own folder.

   Where the per-device data lives (never inside STORE, so Export and the
   synced file never carry it):
     localStorage   DBX_CONFIG_KEY  { enabled, appKey }   — survives closing the tab
     localStorage   DBX_TOKEN_KEY   { token, expiresAt, refresh, appKey }
     sessionStorage DBX_SYNC_KEY    { fileId, remoteHash, syncedHash, lastSync }
   The sync bookkeeping is session-only on purpose: it describes the STORE in
   this tab's sessionStorage, and a new tab starts with an empty STORE. With
   the bookkeeping in localStorage, a new tab would see "only local changed"
   and upload its empty campaign over the Dropbox copy.
   ========================================================================= */

// App key of a Dropbox "Scoped access / App folder" app. Not a secret.
// Empty = each user enters their own under Dropbox → Setup (stored per device).
const DBX_DEFAULT_APP_KEY = '';
const DBX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DBX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DBX_API = 'https://api.dropboxapi.com/2';
const DBX_CONTENT_API = 'https://content.dropboxapi.com/2';
// tests/tests.html sets MYTHIC_DROPBOX_KEY_PREFIX, so a test run in a normal
// browser never touches the real app's localStorage keys (file:// pages share them).
const DBX_KEY_PREFIX = (typeof window.MYTHIC_DROPBOX_KEY_PREFIX === 'string') ? window.MYTHIC_DROPBOX_KEY_PREFIX : '';
const DBX_CONFIG_KEY = DBX_KEY_PREFIX + 'mythicToolkit_dropbox_v1';
const DBX_TOKEN_KEY = DBX_KEY_PREFIX + 'mythicToolkit_dropbox_token';
const DBX_SYNC_KEY = DBX_KEY_PREFIX + 'mythicToolkit_dropbox_sync';
const DBX_FILE_NAME = 'Mythic Toolkit campaigns.json';
const DBX_FILE_PATH = '/' + DBX_FILE_NAME;
const DBX_UPLOAD_DELAY = 4000;     // quiet time after the last save before uploading
const DBX_MAX_WAIT = 30000;        // ...but never hold back changes longer than this
const DBX_FOCUS_CHECK_MS = 60000;  // re-check Dropbox at most this often when the tab regains focus
const DBX_TOKEN_MARGIN = 60000;    // treat an access token as expired a minute early

function dropboxReadJson(storage, key){
  try{ const raw = storage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}
function dropboxWriteJson(storage, key, value){
  try{
    if(value == null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  }catch(e){ console.warn('dropbox: storage write failed', e); }
}

function dropboxLoadConfig(){
  return Object.assign({ enabled:false, appKey:'' }, dropboxReadJson(localStorage, DBX_CONFIG_KEY) || {});
}
function dropboxLoadSync(){
  return Object.assign({ fileId:'', remoteHash:'', syncedHash:'', lastSync:0 }, dropboxReadJson(sessionStorage, DBX_SYNC_KEY) || {});
}
// Runtime state (not persisted).
function dropboxFreshRuntime(){
  return {
    status: dbxConfig.enabled ? 'signed-out' : 'off', // off | signed-out | pending | syncing | synced | conflict | error
    message: '',
    busy: false,
    again: false,      // a save happened during a sync pass: run another one after it
    timer: null,
    firstPendingAt: 0,
    lastCheck: 0,
    auth: null,        // { verifier, appKey, url } while the user copies the code from Dropbox
    conflict: null     // { mode: 'link'|'conflict', remote, text }
  };
}

let dbxConfig = dropboxLoadConfig();
let dbxSync = dropboxLoadSync();
let dbx = dropboxFreshRuntime();
let dbxPanelOpen = false;

function dropboxSaveConfig(){ dropboxWriteJson(localStorage, DBX_CONFIG_KEY, dbxConfig); }
function dropboxSaveSync(){ dropboxWriteJson(sessionStorage, DBX_SYNC_KEY, dbxSync); }
function dropboxAppKey(){ return String(dbxConfig.appKey || '').trim() || DBX_DEFAULT_APP_KEY; }

// The synced file: every campaign, but not STORE.current (each tab keeps its
// own selection, so switching campaigns is not a change to sync).
function dropboxSyncText(campaigns){
  return JSON.stringify({ mythicToolkitSync: 1, campaigns: campaigns || STORE.campaigns });
}

// FNV-1a over the UTF-16 code units, plus the length. Only compares a
// state with the one this tab last synced; not a security hash.
function dropboxHash(s){
  let h = 0x811c9dc5;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16) + ':' + s.length;
}

// True while this tab holds only the untouched "Campaign 1" that loadStore()
// creates for an empty sessionStorage: a link then pulls without asking.
function dropboxIsPristine(){
  return dropboxSyncText() === dropboxSyncText({ "Campaign 1": freshCampaign() });
}

// What one sync pass does, from the Dropbox file's metadata (null = no file
// yet), this tab's bookkeeping, and a hash of the current local state:
//   create   — no file in Dropbox: upload this tab's campaigns.
//   link     — a file exists, but this tab never synced with it: ask
//              (or pull, when this tab holds only a fresh, untouched campaign).
//   noop / upload / pull — at most one side changed since the last sync.
//   conflict — both sides changed: ask.
// Dropbox's content_hash changes only with the content (not on a rename/move).
function dropboxDecideSync(remote, s, localHash){
  if(!remote) return 'create';
  if(remote.id !== s.fileId || !s.remoteHash) return 'link';
  const remoteChanged = remote.hash !== s.remoteHash;
  const localChanged = localHash !== s.syncedHash;
  if(remoteChanged && localChanged) return 'conflict';
  if(remoteChanged) return 'pull';
  if(localChanged) return 'upload';
  return 'noop';
}

/* ---- PKCE sign-in ---- */
function dropboxBase64url(bytes){
  let s = '';
  for(let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// A verifier and its challenge. S256 needs crypto.subtle; where a browser
// has none, Dropbox also accepts the "plain" method (challenge = verifier).
async function dropboxPkcePair(subtle){
  const verifier = dropboxBase64url(crypto.getRandomValues(new Uint8Array(48)));
  if(!subtle) return { verifier, challenge: verifier, method: 'plain' };
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: dropboxBase64url(new Uint8Array(digest)), method: 'S256' };
}

function dropboxAuthUrl(key, pair){
  return DBX_AUTH_URL + '?' + new URLSearchParams({
    client_id: key, response_type: 'code', token_access_type: 'offline',
    code_challenge: pair.challenge, code_challenge_method: pair.method
  });
}

/* ---- Tokens ---- */
function dropboxError(status, message, summary){
  const e = new Error(message); e.status = status; e.summary = summary || ''; return e;
}
function dropboxTokens(){ return dropboxReadJson(localStorage, DBX_TOKEN_KEY); }
function dropboxHasToken(){ const t = dropboxTokens(); return !!(t && t.refresh); }
function dropboxClearToken(){ dropboxWriteJson(localStorage, DBX_TOKEN_KEY, null); }

async function dropboxTokenRequest(params){
  let res;
  try{
    res = await window.fetch(DBX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    });
  }catch(e){ throw dropboxError(0, 'Cannot reach Dropbox. Are you offline?'); }
  let j = null;
  try{ j = await res.json(); }catch(e){ /* not JSON */ }
  if(!res.ok || !j || !j.access_token){
    const why = (j && (j.error_description || j.error)) || 'HTTP ' + res.status;
    // 400/401 = the code or the refresh token is no good: sign in again.
    throw dropboxError(res.status === 400 || res.status === 401 ? 401 : res.status, 'Dropbox sign-in failed (' + why + ').');
  }
  return j;
}

function dropboxStoreTokens(j, refresh, key){
  dropboxWriteJson(localStorage, DBX_TOKEN_KEY, {
    token: j.access_token,
    expiresAt: Date.now() + (Number(j.expires_in) || 14400) * 1000,
    refresh: j.refresh_token || refresh,
    appKey: key
  });
  return j.access_token;
}

// Concurrent callers share one refresh.
let dbxRefreshing = null;
function dropboxRefreshAccess(t){
  if(!dbxRefreshing){
    const key = t.appKey || dropboxAppKey();
    dbxRefreshing = dropboxTokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: key })
      .then(j => dropboxStoreTokens(j, t.refresh, key))
      .catch(e => { if(e.status === 401) dropboxClearToken(); throw e; })
      .finally(() => { dbxRefreshing = null; });
  }
  return dbxRefreshing;
}

async function dropboxAccessToken(forceRefresh){
  const t = dropboxTokens();
  if(!t || !t.refresh) throw dropboxError(401, 'Not signed in to Dropbox.');
  if(!forceRefresh && t.token && Date.now() < t.expiresAt - DBX_TOKEN_MARGIN) return t.token;
  return dropboxRefreshAccess(t);
}

/* ---- Dropbox API calls (plain fetch; no Dropbox SDK) ---- */
// Dropbox-API-Arg is an HTTP header: non-ASCII must be \u-escaped.
function dropboxHeaderJson(o){
  return JSON.stringify(o).replace(/[\u007f-￿]/g, c => '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4));
}

async function dropboxFetch(url, opts, retried){
  const o = Object.assign({}, opts);
  o.method = 'POST';
  o.headers = Object.assign({ Authorization: 'Bearer ' + await dropboxAccessToken(retried) }, opts && opts.headers);
  let res;
  try{ res = await window.fetch(url, o); }
  catch(e){ throw dropboxError(0, 'Cannot reach Dropbox. Are you offline?'); }
  // An access token can be revoked before it expires: refresh once, then give up.
  if(res.status === 401 && !retried) return dropboxFetch(url, opts, true);
  if(res.status === 401){ dropboxClearToken(); throw dropboxError(401, 'Dropbox sign-in expired.'); }
  if(!res.ok){
    let msg = 'Dropbox returned HTTP ' + res.status + '.', summary = '';
    try{
      const j = JSON.parse(await res.text());
      summary = (j && j.error_summary) || '';
      if(summary) msg = 'Dropbox: ' + summary;
    }catch(e){ /* not JSON */ }
    throw dropboxError(res.status, msg, summary);
  }
  return res;
}

function dropboxApiCall(endpoint, arg){
  return dropboxFetch(DBX_API + '/' + endpoint, {
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(arg)
  }).then(r => r.json());
}

// Dropbox's file metadata, cut down to what the sync uses.
function dropboxToRemote(f){
  return { id: f.id, rev: f.rev, hash: f.content_hash || '', path: f.path_lower || DBX_FILE_PATH, modified: f.server_modified || '' };
}

// The campaigns file: the one this tab synced with (by id, so a rename or
// move inside the app folder doesn't lose it), else the default path.
async function dropboxFindRemote(){
  const paths = dbxSync.fileId ? [dbxSync.fileId, DBX_FILE_PATH] : [DBX_FILE_PATH];
  for(const path of paths){
    try{
      const f = await dropboxApiCall('files/get_metadata', { path });
      if(f && f['.tag'] === 'file') return dropboxToRemote(f);
    }catch(e){ if(!/not_found/.test(e.summary)) throw e; }
  }
  return null;
}

// By rev, so the text always matches the metadata the pass decided on.
async function dropboxDownload(remote){
  return (await dropboxFetch(DBX_CONTENT_API + '/files/download', {
    headers: { 'Dropbox-API-Arg': dropboxHeaderJson({ path: 'rev:' + remote.rev }) }
  })).text();
}

// Creates the file, or replaces it only if it is still at `remote.rev`:
// Dropbox refuses (409 conflict) when another device wrote in between.
async function dropboxUpload(text, remote){
  const arg = remote
    ? { path: remote.path, mode: { '.tag': 'update', update: remote.rev }, autorename: false, mute: true }
    : { path: DBX_FILE_PATH, mode: 'add', autorename: false, mute: true };
  return dropboxToRemote(await (await dropboxFetch(DBX_CONTENT_API + '/files/upload', {
    headers: { 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': dropboxHeaderJson(arg) },
    body: text
  })).json());
}

/* ---- Sync ---- */
function dropboxSetStatus(status, message){
  dbx.status = status;
  dbx.message = message || '';
  renderDropbox();
}

function dropboxRecordSynced(remote, hash){
  dbxSync.fileId = remote.id;
  dbxSync.remoteHash = remote.hash;
  dbxSync.syncedHash = hash;
  dbxSync.lastSync = Date.now();
  dropboxSaveSync();
}

// Replaces every campaign in this tab with the Dropbox copy (each one through
// sanitizeCampaign(), like Import), keeps the selected campaign when it still
// exists, re-renders, and records the result as synced. Writes no log line:
// two devices would otherwise pull each other's log line forever.
function dropboxApplyRemote(text, remote){
  let data;
  try{ data = JSON.parse(text); }catch(e){ throw dropboxError(0, 'The Dropbox file is not valid JSON.'); }
  const src = data && data.campaigns;
  const names = (src && typeof src === 'object' && !Array.isArray(src)) ? Object.keys(src).filter(n => n && n !== '__proto__') : [];
  if(!names.length) throw dropboxError(0, 'The Dropbox file has no campaigns.');
  const campaigns = {};
  names.forEach(n => { campaigns[n] = sanitizeCampaign(src[n]); });
  const prevCurrent = STORE.current;
  STORE.campaigns = campaigns;
  if(!campaigns[STORE.current]) STORE.current = names[0];
  // saveStore() directly, not persist(): a pull is not a local change to upload.
  const saved = saveStore(STORE);
  renderCampaignBar();
  renderActive();
  renderLogSection();
  if(STORE.current !== prevCurrent) clearNoteDraft();
  // Not saved = a reload brings back the old campaigns: don't record a sync
  // that would then upload them over the Dropbox copy.
  if(!saved) throw dropboxError(0, 'The browser storage is full, so the Dropbox copy could not be saved here.');
  dropboxRecordSynced(remote, dropboxHash(dropboxSyncText()));
}

async function dropboxSyncNow(){
  clearTimeout(dbx.timer);
  dbx.timer = null;
  if(!dbxConfig.enabled || dbx.status === 'conflict') return;
  if(dbx.busy){ dbx.again = true; return; }
  if(!dropboxHasToken()){ dropboxSetStatus('signed-out'); return; }
  dbx.busy = true;
  dbx.firstPendingAt = 0;
  dbx.lastCheck = Date.now();
  dropboxSetStatus('syncing');
  try{
    const text = dropboxSyncText();
    const hash = dropboxHash(text);
    const pristine = dropboxIsPristine();
    const remote = await dropboxFindRemote();
    const action = dropboxDecideSync(remote, dbxSync, hash);
    if(action === 'create' || action === 'upload'){
      dropboxRecordSynced(await dropboxUpload(text, action === 'upload' ? remote : null), hash);
    }else if(action !== 'noop'){ // pull, link, conflict
      const remoteText = await dropboxDownload(remote);
      const editedMeanwhile = dropboxHash(dropboxSyncText()) !== hash;
      // A fresh tab linking to Dropbox loads the Dropbox copy; an edit made
      // during the download turns a pull into a question.
      let mode = (action === 'link' && pristine) ? 'pull' : action;
      if(mode === 'pull' && editedMeanwhile) mode = 'conflict';
      if(mode === 'pull') dropboxApplyRemote(remoteText, remote);
      else if(dropboxHash(remoteText) === hash) dropboxRecordSynced(remote, hash); // already the same campaigns
      else{ dbx.conflict = { mode, remote, text: remoteText }; dropboxSetStatus('conflict'); openDropboxModal(); return; }
    }
    dropboxSetStatus('synced');
  }catch(e){
    if(e.status === 401) dropboxSetStatus('signed-out');
    // Another device wrote between our check and our upload: the next pass sees it.
    else if(/conflict/.test(e.summary)){ dropboxSetStatus('pending'); dbx.again = true; }
    else dropboxSetStatus('error', e.message);
  }finally{
    dbx.busy = false;
    if(dbx.again){ dbx.again = false; dropboxSchedule(0); }
  }
}

function dropboxSchedule(delay){
  const now = Date.now();
  if(!dbx.firstPendingAt) dbx.firstPendingAt = now;
  const wait = Math.max(0, Math.min(delay, dbx.firstPendingAt + DBX_MAX_WAIT - now));
  clearTimeout(dbx.timer);
  dbx.timer = setTimeout(dropboxSyncNow, wait);
}

// Called by persist() (03-state-persistence.js) after every successful write.
function dropboxNoteSave(){
  if(!dbxConfig.enabled || dbx.status === 'conflict') return;
  if(dbx.busy){ dbx.again = true; return; }
  if(dbx.status === 'synced') dropboxSetStatus('pending');
  dropboxSchedule(DBX_UPLOAD_DELAY);
}

// Runs a pending upload now (tests, and the tab going to the background).
function dropboxFlush(){
  if(!dbx.timer) return Promise.resolve();
  return dropboxSyncNow();
}

// Step 1 (a click): open Dropbox's consent page in a new tab. The tab is
// opened before the async PKCE work, so pop-up blockers see the click.
async function dropboxConnect(){
  const key = dropboxAppKey();
  if(!key){
    alert('Enter your Dropbox app key first (Dropbox → Setup).');
    const d = document.getElementById('dbxSetup'); if(d) d.open = true;
    return;
  }
  const tab = window.open('', '_blank');
  const pair = await dropboxPkcePair(window.crypto && crypto.subtle);
  const url = dropboxAuthUrl(key, pair);
  // Pop-ups blocked: the "Open Dropbox" link in the code row still works.
  if(tab){ tab.opener = null; tab.location.href = url; }
  dbx.auth = { verifier: pair.verifier, appKey: key, url };
  renderDropbox();
  const input = document.getElementById('dbxCode');
  if(input){ input.value = ''; input.focus(); }
}

// Step 2: trade the code the user pasted for tokens, then sync.
async function dropboxFinishConnect(code){
  const a = dbx.auth;
  code = String(code || '').trim();
  if(!a || !code) return;
  let j;
  try{
    j = await dropboxTokenRequest({ grant_type: 'authorization_code', code, code_verifier: a.verifier, client_id: a.appKey });
  }catch(e){
    alert(e.status === 401 ? 'Dropbox did not accept the code. Click Connect again and paste the new code.' : e.message);
    return;
  }
  if(!j.refresh_token){ alert('Dropbox sent no refresh token. Click Connect again.'); return; }
  dbx.auth = null;
  dropboxStoreTokens(j, '', a.appKey);
  dbxConfig.enabled = true;
  dropboxSaveConfig();
  await dropboxSyncNow();
}

function dropboxCancelConnect(){ dbx.auth = null; renderDropbox(); }

function dropboxDisconnect(){
  if(!confirm('Stop syncing with Dropbox?\n\nThe campaigns stay in this tab, and the file stays in your Dropbox.')) return;
  clearTimeout(dbx.timer);
  dbx.timer = null;
  const t = dropboxTokens();
  dropboxClearToken();
  // Revoke the token too, so it stops working everywhere. Best effort.
  if(t && t.token) window.fetch(DBX_API + '/auth/token/revoke', { method: 'POST', headers: { Authorization: 'Bearer ' + t.token } }).catch(() => {});
  dbxConfig = { enabled: false, appKey: dbxConfig.appKey };
  dropboxSaveConfig();
  dbxSync = { fileId: '', remoteHash: '', syncedHash: '', lastSync: 0 };
  dropboxSaveSync();
  dbx.conflict = null;
  dbx.auth = null;
  closeDropboxModal();
  dropboxSetStatus('off');
}

/* ---- Conflict / first-link dialog ---- */
function dropboxSummarize(campaigns){
  const names = Object.keys(campaigns || {});
  const logs = names.reduce((n, k) => n + ((campaigns[k] && Array.isArray(campaigns[k].log)) ? campaigns[k].log.length : 0), 0);
  return names.length + (names.length === 1 ? ' campaign' : ' campaigns') + ', ' + logs + (logs === 1 ? ' log entry' : ' log entries');
}
function dropboxFmtTime(t){
  const d = new Date(t);
  return isNaN(d) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function openDropboxModal(){
  const c = dbx.conflict;
  if(!c) return;
  let remoteCampaigns = {};
  try{ remoteCampaigns = (JSON.parse(c.text) || {}).campaigns || {}; }catch(e){ /* summarized as empty */ }
  document.getElementById('dbxModalTitle').textContent = c.mode === 'link' ? 'Campaigns found in Dropbox' : 'Dropbox copy changed';
  document.getElementById('dbxModalText').textContent = c.mode === 'link'
    ? 'Your Dropbox already has Mythic Toolkit campaigns, and they are different from the ones in this tab. Choose which copy to keep. The other one is replaced.'
    : 'The Dropbox copy changed on another device, and this tab has changes too. Choose which copy to keep. The other one is replaced.';
  // Counts alone often match, so also name the campaigns that only one copy has.
  const remoteNames = Object.keys(remoteCampaigns), localNames = Object.keys(STORE.campaigns);
  const onlyIn = (a, b) => {
    const only = a.filter(x => b.indexOf(x) === -1);
    return only.length ? ' Only here: ' + only.join(', ') + '.' : '';
  };
  document.getElementById('dbxModalCompare').innerHTML =
    '<li><b>Dropbox</b> (saved ' + escapeAttr(dropboxFmtTime(c.remote.modified)) + '): ' +
      escapeAttr(dropboxSummarize(remoteCampaigns) + '.' + onlyIn(remoteNames, localNames)) + '</li>' +
    '<li><b>This tab</b>: ' + escapeAttr(dropboxSummarize(STORE.campaigns) + '.' + onlyIn(localNames, remoteNames)) + '</li>';
  document.getElementById('dbxUseRemote').classList.toggle('primary', c.mode === 'link');
  document.getElementById('dropboxModal').classList.add('open');
}
function closeDropboxModal(){
  const m = document.getElementById('dropboxModal');
  if(m) m.classList.remove('open');
}

function dropboxUseRemoteCopy(){
  const c = dbx.conflict;
  if(!c) return;
  try{ dropboxApplyRemote(c.text, c.remote); }
  catch(e){ alert(e.message); return; }
  dbx.conflict = null;
  closeDropboxModal();
  dropboxSetStatus('synced');
}

async function dropboxUseLocalCopy(){
  const c = dbx.conflict;
  if(!c) return;
  dbx.conflict = null;
  closeDropboxModal();
  // Make the next pass see "only this tab changed": it uploads over the file.
  dbxSync.fileId = c.remote.id;
  dbxSync.remoteHash = c.remote.hash;
  dbxSync.syncedHash = '';
  dropboxSaveSync();
  dropboxSetStatus('pending');
  await dropboxSyncNow();
}

/* ---- Render ---- */
const DBX_STATUS_VIEW = {
  off:          { label: 'Dropbox',      cls: '' },
  synced:       { label: 'Synced',       cls: 'is-ok' },
  pending:      { label: 'Saving…',      cls: '' },
  syncing:      { label: 'Syncing…',     cls: '' },
  'signed-out': { label: 'Reconnect',    cls: 'is-warn' },
  conflict:     { label: 'Resolve',      cls: 'is-warn' },
  error:        { label: 'Sync error',   cls: 'is-error' }
};

function dropboxStatusText(){
  const last = dbxSync.lastSync ? ' Last synced ' + dropboxFmtTime(dbxSync.lastSync) + '.' : '';
  switch(dbx.status){
    case 'synced': return 'Connected. Your campaigns are saved in your Dropbox app folder as “' + DBX_FILE_NAME + '”.' + last;
    case 'pending':
    case 'syncing': return 'Connected. Saving changes to Dropbox…';
    case 'signed-out': return 'Dropbox access was removed or expired. Your changes stay in this tab. Click Reconnect to sync them.' + last;
    case 'conflict': return 'The Dropbox copy and this tab both have changes. Click Resolve to choose which one to keep.';
    case 'error': return 'Sync failed: ' + dbx.message + last;
    default: return 'Off. Connect to save your campaigns in your Dropbox. They then survive closing the tab, and every browser where you connect shows the same campaigns.';
  }
}

// The panel markup is built once (wireDropbox), and this only updates it, so
// a half-typed code or app key is never wiped by a status change.
function renderDropbox(){
  const btn = document.getElementById('btnDropbox');
  if(btn){
    const v = DBX_STATUS_VIEW[dbxConfig.enabled ? dbx.status : 'off'] || DBX_STATUS_VIEW.off;
    btn.className = 'btn small dbx-status' + (v.cls ? ' ' + v.cls : '');
    btn.textContent = '☁ ' + v.label;
    btn.title = dropboxStatusText();
  }
  const hint = document.getElementById('dbxHint');
  if(!hint) return;
  if(dbx.auth) hint.textContent = 'Dropbox opened in a new tab. Click Allow there, then copy the code that Dropbox shows and paste it here. If no tab opened, click Open Dropbox.';
  else if(!dropboxAppKey() && !dbxConfig.enabled) hint.textContent = 'Set your Dropbox app key under Setup first.';
  else hint.textContent = dropboxStatusText();
  document.getElementById('dbxCodeRow').hidden = !dbx.auth;
  document.getElementById('dbxOpen').href = dbx.auth ? dbx.auth.url : '#';
  const connectBtn = document.getElementById('dbxConnect');
  connectBtn.hidden = !!dbx.auth || (dbxConfig.enabled && dbx.status !== 'signed-out');
  connectBtn.textContent = dbxConfig.enabled ? 'Reconnect' : 'Connect';
  connectBtn.disabled = !dropboxAppKey();
  document.getElementById('dbxResolve').hidden = dbx.status !== 'conflict';
  const syncBtn = document.getElementById('dbxSyncNow');
  syncBtn.hidden = !dbxConfig.enabled || dbx.status === 'signed-out' || dbx.status === 'conflict';
  syncBtn.disabled = dbx.status === 'syncing';
  document.getElementById('dbxDisconnect').hidden = !dbxConfig.enabled;
  const input = document.getElementById('dbxAppKey');
  if(input && document.activeElement !== input) input.value = dbxConfig.appKey || '';
  if(input) input.placeholder = DBX_DEFAULT_APP_KEY || 'a1b2c3d4e5f6g7h';
}

function renderDropboxPanelHtml(){
  return `
  <div class="dbx-inner" role="dialog" aria-labelledby="dbxPanelTitle">
    <button class="btn small dbx-close" id="dbxPanelClose" title="Close" aria-label="Close">&times;</button>
    <h3 class="block-title" id="dbxPanelTitle">Dropbox sync</h3>
    <p class="hint" id="dbxHint">&nbsp;</p>
    <div class="dbx-code-row" id="dbxCodeRow" hidden>
      <input type="text" id="dbxCode" placeholder="Paste the code from Dropbox" spellcheck="false" autocomplete="off">
      <button class="btn small primary" id="dbxFinish">Finish</button>
      <a class="btn small" id="dbxOpen" href="#" target="_blank" rel="noopener">Open Dropbox</a>
      <button class="btn small" id="dbxCancel">Cancel</button>
    </div>
    <div class="dbx-actions">
      <button class="btn small primary" id="dbxConnect">Connect</button>
      <button class="btn small" id="dbxResolve" hidden>Resolve</button>
      <button class="btn small" id="dbxSyncNow" hidden>Sync now</button>
      <button class="btn small danger" id="dbxDisconnect" hidden>Disconnect</button>
    </div>
    <details class="dbx-setup" id="dbxSetup">
      <summary>Setup: Dropbox app key</summary>
      <label class="dbx-key">
        <span>App key</span>
        <input type="text" id="dbxAppKey" spellcheck="false" autocomplete="off">
      </label>
      <ol class="hint dbx-steps">
        <li>In the <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener">Dropbox App Console</a>, click <b>Create app</b>. Choose <b>Scoped access</b> and <b>App folder</b>, and give the app a name.</li>
        <li>On the <b>Permissions</b> tab, tick <b>files.content.write</b> and <b>files.content.read</b>. Click <b>Submit</b>.</li>
        <li>On the <b>Settings</b> tab, keep <b>Allow public clients (Implicit Grant &amp; PKCE)</b> on <b>Allow</b>. You do not need a redirect URI.</li>
        <li>Copy the <b>App key</b> and paste it above. The app key is not a secret. Do not use the app secret.</li>
      </ol>
    </details>
  </div>`;
}

function renderDropboxModalHtml(){
  return `
  <div class="dbx-inner" role="dialog" aria-labelledby="dbxModalTitle">
    <h3 class="block-title" id="dbxModalTitle">Dropbox</h3>
    <p id="dbxModalText"></p>
    <ul class="dbx-compare" id="dbxModalCompare"></ul>
    <p class="hint">Dropbox keeps earlier versions of the file for at least 30 days (on dropbox.com, open the file's <b>&hellip;</b> menu &rarr; <b>Activity</b> &rarr; <b>Version history</b>). To keep a copy of a campaign in this tab first, click <b>Export</b>.</p>
    <div class="dbx-actions">
      <button class="btn small" id="dbxUseRemote">Use the Dropbox copy</button>
      <button class="btn small" id="dbxUseLocal">Keep this tab's copy</button>
      <button class="btn small" id="dbxExport">Export</button>
      <button class="btn small" id="dbxLater">Decide later</button>
    </div>
  </div>`;
}

function openDropboxPanel(){
  dbxPanelOpen = true;
  document.getElementById('dropboxOverlay').classList.add('open');
  renderDropbox();
}
function closeDropboxPanel(){
  dbxPanelOpen = false;
  document.getElementById('dropboxOverlay').classList.remove('open');
}

// Called from the DOMContentLoaded handler (20-init.js), after the first render.
function initDropbox(){
  renderDropbox();
  if(!dbxConfig.enabled) return;
  if(dropboxHasToken()) dropboxSyncNow();
  else dropboxSetStatus('signed-out');
}

function wireDropbox(){
  const overlay = document.getElementById('dropboxOverlay');
  const modal = document.getElementById('dropboxModal');
  overlay.innerHTML = renderDropboxPanelHtml();
  modal.innerHTML = renderDropboxModalHtml();
  const on = (id, type, fn) => document.getElementById(id).addEventListener(type, fn);
  on('btnDropbox', 'click', () => {
    // Reconnect needs the code row, which is in the panel.
    if(dbx.status === 'conflict') openDropboxModal();
    else{ openDropboxPanel(); if(dbxConfig.enabled && dbx.status === 'signed-out') dropboxConnect(); }
  });
  on('dbxPanelClose', 'click', closeDropboxPanel);
  overlay.addEventListener('click', e => { if(e.target === overlay) closeDropboxPanel(); });
  on('dbxConnect', 'click', () => dropboxConnect());
  on('dbxFinish', 'click', () => dropboxFinishConnect(document.getElementById('dbxCode').value));
  on('dbxCode', 'keydown', e => { if(e.key === 'Enter') dropboxFinishConnect(e.target.value); });
  on('dbxCancel', 'click', dropboxCancelConnect);
  on('dbxSyncNow', 'click', () => dropboxSyncNow());
  on('dbxResolve', 'click', openDropboxModal);
  on('dbxDisconnect', 'click', dropboxDisconnect);
  on('dbxAppKey', 'change', e => {
    dbxConfig.appKey = e.target.value.trim();
    dropboxSaveConfig();
    renderDropbox();
  });
  on('dbxUseRemote', 'click', dropboxUseRemoteCopy);
  on('dbxUseLocal', 'click', () => dropboxUseLocalCopy());
  on('dbxExport', 'click', () => document.getElementById('btnExportCampaign').click());
  on('dbxLater', 'click', closeDropboxModal);
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    closeDropboxModal();
    if(dbxPanelOpen) closeDropboxPanel();
  });
  // Another device may have changed the file: check when the tab comes back.
  // Going to the background flushes a pending upload instead of waiting.
  document.addEventListener('visibilitychange', () => {
    if(!dbxConfig.enabled || !dropboxHasToken()) return;
    if(document.visibilityState === 'hidden') dropboxFlush();
    else if(Date.now() - dbx.lastCheck > DBX_FOCUS_CHECK_MS) dropboxSyncNow();
  });
  window.addEventListener('online', () => { if(dbxConfig.enabled && dropboxHasToken()) dropboxSyncNow(); });
}

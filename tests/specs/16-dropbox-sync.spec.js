/* Dropbox sync (js/app/19-dropbox-sync.js). Ported from osr_keeper's
   test/dropbox.test.js. Two fakes replace the network:
     - window.open: records the Dropbox consent URL (the real one opens a tab
       where the user clicks Allow and copies a code);
     - fakeDropbox: window.fetch serving the OAuth token endpoint and the few
       Dropbox v2 calls the app makes, with an in-memory app folder, real revs,
       and real content_hash values.
   Nothing here talks to Dropbox. */

const DBX_TEST_APP_KEY = 'testappkey123';
const DBX_GOOD_CODE = 'code-ok';
const dbxSettle = async () => { for (let i = 0; i < 40; i++) await new Promise(r => setTimeout(r, 0)); };

async function dbxSha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}
const dbxHex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

// Dropbox's content_hash: SHA-256 of the concatenated SHA-256s of each 4 MB block.
async function dbxContentHash(s) {
  const buf = new TextEncoder().encode(s), parts = [];
  for (let i = 0; i < buf.length; i += 4 * 1024 * 1024) parts.push(await dbxSha256(buf.subarray(i, i + 4 * 1024 * 1024)));
  const all = new Uint8Array(parts.length * 32);
  parts.forEach((p, i) => all.set(p, i * 32));
  return dbxHex(await dbxSha256(all));
}

function fakeDropbox() {
  const fake = { files: new Map(), calls: [], nextId: 1, nextRev: 1, nextTok: 1, live: new Set(), refresh: new Set(), challenge: null, method: null };
  const res = (status, body) => ({
    ok: status >= 200 && status < 300, status,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
  });
  const err = summary => res(409, { error_summary: summary + '/..', error: {} });
  const meta = async f => ({ '.tag': 'file', id: f.id, name: f.name, path_lower: f.path.toLowerCase(), path_display: f.path,
    rev: f.rev, content_hash: await dbxContentHash(f.content), server_modified: f.modified, size: f.content.length });
  const bump = (f, content) => {
    f.content = content; f.rev = 'r' + fake.nextRev++; f.modified = new Date().toISOString(); f.revs[f.rev] = content;
  };
  fake.put = (content, path = '/' + DBX_FILE_NAME) => {
    const f = { id: 'id:f' + fake.nextId++, name: path.slice(1), path, revs: {} };
    bump(f, content);
    fake.files.set(f.id, f);
    return f.id;
  };
  fake.edit = (id, content) => bump(fake.files.get(id), content);
  fake.only = () => { expect(fake.files.size).toBe(1); return [...fake.files.values()][0]; };
  fake.writes = () => fake.calls.filter(c => c.startsWith('files/upload'));
  const byPath = p => p.startsWith('id:') ? fake.files.get(p)
    : [...fake.files.values()].find(f => f.path.toLowerCase() === p.toLowerCase());
  const issue = () => { const t = 'tok-' + fake.nextTok++; fake.live.add(t); return t; };
  const verifierOk = async v => fake.method === 'S256'
    ? dropboxBase64url(await dbxSha256(new TextEncoder().encode(v))) === fake.challenge
    : v === fake.challenge;

  window.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    if (u.pathname === '/oauth2/token') {
      const p = new URLSearchParams(opts.body);
      fake.calls.push('token ' + p.get('grant_type'));
      if (p.get('client_id') !== DBX_TEST_APP_KEY) throw new Error('fake Dropbox: wrong client_id');
      if (p.has('client_secret')) throw new Error('fake Dropbox: PKCE must not send an app secret');
      if (p.get('grant_type') === 'authorization_code') {
        if (p.get('code') !== DBX_GOOD_CODE || !(await verifierOk(p.get('code_verifier')))) return res(400, { error: 'invalid_grant', error_description: 'code doesn\'t exist or has expired' });
        const refresh = 'ref-' + fake.nextTok;
        fake.refresh.add(refresh);
        return res(200, { access_token: issue(), expires_in: 14400, token_type: 'bearer', refresh_token: refresh });
      }
      if (!fake.refresh.has(p.get('refresh_token'))) return res(400, { error: 'invalid_grant', error_description: 'refresh token is malformed' });
      return res(200, { access_token: issue(), expires_in: 14400, token_type: 'bearer' });
    }
    const endpoint = u.pathname.replace(/^\/2\//, '');
    const token = /^Bearer (.+)$/.exec(opts.headers.Authorization)[1];
    if (!fake.live.has(token)) { fake.calls.push(endpoint + ' 401'); return res(401, { error_summary: 'expired_access_token/' }); }
    const arg = JSON.parse(opts.headers['Dropbox-API-Arg'] || opts.body || '{}');
    fake.calls.push(endpoint + (arg.mode ? ' ' + (arg.mode['.tag'] || arg.mode) : ''));
    if (endpoint === 'auth/token/revoke') { fake.live.delete(token); return res(200, null); }
    if (endpoint === 'files/get_metadata') {
      const f = byPath(arg.path);
      return f ? res(200, await meta(f)) : err('path/not_found');
    }
    if (endpoint === 'files/download') {
      const rev = /^rev:(.+)$/.exec(arg.path)[1];
      const f = [...fake.files.values()].find(x => rev in x.revs);
      if (!f) return err('path/not_found');
      const content = f.revs[rev];
      if (fake.onDownload) fake.onDownload();
      return res(200, content);
    }
    if (endpoint === 'files/upload') {
      if (opts.headers['Content-Type'] !== 'application/octet-stream') throw new Error('fake Dropbox: upload must be octet-stream');
      if (fake.beforeUpload) { const hook = fake.beforeUpload; fake.beforeUpload = null; hook(); }
      const f = byPath(arg.path);
      if (arg.mode === 'add') {
        if (f) return err('path/conflict/file');
        const id = fake.put(opts.body, arg.path);
        return res(200, await meta(fake.files.get(id)));
      }
      if (!f) return err('path/not_found');
      if (f.rev !== arg.mode.update) return err('path/conflict/file');
      bump(f, opts.body);
      return res(200, await meta(f));
    }
    return res(500, { error_summary: 'fake Dropbox: unhandled ' + url });
  };
  return fake;
}

// A copy of this tab's campaigns as another device would have saved them,
// with one more campaign.
function dbxWithCampaign(name) {
  const campaigns = JSON.parse(JSON.stringify(STORE.campaigns));
  campaigns[name] = freshCampaign();
  return dropboxSyncText(campaigns);
}

// A local change: one log entry in the current campaign (persist() runs).
function dbxLocalEdit(text) { addLog('Test', text || 'a local change'); }

// What a fresh browser tab does: empty sessionStorage (STORE and the sync
// bookkeeping), same localStorage (Dropbox config and tokens), then init.
async function dbxNewTab() {
  clearTimeout(dbx.timer);
  sessionStorage.removeItem('mythicToolkit_v1');
  sessionStorage.removeItem(DBX_SYNC_KEY);
  STORE = loadStore();
  dbxConfig = dropboxLoadConfig();
  dbxSync = dropboxLoadSync();
  dbx = dropboxFreshRuntime();
  renderCampaignBar();
  renderActive();
  initDropbox();
  await dbxSettle();
}

describe('Dropbox sync', () => {
  let fake, opened, realFetch, realOpen;

  beforeEach(() => {
    resetApp();
    realFetch = window.fetch;
    realOpen = window.open;
    fake = fakeDropbox();
    opened = [];
    window.open = () => { const tab = { opener: window, location: { href: '' } }; opened.push(tab); return tab; };
    setValue('#dbxAppKey', DBX_TEST_APP_KEY);
  });
  afterEach(() => {
    clearTimeout(dbx.timer);
    window.fetch = realFetch;
    window.open = realOpen;
  });

  // Connect → the user clicks Allow on Dropbox → pastes the code → Finish.
  async function connect(code) {
    await dropboxConnect();
    const url = new URL(opened[opened.length - 1].location.href);
    fake.challenge = url.searchParams.get('code_challenge');
    fake.method = url.searchParams.get('code_challenge_method');
    await withDialogs({}, async () => {
      setValue('#dbxCode', code || DBX_GOOD_CODE);
      click('#dbxFinish');
      await dbxSettle();
    });
    return url;
  }

  it('dropboxDecideSync picks create / link / noop / upload / pull / conflict', () => {
    const s = { fileId: 'id:1', remoteHash: 'h1', syncedHash: 'L1' };
    expect(dropboxDecideSync(null, s, 'L1')).toBe('create');
    expect(dropboxDecideSync({ id: 'id:2', hash: 'h1' }, s, 'L1')).toBe('link');
    expect(dropboxDecideSync({ id: 'id:1', hash: 'h1' }, { fileId: 'id:1', remoteHash: '', syncedHash: '' }, 'L1')).toBe('link');
    expect(dropboxDecideSync({ id: 'id:1', hash: 'h1' }, s, 'L1')).toBe('noop');
    expect(dropboxDecideSync({ id: 'id:1', hash: 'h1' }, s, 'L2')).toBe('upload');
    expect(dropboxDecideSync({ id: 'id:1', hash: 'h2' }, s, 'L1')).toBe('pull');
    expect(dropboxDecideSync({ id: 'id:1', hash: 'h2' }, s, 'L2')).toBe('conflict');
  });

  it('dropboxPkcePair makes a valid S256 pair, and a plain pair without crypto.subtle', async () => {
    const plain = await dropboxPkcePair(null);
    expect(plain.method).toBe('plain');
    expect(plain.challenge).toBe(plain.verifier);
    expect(plain.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    const s256 = await dropboxPkcePair(crypto.subtle);
    expect(s256.method).toBe('S256');
    expect(s256.challenge).toBe(dropboxBase64url(await dbxSha256(new TextEncoder().encode(s256.verifier))));
  });

  it('is off by default: the button says Dropbox, and a save makes no network call', () => {
    expect($('#btnDropbox').textContent).toContain('Dropbox');
    dbxLocalEdit();
    expect(dbx.timer).toBeNull();
    expect(fake.calls).toHaveLength(0);
  });

  it('the campaign-bar button opens the panel; the close button and Escape close it', () => {
    click('#btnDropbox');
    expect($('#dropboxOverlay').classList.contains('open')).toBe(true);
    click('#dbxPanelClose');
    expect($('#dropboxOverlay').classList.contains('open')).toBe(false);
    click('#btnDropbox');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect($('#dropboxOverlay').classList.contains('open')).toBe(false);
  });

  it('no app key means Connect is disabled', () => {
    setValue('#dbxAppKey', '');
    expect($('#dbxConnect').disabled).toBe(true);
    expect($('#dbxHint')).toContain('app key');
  });

  it('Connect opens Dropbox, the pasted code creates the file, and a later save uploads it again', async () => {
    const url = await connect();
    expect(url.origin + url.pathname).toBe('https://www.dropbox.com/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe(DBX_TEST_APP_KEY);
    expect(url.searchParams.get('token_access_type')).toBe('offline');
    expect(opened[0].opener).toBeNull();
    expect(dbx.status).toBe('synced');
    expect($('#btnDropbox')).toContain('Synced');
    const f = fake.only();
    expect(f.path).toBe('/' + DBX_FILE_NAME);
    expect(f.content).toBe(dropboxSyncText());
    // Tokens live in their own localStorage key, never in the synced file or STORE.
    expect(!!JSON.parse(localStorage.getItem(DBX_TOKEN_KEY)).refresh).toBe(true);
    expect(f.content.indexOf('tok-')).toBe(-1);
    expect(JSON.stringify(STORE).indexOf('tok-')).toBe(-1);
    // The synced file has every campaign but not the per-tab selection.
    expect(Object.keys(JSON.parse(f.content))).toEqual(['mythicToolkitSync', 'campaigns']);

    dbxLocalEdit('the dragon wakes');
    expect(dbx.status).toBe('pending');
    expect(!!dbx.timer).toBe(true);
    await dropboxFlush();
    expect(fake.writes()).toEqual(['files/upload add', 'files/upload update']);
    expect(fake.only().content).toContain('the dragon wakes');
    expect(dbx.status).toBe('synced');
  });

  it('a wrong code is refused and sync stays off', async () => {
    let alerted = '';
    await dropboxConnect();
    const url = new URL(opened[0].location.href);
    fake.challenge = url.searchParams.get('code_challenge');
    fake.method = url.searchParams.get('code_challenge_method');
    const realAlert = window.alert;
    window.alert = m => { alerted = m; };
    try { await dropboxFinishConnect('wrong-code'); } finally { window.alert = realAlert; }
    expect(alerted).toContain('did not accept the code');
    expect(dbxConfig.enabled).toBe(false);
    expect(dropboxHasToken()).toBe(false);
    expect(fake.files.size).toBe(0);
  });

  it('an expired access token is refreshed without asking; a revoked refresh token asks to reconnect', async () => {
    await connect();
    const t = JSON.parse(localStorage.getItem(DBX_TOKEN_KEY));
    t.expiresAt = Date.now() - 1000;
    localStorage.setItem(DBX_TOKEN_KEY, JSON.stringify(t));
    dbxLocalEdit('after expiry');
    await dropboxFlush();
    expect(fake.calls).toContain('token refresh_token');
    expect(dbx.status).toBe('synced');
    expect(fake.only().content).toContain('after expiry');

    // The user removed the app from their Dropbox account.
    fake.live.clear();
    fake.refresh.clear();
    dbxLocalEdit('while signed out');
    await dropboxFlush();
    expect(dbx.status).toBe('signed-out');
    expect(dropboxHasToken()).toBe(false);
    expect($('#btnDropbox')).toContain('Reconnect');
    expect(fake.only().content.indexOf('while signed out')).toBe(-1);

    await connect();
    expect(dbx.status).toBe('synced');
    expect(fake.only().content).toContain('while signed out');
  });

  it('a change made on another device is pulled when this tab has no changes', async () => {
    await connect();
    const f = fake.only();
    fake.edit(f.id, dbxWithCampaign('From the laptop'));
    await dropboxSyncNow();
    expect(dbx.status).toBe('synced');
    expect(!!STORE.campaigns['From the laptop']).toBe(true);
    expect($$('#campaignSelect option').map(o => o.value)).toContain('From the laptop');
    expect(STORE.current).toBe('Campaign 1');
    expect(fake.writes()).toEqual(['files/upload add']);
  });

  it('an edit made while a pull downloads is not lost: the pull becomes a question', async () => {
    await connect();
    fake.edit(fake.only().id, dbxWithCampaign('Remote'));
    fake.onDownload = () => { fake.onDownload = null; dbxLocalEdit('typed during the download'); };
    await dropboxSyncNow();
    expect(dbx.status).toBe('conflict');
    expect($('#dropboxModal').classList.contains('open')).toBe(true);
    expect(logEntries().map(e => e.md)).toContain('typed during the download');
  });

  it('another device writing between the check and the upload is caught by the rev, not overwritten', async () => {
    await connect();
    const f = fake.only();
    dbxLocalEdit('local');
    fake.beforeUpload = () => fake.edit(f.id, dbxWithCampaign('Sneaky'));
    await dropboxFlush();
    // The refused upload schedules another pass, which sees both sides changed.
    expect(f.content).toContain('Sneaky');
    await dropboxFlush();
    expect(dbx.status).toBe('conflict');
    expect(fake.only().content).toContain('Sneaky');
  });

  it('both sides changed → the dialog asks; "Keep this tab\'s copy" overwrites Dropbox', async () => {
    await connect();
    fake.edit(fake.only().id, dbxWithCampaign('Remote only'));
    dbxLocalEdit('local only');
    await dropboxFlush();
    expect(dbx.status).toBe('conflict');
    expect($('#dbxModalTitle')).toContain('changed');
    expect($('#dbxModalCompare')).toContain('Only here: Remote only.');
    // While the dialog is open, saves do not sync.
    dbxLocalEdit('more');
    expect(dbx.timer).toBeNull();
    click('#dbxUseLocal');
    await dbxSettle();
    expect(dbx.status).toBe('synced');
    expect(fake.only().content).toContain('local only');
    expect(fake.only().content.indexOf('Remote only')).toBe(-1);
    expect($('#dropboxModal').classList.contains('open')).toBe(false);
  });

  it('"Use the Dropbox copy" replaces this tab\'s campaigns', async () => {
    await connect();
    fake.edit(fake.only().id, dbxWithCampaign('Remote only'));
    dbxLocalEdit('local only');
    await dropboxFlush();
    click('#dbxUseRemote');
    expect(dbx.status).toBe('synced');
    expect(!!STORE.campaigns['Remote only']).toBe(true);
    expect(logEntries().map(e => e.md).indexOf('local only')).toBe(-1);
    await dropboxSyncNow();
    expect(fake.writes()).toEqual(['files/upload add']);
  });

  it('a new tab with an untouched campaign loads the Dropbox copy without asking', async () => {
    await connect();
    dbxLocalEdit('saved last session');
    await dropboxFlush();
    await dbxNewTab();
    expect(dbx.status).toBe('synced');
    expect(logEntries().map(e => e.md)).toContain('saved last session');
    expect($('#dropboxModal').classList.contains('open')).toBe(false);
    expect(fake.writes()).toEqual(['files/upload add', 'files/upload update']);
  });

  it('a tab with its own changes that links to an existing Dropbox file is asked first, and nothing is uploaded', async () => {
    fake.put(dbxWithCampaign('Elsewhere'));
    dbxLocalEdit('this tab');
    await connect();
    expect(dbx.status).toBe('conflict');
    expect($('#dbxModalTitle')).toContain('found in Dropbox');
    expect($('#dbxUseRemote').classList.contains('primary')).toBe(true);
    expect(fake.writes()).toHaveLength(0);
  });

  it('a renamed file is still found by its id', async () => {
    await connect();
    const f = fake.only();
    f.path = '/Renamed.json';
    dbxLocalEdit('after rename');
    await dropboxFlush();
    expect(dbx.status).toBe('synced');
    expect(fake.only().path).toBe('/Renamed.json');
    expect(fake.only().content).toContain('after rename');
  });

  it('Disconnect revokes and forgets the tokens and the file link, keeps the app key, and leaves both copies', async () => {
    await connect();
    await withDialogs({ confirm: true }, async () => { click('#dbxDisconnect'); await dbxSettle(); });
    expect(fake.calls).toContain('auth/token/revoke');
    expect(dropboxHasToken()).toBe(false);
    expect(dbxConfig.enabled).toBe(false);
    expect(dbxConfig.appKey).toBe(DBX_TEST_APP_KEY);
    expect(dbxSync.fileId).toBe('');
    expect(dbx.status).toBe('off');
    expect(fake.files.size).toBe(1);
    expect(Object.keys(STORE.campaigns)).toEqual(['Campaign 1']);
    dbxLocalEdit();
    expect(dbx.timer).toBeNull();
  });

  it('a new tab with sync on but no tokens asks to reconnect', async () => {
    await connect();
    dropboxClearToken();
    await dbxNewTab();
    expect(dbx.status).toBe('signed-out');
    expect($('#btnDropbox')).toContain('Reconnect');
  });

  it('a pulled file goes through sanitizeCampaign(); a file with no campaigns is an error', async () => {
    await connect();
    const f = fake.only();
    fake.edit(f.id, JSON.stringify({ mythicToolkitSync: 1, campaigns: { 'Campaign 1': { gme: { chaosFactor: 99 } } } }));
    await dropboxSyncNow();
    expect(STORE.campaigns['Campaign 1'].gme.chaosFactor).toBe(9);       // clamped to 1-9
    expect(STORE.campaigns['Campaign 1'].location).toEqual(freshCampaign().location); // missing → default
    fake.edit(f.id, JSON.stringify({ mythicToolkitSync: 1, campaigns: {} }));
    await dropboxSyncNow();
    expect(dbx.status).toBe('error');
    expect($('#btnDropbox')).toContain('Sync error');
  });

  it('Import reads the Dropbox file and adds every campaign in it', async () => {
    const text = dropboxSyncText({ 'Campaign 1': freshCampaign(), 'Second': freshCampaign() });
    const input = $('#importFileInput');
    const file = new File([text], DBX_FILE_NAME, { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await withDialogs({}, async () => {
      input.dispatchEvent(new Event('change'));
      for (let i = 0; i < 50 && !STORE.campaigns['Second']; i++) await new Promise(r => setTimeout(r, 10));
    });
    expect(Object.keys(STORE.campaigns)).toEqual(['Campaign 1', 'Campaign 1 (imported)', 'Second']);
    expect(STORE.current).toBe('Campaign 1 (imported)');
  });
});

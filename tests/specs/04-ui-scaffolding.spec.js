/* Tab strip + campaign bar wiring (04-tab-render-scaffolding.js, 05-campaign-bar.js). */

describe('UI scaffolding', () => {

  beforeEach(resetApp);

  describe('tab nav', () => {
    it('renders one button per TABS entry, first tab (Mythic GME) active by default', () => {
      const btns = $$('#tabNav button');
      expect(btns).toHaveLength(TABS.length);
      expect(TABS[0].id).toBe('gme');
      expect(btns[0].dataset.tab).toBe('gme');
      expect(btns[0].classList.contains('active')).toBe(true);
      expect(btns.map(b => b.dataset.tab)).toEqual(TABS.map(t => t.id));
    });

    it('stacks each tab label one word per line', () => {
      for (const btn of $$('#tabNav button')) {
        const label = TABS.find(t => t.id === btn.dataset.tab).label;
        expect(btn.innerHTML).toBe(label.split(' ').join('<br>'));
        expect(btn.textContent).toBe(label.replace(/ /g, ''));   // no spaces once stacked
        if (label.includes(' ')) expect(btn.querySelector('br')).toBeTruthy();
      }
    });

    it('clicking a tab swaps #panelHost content and the active class', () => {
      click($$('#tabNav button').find(b => b.dataset.tab === 'mystery'));
      expect(currentTab).toBe('mystery');
      expect($('#panelHost')).toContain('One-Page Mystery Matrix');
      expect($$('#tabNav button').find(b => b.dataset.tab === 'mystery').classList.contains('active')).toBe(true);
      expect($$('#tabNav button').find(b => b.dataset.tab === 'gm').classList.contains('active')).toBe(false);
    });

    it('every tab renders without throwing and wires its buttons', () => {
      for (const t of TABS) {
        const host = showTab(t.id);
        expect(host.querySelector('.tool-title')).toBeTruthy();
      }
    });
  });

  describe('split view (right-click a tab)', () => {
    it('is unsplit by default', () => {
      expect(rightTab).toBeNull();
      expect($('#panelSplit').classList.contains('split')).toBe(false);
      expect($('#panelHostRight').innerHTML).toBe('');
    });

    it('right-clicking a tab pins it to the right pane without changing the main tab', () => {
      rightClickTab('mystery');
      expect(rightTab).toBe('mystery');
      expect(currentTab).toBe('gme');
      expect($('#panelSplit').classList.contains('split')).toBe(true);
      expect($('#panelHostRight')).toContain('One-Page Mystery Matrix');
      expect($('.split-right-title').textContent).toBe('Mystery Matrix');
      expect($$('#tabNav button').find(b => b.dataset.tab === 'mystery').classList.contains('split-right')).toBe(true);
    });

    it('right-clicking a different tab moves the split pane to that one', () => {
      rightClickTab('mystery');
      rightClickTab('playerEmu');
      expect(rightTab).toBe('playerEmu');
      expect($('#panelHostRight')).toContain('Player Emulator');
      expect($('#panelHostRight')).not.toContain('One-Page Mystery Matrix');
    });

    it('right-clicking the already-pinned tab again closes the split', () => {
      rightClickTab('mystery');
      rightClickTab('mystery');
      expect(rightTab).toBeNull();
      expect($('#panelSplit').classList.contains('split')).toBe(false);
      expect($('#panelHostRight').innerHTML).toBe('');
    });

    it('the close button on the right pane also closes the split', () => {
      rightClickTab('mystery');
      click('#btnCloseSplit');
      expect(rightTab).toBeNull();
      expect($('#panelSplit').classList.contains('split')).toBe(false);
    });

    it('a tab can never be both the main tab and the split tab at once', () => {
      rightClickTab('mystery');            // right = mystery, main = gme
      rightClickTab('gme');                // right-click the main tab itself
      expect(rightTab).toBe('gme');
      expect(currentTab).not.toBe('gme');  // bumped to make room
      expect(currentTab).not.toBe(rightTab);
    });

    it('left-clicking the pinned tab reclaims it into the main pane and closes the split', () => {
      rightClickTab('mystery');
      click($$('#tabNav button').find(b => b.dataset.tab === 'mystery'));
      expect(currentTab).toBe('mystery');
      expect(rightTab).toBeNull();
      expect($('#panelHost')).toContain('One-Page Mystery Matrix');
    });

    it('an action in the right pane updates that pane and leaves the left pane\'s own tab intact', () => {
      showTab('gm');
      rightClickTab('gme');   // main = gm (Game Master), right = gme (Mythic GME)
      click($('#panelHostRight').querySelector('#btnGmeCfMinus'));
      expect(campaign().gme.chaosFactor).toBe(4);
      expect($('#panelHostRight')).toContain('Mythic Game Master Emulator');
      expect($('#panelHost')).toContain('One-Page Game Master Emulator');   // left pane still shows Game Master
    });

    it('survives an unrelated global re-render (e.g. switching campaigns) without collapsing', async () => {
      rightClickTab('mystery');
      await withDialogs({ prompt: 'Split Test Campaign' }, () => click('#btnNewCampaign'));
      expect(rightTab).toBe('mystery');
      expect($('#panelSplit').classList.contains('split')).toBe(true);
    });
  });

  describe('tab intros (tabHeader())', () => {
    it('are collapsed by default; Intro shows them on every tab and is remembered', () => {
      expect($('#panelHost .tool-desc')).toBeNull();
      const btn = $('#panelHost [data-intro-toggle]');
      expect(btn.textContent).toBe('?');
      expect(btn.getAttribute('aria-expanded')).toBe('false');
      expect(btn.previousElementSibling.classList.contains('tool-title')).toBe(true);   // right after the title
      click('#panelHost [data-intro-toggle]');
      expect($('#panelHost .tool-desc')).toContain('full Mythic Scene loop');
      expect($('#panelHost [data-intro-toggle]').getAttribute('aria-expanded')).toBe('true');
      expect(localStorage.getItem(introKey())).toBe('1');
      showTab('location');
      expect($('#panelHost .tool-desc')).toContain('one Area at a time');   // shared state
      click('#panelHost [data-intro-toggle]');
      expect($('#panelHost .tool-desc')).toBeNull();
      expect(localStorage.getItem(introKey())).toBe('0');
    });

    it('the ? sits on the title line in every theme (header CSS is not theme-scoped)', () => {
      for (const t of UI_THEMES) {
        setTheme(t.id);
        const head = $('#panelHost .tool-head');
        expect(getComputedStyle(head).display).toBe('flex');
        const title = head.querySelector('.tool-title').getBoundingClientRect();
        const btn = head.querySelector('[data-intro-toggle]').getBoundingClientRect();
        expect(btn.left > title.right).toBe(true);    // to the right of the title
        expect(btn.top < title.bottom).toBe(true);     // on the same line
      }
      setTheme('classic');
    });

    it('the toggle works in the split-right pane too', () => {
      rightClickTab('gm');
      click('#panelHostRight [data-intro-toggle]');
      expect($('#panelHostRight .tool-desc')).toContain('Ask yes/no questions');
      expect($('#panelHost .tool-desc')).toBeTruthy();   // same setting for both panes
    });
  });

  describe('saved view (tabs + scroll across a reload)', () => {
    it('a tab change saves the main tab, the split tab and the scroll position', () => {
      click($$('#tabNav button').find(b => b.dataset.tab === 'mystery'));
      rightClickTab('gm');
      const v = JSON.parse(sessionStorage.getItem(VIEW_KEY));
      expect(v.currentTab).toBe('mystery');
      expect(v.rightTab).toBe('gm');
      expect(typeof v.scrollY).toBe('number');
    });

    it('closing the split saves rightTab as null', () => {
      rightClickTab('gm');
      rightClickTab('gm');
      expect(JSON.parse(sessionStorage.getItem(VIEW_KEY)).rightTab).toBe(null);
    });

    it('restoreViewTabs() brings the saved tabs back, as a reload does', () => {
      sessionStorage.setItem(VIEW_KEY, JSON.stringify({ currentTab: 'location', rightTab: 'creature', scrollY: 420 }));
      const v = restoreViewTabs();
      expect(currentTab).toBe('location');
      expect(rightTab).toBe('creature');
      expect(v.scrollY).toBe(420);
    });

    it('drops unknown tab ids, a split equal to the main tab, and junk', () => {
      sessionStorage.setItem(VIEW_KEY, JSON.stringify({ currentTab: 'nope', rightTab: 'gme', scrollY: -5 }));
      expect(loadView()).toEqual({ currentTab: 'gme', rightTab: null, scrollY: 0 });
      sessionStorage.setItem(VIEW_KEY, '{bad json');
      expect(loadView()).toBe(null);
      expect(restoreViewTabs()).toBe(null);
      expect(currentTab).toBe('gme');
    });
  });

  describe('settings modal (21-settings.js)', () => {
    it('the campaign bar has a Settings button, and no theme picker or Dropbox button of its own', () => {
      expect($('#btnSettings')).toBeTruthy();
      expect($('#campaignBar #themeSelect')).toBeNull();
      expect($('#btnDropbox')).toBeNull();
    });

    it('Settings opens with the Theme, Dropbox sync and Random tables sections', () => {
      expect($('#settingsOverlay').classList.contains('open')).toBe(false);
      click('#btnSettings');
      const o = $('#settingsOverlay');
      expect(o.classList.contains('open')).toBe(true);
      expect(o.querySelector('#themeSelect')).toBeTruthy();
      expect(o.querySelector('#dbxConnect')).toBeTruthy();
      expect($$('#settingsTables details[data-settings-table]').map(d => d.dataset.settingsTable)).toEqual(['eventFocus', 'inspiration']);
      expect($$('#settingsTables details').every(d => !d.open)).toBe(true);
      expect($('#settingsTables')).toContain(STORE.current);
    });

    it('closes with its close button, a backdrop click or Escape, but not a click inside', () => {
      click('#btnSettings');
      click('.settings-inner');
      expect($('#settingsOverlay').classList.contains('open')).toBe(true);
      click('#settingsClose');
      expect($('#settingsOverlay').classList.contains('open')).toBe(false);
      click('#btnSettings');
      click('#settingsOverlay');
      expect($('#settingsOverlay').classList.contains('open')).toBe(false);
      click('#btnSettings');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect($('#settingsOverlay').classList.contains('open')).toBe(false);
    });

    it('an expanded editor stays expanded after an edit and after a re-open', () => {
      click('#btnSettings');
      const d = $('#settingsTables details[data-settings-table="eventFocus"]');
      d.open = true;
      d.dispatchEvent(new Event('toggle'));
      click('#btnGmeFocusAdd');   // re-renders #settingsTables
      expect($('#settingsTables details[data-settings-table="eventFocus"]').open).toBe(true);
      expect($('#settingsTables')).toContain('customised');
      click('#settingsClose');
      click('#btnSettings');
      expect($('#settingsTables details[data-settings-table="eventFocus"]').open).toBe(true);
    });

    it('the editors follow a campaign switch while open', async () => {
      click('#btnSettings');
      settingsTablesOpen.inspiration = true;
      campaign().gm.inspiration.entries.push({ label: 'Only In First', weight: 1 });
      await withDialogs({ prompt: 'Settings Second' }, () => click('#btnNewCampaign'));
      expect($('#settingsTables')).toContain('Settings Second');
      expect($('#settingsTables')).not.toContain('Only In First');
    });
  });

  describe('campaign bar', () => {
    it('lists campaigns and marks the current one selected', () => {
      const sel = $('#campaignSelect');
      expect(sel.options).toHaveLength(Object.keys(STORE.campaigns).length);
      expect(sel.value).toBe(STORE.current);
    });

    it('New adds a campaign and switches to it', async () => {
      await withDialogs({ prompt: 'Second Campaign' }, () => click('#btnNewCampaign'));
      expect(STORE.campaigns['Second Campaign']).toBeDefined();
      expect(STORE.current).toBe('Second Campaign');
      expect($('#campaignSelect').value).toBe('Second Campaign');
    });

    it('New is a no-op when the name already exists', async () => {
      const before = Object.keys(STORE.campaigns).length;
      await withDialogs({ prompt: STORE.current }, () => click('#btnNewCampaign'));
      expect(Object.keys(STORE.campaigns)).toHaveLength(before);
    });

    it('Rename moves the campaign under a new key', async () => {
      const old = STORE.current;
      await withDialogs({ prompt: 'Renamed' }, () => click('#btnRenameCampaign'));
      expect(STORE.campaigns[old]).toBe(undefined);
      expect(STORE.campaigns['Renamed']).toBeDefined();
      expect(STORE.current).toBe('Renamed');
    });

    it('Delete refuses to remove the last campaign', async () => {
      await withDialogs({ confirm: true }, () => click('#btnDeleteCampaign'));
      expect(Object.keys(STORE.campaigns).length).toBeGreaterThanOrEqual(1);
    });

    it('Delete removes a campaign when more than one exists', async () => {
      await withDialogs({ prompt: 'Doomed' }, () => click('#btnNewCampaign'));
      expect(STORE.campaigns['Doomed']).toBeDefined();
      await withDialogs({ confirm: true }, () => click('#btnDeleteCampaign'));
      expect(STORE.campaigns['Doomed']).toBe(undefined);
    });

    it('switching the <select> changes the active campaign and re-renders', async () => {
      await withDialogs({ prompt: 'Other' }, () => click('#btnNewCampaign'));
      const first = $('#campaignSelect').options[0].value;
      setValue('#campaignSelect', first);
      expect(STORE.current).toBe(first);
    });
  });

  describe('import sanitiser via the bar', () => {
    it('sanitizeCampaign is applied to imported data (cross-type connection dropped)', () => {
      // Exercised directly: the bar's file handler feeds parsed.data straight
      // through sanitizeCampaign() before it ever reaches STORE.campaigns.
      const clean = sanitizeCampaign({
        mystery: { boxes: [
          { uid: 1, type: 'C', label: 'a', connections: [2] },
          { uid: 2, type: 'C', label: 'b', connections: [1] },
        ] },
      });
      expect(clean.mystery.boxes[0].connections).toEqual([]);
    });
  });

  describe('themes (20-themes.js)', () => {
    it('lists every UI_THEMES entry in #themeSelect, Case file by default', () => {
      const opts = $$('#themeSelect option').map(o => o.value);
      expect(opts).toEqual(UI_THEMES.map(t => t.id));
      expect($('#themeSelect').value).toBe('classic');
      expect(document.documentElement.dataset.theme).toBe(undefined);
    });

    it('choosing a theme sets <html data-theme> and remembers it in localStorage', () => {
      const sel = $('#themeSelect');
      sel.value = 'horror';
      sel.dispatchEvent(new Event('change'));
      expect(document.documentElement.dataset.theme).toBe('horror');
      expect(localStorage.getItem(THEME_KEY)).toBe('horror');
      expect(loadTheme()).toBe('horror');
      expect(getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()).toBe('#100e0e');
    });

    it('Case file removes the attribute; an unknown id falls back to it', () => {
      setTheme('sf');
      expect(document.documentElement.dataset.theme).toBe('sf');
      setTheme('neon');
      expect(document.documentElement.dataset.theme).toBe(undefined);
      expect($('#themeSelect').value).toBe('classic');
      localStorage.setItem(THEME_KEY, 'junk');
      expect(loadTheme()).toBe('classic');
    });

    it('a theme change keeps the current tab and its content', () => {
      click($$('#tabNav button').find(b => b.dataset.tab === 'mystery'));
      setTheme('fantasy');
      expect(currentTab).toBe('mystery');
      expect($('#panelHost')).toContain('One-Page Mystery Matrix');
    });
  });
});

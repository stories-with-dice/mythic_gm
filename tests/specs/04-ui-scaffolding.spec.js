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
});

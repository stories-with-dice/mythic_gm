/* Game Master tab UI (06-tab-game-master.js). */

describe('Game Master tab', () => {

  beforeEach(() => { resetApp(); showTab('gm'); });

  describe('Ask the Game Master', () => {
    it('renders roll, odds and answer, and appends a log entry', async () => {
      await withRolls([50], () => click('#btnAskGM'));   // 50 on 50/50 => Yes
      const box = $('#gmResult');
      expect(box).toContain('50');
      expect(box).toContain('50/50 or Unknown');
      expect(box).toContain('Yes');
      expect(lastLog().section).toBe('Ask the GM');
      expect(lastLog().md).toContain('**50**');
    });

    it('includes the typed question in the log', async () => {
      setValue('#gmQuestion', 'Does the guard notice me?');
      await withRolls([70], () => click('#btnAskGM'));
      expect(lastLog().md).toContain('Does the guard notice me?');
    });

    it('a double roll triggers a Random Event with two Discover-Meaning words', async () => {
      // 22 => double; then two d100 rolls for the event words
      await withRolls([22, 3, 5], () => click('#btnAskGM'));
      expect($('#gmResult')).toContain('Random Event triggered');
      expect($$('#gmResult .word-chip')).toHaveLength(2);
      expect(lastLog().md).toContain('Random Event triggered');
    });
  });

  describe('Discover Meaning', () => {
    it('Roll Action word adds a chip and logs it', async () => {
      await withRolls([1], () => click('#btnRollAction'));
      expect($('#discoverWords')).toContain(DISCOVER_ACTION[0]);
      expect(lastLog().section).toBe('Discover Meaning');
    });

    it('Roll both produces two words', async () => {
      await withRolls([1, 2], () => click('#btnRollBoth'));
      expect($$('#discoverWords .word-chip')).toHaveLength(2);
    });

    it('Clear empties the transient word list', async () => {
      await withRolls([1], () => click('#btnRollAction'));
      click('#btnClearWords');
      expect($('#discoverWords')).toContain('No words rolled yet');
    });
  });

  describe('Random Events', () => {
    it('Generate Random Event renders a word pair and logs it', async () => {
      await withRolls([10, 20], () => click('#btnRandomEvent'));
      expect($$('#eventResult .word-chip')).toHaveLength(2);
      expect(lastLog().section).toBe('Random Event');
    });
  });

  describe('Random Inspiration Source', () => {
    it('is disabled by default and hides the roll/edit controls', () => {
      expect(campaign().gm.inspiration.enabled).toBe(false);
      expect($('#btnRollInspiration')).toBeNull();
    });

    it('the checkbox enables the section and persists it', () => {
      click('#gmInspEnabled');
      expect(campaign().gm.inspiration.enabled).toBe(true);
      expect($('#btnRollInspiration')).toBeTruthy();
      expect(JSON.parse(sessionStorage.getItem('mythicToolkit_v1'))
        .campaigns[STORE.current].gm.inspiration.enabled).toBe(true);
    });

    it('defaults to the 5 documented entries, equally weighted', () => {
      expect(campaign().gm.inspiration.entries).toEqual([
        { label: 'Random Map', weight: 1 },
        { label: 'Random Sourcebook', weight: 1 },
        { label: 'Random book', weight: 1 },
        { label: 'Dream', weight: 1 },
        { label: 'Diary', weight: 1 }
      ]);
    });

    it('rolls a weighted pick and logs it', async () => {
      click('#gmInspEnabled');
      // total weight 5; roll 3 => 3rd entry ("Random book")
      await withRolls([3], () => click('#btnRollInspiration'));
      expect($('#inspirationResult')).toContain('Random book');
      expect(lastLog().section).toBe('Random Inspiration Source');
      expect(lastLog().md).toContain('**Random book**');
    });

    it('the last result survives an unrelated re-render of the tab (e.g. opening the editor)', async () => {
      click('#gmInspEnabled');
      await withRolls([1], () => click('#btnRollInspiration'));
      click('#btnGmInspEditToggle'); // triggers renderActive(); the result panel must not be wiped
      expect($('#inspirationResult')).toContain('Random Map');
    });

    it('Edit list toggles the weight/label table open, and heavier weights win more rolls', async () => {
      click('#gmInspEnabled');
      expect($$('[data-insp-label]')).toHaveLength(0);
      click('#btnGmInspEditToggle');
      expect($$('[data-insp-label]')).toHaveLength(5);
      setValue('[data-insp-weight="0"]', '10'); // "Random Map" now weight 10, total 14
      expect(campaign().gm.inspiration.entries[0].weight).toBe(10);
      await withRolls([9], () => click('#btnRollInspiration')); // within the boosted band
      expect($('#inspirationResult')).toContain('Random Map');
    });

    it('editing a label persists the trimmed value', () => {
      click('#gmInspEnabled');
      click('#btnGmInspEditToggle');
      setValue('[data-insp-label="1"]', '  Old Newspaper  ');
      expect(campaign().gm.inspiration.entries[1].label).toBe('Old Newspaper');
    });

    it('Add entry appends a new weight-1 row', () => {
      click('#gmInspEnabled');
      click('#btnGmInspEditToggle');
      click('#btnGmInspAdd');
      expect(campaign().gm.inspiration.entries.length).toBe(6);
      expect($$('[data-insp-label]')).toHaveLength(6);
    });

    it('Remove is disabled on the last remaining entry', () => {
      click('#gmInspEnabled');
      click('#btnGmInspEditToggle');
      for (let i = 0; i < 4; i++) click('[data-insp-rm="0"]');
      expect(campaign().gm.inspiration.entries.length).toBe(1);
      expect($('[data-insp-rm="0"]').disabled).toBe(true);
    });

    it('Reset to default restores the 5 default entries and logs it', async () => {
      click('#gmInspEnabled');
      click('#btnGmInspEditToggle');
      click('#btnGmInspAdd');
      await withDialogs({ confirm: true }, () => click('#btnGmInspReset'));
      expect(campaign().gm.inspiration.entries).toEqual(freshCampaign().gm.inspiration.entries);
      expect(lastLog().md).toContain('Random Inspiration Source');
    });
  });
});

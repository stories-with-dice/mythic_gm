/* Editable random tables (RANDOM_TABLES / tableList() / tableEntry() in
   01-data-tables.js, sanitizeTables() in 03, the editors in 21-settings.js),
   plus the Expected Scene field height. */

describe('editable random tables', () => {

  beforeEach(() => { resetApp(); });

  describe('tableEntry() / tableList()', () => {
    it('uses the defaults with the cheat-sheet mapping', () => {
      expect(tableList('meaningAction')).toBe(DISCOVER_ACTION);
      expect(tableEntry('meaningAction', 2)).toBe(DISCOVER_ACTION[0]);
      expect(tableEntry('locationDescriptors', 37)).toBe(LOCATION_DESCRIPTORS[36]);
      expect(tableEntry('creatureStatMod', 10)).toBe(STAT_MOD[10]);
      expect(tableEntry('creatureBehavior', 3)).toBe(INITIAL_BEHAVIOR[3]);
      expect(tableEntry('npcStatMod', 1)).toBe(NPC_STAT_MOD[1]);
    });
    it('keeps the NPC Behavior Context bands', () => {
      expect(behaviorContext(1)).toBe('Based on Identity Keywords');
      expect(behaviorContext(10)).toBe('Based on Identity Keywords');
      expect(behaviorContext(11)).toBe('Based on Mind Keywords');
      expect(behaviorContext(40)).toBe('Based on Talent Keywords');
      expect(behaviorContext(41)).toBe('Helps themself');
      expect(behaviorContext(45)).toBe('Helps themself');
      expect(behaviorContext(46)).toBe('Is helpful');
      expect(behaviorContext(96)).toBe('Tries to end the encounter');
      expect(behaviorContext(100)).toBe('Tries to end the encounter');
    });
    it('keeps every Plot Points row (17-100) and the fixed Conclusion / None rows', () => {
      for (let roll = 17; roll <= 100; roll++) {
        for (let t = 0; t < 5; t++) expect(plotPointWord(t, roll)).toBe(PLOT_ROWS[Math.floor((roll - 17) / 2)][t]);
      }
      campaign().tables = { plotAction: ['Only'] };
      expect(plotPointWord(0, 8)).toBe('Conclusion');
      expect(plotPointWord(0, 16)).toBe('None');
      expect(plotPointWord(0, 17)).toBe('Only');
      expect(plotPointWord(1, 17)).toBe(PLOT_ROWS[0][1]);
    });
    it('shares the die evenly over a custom list', () => {
      campaign().tables = { meaningAction: ['A', 'B', 'C', 'D'] };
      expect(discoverWord(1, 'action')).toBe('A');
      expect(discoverWord(25, 'action')).toBe('A');
      expect(discoverWord(26, 'action')).toBe('B');
      expect(discoverWord(100, 'action')).toBe('D');
      expect(discoverWord(1, 'desc')).toBe(DISCOVER_DESC[0]);
    });
    it('Scene Adjustments read the campaign copy on 1d6', async () => {
      campaign().tables = { sceneAdjustments: ['X', 'Y', 'Z'] };
      expect(sceneAdjustment(1)).toBe('X');
      expect(sceneAdjustment(6)).toBe('Z');
      await withRolls([1, 6], () => expect(sceneAdjustment(9)).toBe('Make 2 Adjustments — X + Z'));
    });
    it('ignores a broken copy in storage and strips < >', () => {
      campaign().tables = { mysteryDescriptors: 'junk', creatureAbilities: ['  ', '<b>Bold</b>'] };
      expect(tableEntry('mysteryDescriptors', 1)).toBe(MYSTERY_DESCRIPTORS[0]);
      expect(tableEntry('creatureAbilities', 50)).toBe('bBold/b');
    });
  });

  describe('sanitizeTables()', () => {
    it('keeps known, changed, clean lists only', () => {
      const t = sanitizeTables({
        meaningAction: [' Run ', '', 42, 'Hide'],
        meaningDesc: DISCOVER_DESC.slice(),
        unknownKey: ['A'],
        npcStatMod: []
      });
      expect(t).toEqual({ meaningAction: ['Run', 'Hide'] });
      expect(sanitizeTables(null)).toEqual({});
      expect(sanitizeTables(['x'])).toEqual({});
    });
    it('caps rows and row length', () => {
      const t = sanitizeTables({ meaningAction: Array.from({ length: 400 }, (_, i) => 'w' + i + 'x'.repeat(300)) });
      expect(t.meaningAction).toHaveLength(RANDOM_TABLE_MAX_ROWS);
      expect(t.meaningAction[0]).toHaveLength(RANDOM_TABLE_MAX_LEN);
    });
    it('sanitizeCampaign() carries the tables and freshCampaign() has none', () => {
      expect(freshCampaign().tables).toEqual({});
      expect(sanitizeCampaign({ tables: { mysteryDescriptors: ['Clue'] } }).tables).toEqual({ mysteryDescriptors: ['Clue'] });
    });
  });

  describe('Settings editors', () => {
    const editor = key => $(`#settingsTables textarea[data-rt-text="${key}"]`);

    it('show one editor per table, with the rows on separate lines', () => {
      click('#btnSettings');
      RANDOM_TABLES.forEach(t => expect(editor(t.key)).toBeTruthy());
      expect(editor('meaningAction').value.split('\n')).toEqual(DISCOVER_ACTION);
      expect($('#settingsTables')).toContain('Creature Crafter');
    });
    it('an edit saves to the campaign and changes the next roll on the tab', async () => {
      click('#btnSettings');
      setValue(editor('creatureDescriptors'), 'Glowing\n\n  Huge  \n');
      expect(campaign().tables.creatureDescriptors).toEqual(['Glowing', 'Huge']);
      expect(editor('creatureDescriptors').value).toBe('Glowing\nHuge');
      expect($('[data-rt-count="creatureDescriptors"]')).toContain('2 rows on 1d100');
      expect($('[data-rt-tag="creatureDescriptors"] .settings-tag')).toBeTruthy();
      showTab('creature');
      await withRolls([1, 100], () => click('#btnCreatureDescriptors'));
      expect($('#creatureDescResult')).toContain('Glowing');
      expect($('#creatureDescResult')).toContain('Huge');
    });
    it('an empty list or the default text drops the campaign copy', () => {
      click('#btnSettings');
      setValue(editor('npcStatMod'), 'A');
      expect(campaign().tables.npcStatMod).toEqual(['A']);
      setValue(editor('npcStatMod'), '   ');
      expect('npcStatMod' in campaign().tables).toBe(false);
      expect(editor('npcStatMod').value.split('\n')).toEqual(tableTenFaces(NPC_STAT_MOD));
      setValue(editor('npcStatMod'), tableTenFaces(NPC_STAT_MOD).join('\n'));
      expect('npcStatMod' in campaign().tables).toBe(false);
    });
    it('Reset to default restores the rows and logs it', async () => {
      click('#btnSettings');
      setValue(editor('mysteryDescriptors'), 'One\nTwo');
      await withDialogs({ confirm: true }, () => click('[data-rt-reset="mysteryDescriptors"]'));
      expect('mysteryDescriptors' in campaign().tables).toBe(false);
      expect(editor('mysteryDescriptors').value.split('\n')).toEqual(MYSTERY_DESCRIPTORS);
      expect(lastLog().md).toContain('Mystery Matrix: Descriptors');
    });
    it('each campaign keeps its own copy', () => {
      click('#btnSettings');
      setValue(editor('meaningDesc'), 'Only');
      STORE.campaigns['Other'] = newCampaign();
      STORE.current = 'Other';
      expect(discoverWord(1, 'desc')).toBe(DISCOVER_DESC[0]);
      STORE.current = 'Campaign 1';
      expect(discoverWord(1, 'desc')).toBe('Only');
    });
  });
});

describe('Expected Scene fields', () => {
  beforeEach(() => { resetApp(); });
  it('are 8 lines tall on every tab that has one', () => {
    [['gme', '#gmeExpectedScene'], ['pub', '#pubExpectedScene'], ['nodes', '#nodeExpectedScene']].forEach(([tab, sel]) => {
      showTab(tab);
      expect($(sel).rows).toBe(8);
    });
  });
});

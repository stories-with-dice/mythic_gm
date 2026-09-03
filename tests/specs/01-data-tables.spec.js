/* Pure data-table transcription functions (01-data-tables.js). These touch no
   DOM and no state — spot-check the same roll→result pairs the cheat sheet
   defines, plus the boundary rows. */

describe('data tables', () => {

  describe('discoverWord()', () => {
    it('maps paired rows: ceil(roll/2)-1 into the 50-entry columns', () => {
      expect(discoverWord(1, 'action')).toBe(DISCOVER_ACTION[0]);
      expect(discoverWord(2, 'action')).toBe(DISCOVER_ACTION[0]);
      expect(discoverWord(3, 'action')).toBe(DISCOVER_ACTION[1]);
      expect(discoverWord(100, 'action')).toBe(DISCOVER_ACTION[49]);
      expect(discoverWord(99, 'desc')).toBe(DISCOVER_DESC[49]);
    });
    it('has 50 entries per column', () => {
      expect(DISCOVER_ACTION).toHaveLength(50);
      expect(DISCOVER_DESC).toHaveLength(50);
    });
  });

  describe('askTheGM()', () => {
    it('50/50 thresholds are 10 / 50 / 90', () => {
      expect(askTheGM('50/50 or Unknown', 10).answer).toBe('Exceptional Yes');
      expect(askTheGM('50/50 or Unknown', 11).answer).toBe('Yes');
      expect(askTheGM('50/50 or Unknown', 50).answer).toBe('Yes');
      expect(askTheGM('50/50 or Unknown', 51).answer).toBe('No');
      expect(askTheGM('50/50 or Unknown', 90).answer).toBe('No');
      expect(askTheGM('50/50 or Unknown', 91).answer).toBe('Exceptional No');
    });
    it('flags doubles 11..99 (and only those)', () => {
      expect(askTheGM('Likely', 22).isDouble).toBe(true);
      expect(askTheGM('Likely', 99).isDouble).toBe(true);
      expect(askTheGM('Likely', 23).isDouble).toBe(false);
      expect(askTheGM('Likely', 100).isDouble).toBe(false);
    });
  });

  describe('themeFromD10() / plotPointWord()', () => {
    it('bins 1d10 into the five themes two rolls each', () => {
      expect(themeFromD10(1)).toBe('Action');
      expect(themeFromD10(2)).toBe('Action');
      expect(themeFromD10(3)).toBe('Tension');
      expect(themeFromD10(9)).toBe('Personal');
      expect(themeFromD10(10)).toBe('Personal');
    });
    it('rolls 1-8 => Conclusion, 9-16 => None, then paired rows', () => {
      expect(plotPointWord(0, 1)).toBe('Conclusion');
      expect(plotPointWord(0, 8)).toBe('Conclusion');
      expect(plotPointWord(0, 9)).toBe('None');
      expect(plotPointWord(0, 16)).toBe('None');
      expect(plotPointWord(0, 17)).toBe(PLOT_ROWS[0][0]);
      expect(plotPointWord(4, 100)).toBe(PLOT_ROWS[41][4]);
    });
  });

  describe('areaElement()', () => {
    it('returns the expected element + descriptor-type by 1d10+PP total', () => {
      expect(areaElement(1)).toEqual({ el: 'Expected' });
      expect(areaElement(-3)).toEqual({ el: 'Expected' });
      expect(areaElement(2)).toEqual({ el: 'Location Descriptor', d: 'location' });
      expect(areaElement(6)).toEqual({ el: 'Expected, Return' });
    });
  });

  describe('pickDie()', () => {
    it('picks the smallest standard die >= n, capped at d20', () => {
      expect(pickDie(1)).toBe(4);
      expect(pickDie(4)).toBe(4);
      expect(pickDie(5)).toBe(6);
      expect(pickDie(9)).toBe(10);
      expect(pickDie(13)).toBe(20);
      expect(pickDie(99)).toBe(20);
    });
  });

  describe('mysteryElement()', () => {
    it('maps 1d100+boxCount totals to results', () => {
      expect(mysteryElement(15)).toBe('nothing');
      expect(mysteryElement(16)).toBe('newClue');
      expect(mysteryElement(35)).toBe('newClue');
      expect(mysteryElement(36)).toBe('newSuspect');
      expect(mysteryElement(51)).toBe('newConnectedClue');
      expect(mysteryElement(71)).toBe('newConnectedSuspect');
      expect(mysteryElement(81)).toBe('connectExisting');
      expect(mysteryElement(101)).toBe('clincher');
    });
  });

  describe('behavioural word helpers', () => {
    it('abilityWord halves the roll into the 50-word list', () => {
      expect(abilityWord(1)).toBe(ABILITY_WORDS[0]);
      expect(abilityWord(100)).toBe(ABILITY_WORDS[49]);
    });
    it('STAT_MOD / NPC_STAT_MOD cover all 10 faces', () => {
      for (let i = 1; i <= 10; i++) {
        expect(typeof STAT_MOD[i]).toBe('string');
        expect(typeof NPC_STAT_MOD[i]).toBe('string');
      }
    });
  });
});

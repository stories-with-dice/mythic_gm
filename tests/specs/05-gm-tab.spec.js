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
});

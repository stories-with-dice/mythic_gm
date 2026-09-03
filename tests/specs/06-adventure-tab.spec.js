/* Adventure Crafter tab UI (07-tab-adventure-crafter.js). */

describe('Adventure Crafter tab', () => {

  beforeEach(() => { resetApp(); showTab('adventure'); });

  describe('Main Theme', () => {
    it('Roll 1d10 for Theme sets the campaign main theme and logs it', async () => {
      await withRolls([3], () => click('#btnRollTheme'));   // 3 => Tension
      expect(campaign().adventure.mainTheme).toBe('Tension');
      expect($('#panelHost')).toContain('Tension');
      expect(lastLog().section).toBe('Adventure Crafter');
    });

    it('Set applies the manually chosen theme', () => {
      setValue('#manualTheme', 'Social');
      click('#btnSetTheme');
      expect(campaign().adventure.mainTheme).toBe('Social');
    });
  });

  describe('Turning Point', () => {
    it('is disabled until a Main Theme exists', () => {
      expect($('#btnTurningPoint').disabled).toBe(true);
    });

    it('generates five Plot Points, the first using the Main Theme', async () => {
      setValue('#manualTheme', 'Action');
      click('#btnSetTheme');
      // 8 rolls: 4 pairs of (d10 theme, d100 word) for PP2-5, plus PP1's single d100
      await withRolls([50], () => click('#btnTurningPoint'));
      expect($$('#turningPointResult .plotpoint')).toHaveLength(5);
      expect($('#turningPointResult')).toContain('Plot Point 1 — Action');
      expect(lastLog().md).toContain('PP1');
      expect(lastLog().md).toContain('PP5');
    });
  });

  describe('Single Plot Point', () => {
    it('rolls its own theme when none is chosen', async () => {
      await withRolls([5, 40], () => click('#btnSinglePlot'));  // d10=5 => Tension, d100=40
      expect($('#singlePlotResult .plotpoint')).toBeTruthy();
      expect(lastLog().section).toBe('Adventure Crafter');
      expect(lastLog().md).toContain('Plot Point');
    });

    it('uses the chosen theme directly (no d10)', async () => {
      setValue('#singleTheme', 'Personal');
      await withRolls([40], () => click('#btnSinglePlot'));
      expect($('#singlePlotResult')).toContain('Personal');
    });
  });
});

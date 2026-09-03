/* Published Adventures tab — "Deconstruct The Known" (15-tab-published-adventures.js)
   plus its gme.deconstructed state model / sanitiser. */

describe('Published Adventures tab', () => {

  beforeEach(() => { resetApp(); showTab('pub'); });

  const dec = () => campaign().gme.deconstructed;

  describe('placement + render', () => {
    it('is the 2nd tab, after Mythic GME', () => {
      expect(TABS[1].id).toBe('pub');
    });
    it('renders without throwing', () => {
      const host = showTab('pub');
      expect(host.querySelector('.tool-title')).toBeTruthy();
      expect(host).toContain('Deconstruct The Known');
    });
  });

  describe('"How it works" flowchart', () => {
    it('is collapsed by default and toggles open/closed', () => {
      expect($('#btnPubFlowToggle').textContent).toBe('Show');
      expect(document.querySelector('.pub-flow')).toBeNull();
      click('#btnPubFlowToggle');
      expect($('#btnPubFlowToggle').textContent).toBe('Hide');
      const flow = document.querySelector('.pub-flow');
      expect(flow).toBeTruthy();
      expect(flow).toContain('Test vs Chaos Factor');
      expect(flow).toContain('Crisis Scene');
      expect(flow).toContain('Adventure Die');
      expect($$('.pub-flow .flow-branch li')).toHaveLength(4);
      click('#btnPubFlowToggle');
      expect(document.querySelector('.pub-flow')).toBeNull();
    });
  });

  describe('adventureDieOptions()', () => {
    it('maps page count to the Adventure Die band', () => {
      expect(adventureDieOptions(10)).toEqual(['d4']);
      expect(adventureDieOptions(16)).toEqual(['d4']);
      expect(adventureDieOptions(17)).toEqual(['d6']);
      expect(adventureDieOptions(64)).toEqual(['d20']);
      expect(adventureDieOptions(120)).toEqual(['2d20', 'd100']);
      expect(adventureDieOptions(256)).toEqual(['4d20', 'd100']);
      expect(adventureDieOptions(999)).toEqual(['d100']);
      expect(adventureDieOptions(0)).toEqual(ADVENTURE_DICE);
    });
  });

  describe('rollAdventureDie()', () => {
    it('rolls single and multi-d20 specs, sums multiples', async () => {
      await withRolls([3], () => expect(rollAdventureDie('d10')).toBe(3));
      await withRolls([5, 7], () => expect(rollAdventureDie('2d20')).toBe(12));
      await withRolls([9, 9, 9], () => expect(rollAdventureDie('3d20')).toBe(27));
      await withRolls([42], () => expect(rollAdventureDie('bogus')).toBe(42)); // falls back to d100
    });
  });

  describe('crisisElement() — Crisis Scene Element Table', () => {
    it('maps 1d10 + Crisis PP totals', () => {
      expect(crisisElement(1).key).toBe('element');
      expect(crisisElement(9).key).toBe('element');
      expect(crisisElement(10).key).toBe('list');
      expect(crisisElement(11).key).toBe('list');
      expect(crisisElement(12).key).toBe('element');
      expect(crisisElement(13).key).toBe('special');
      expect(crisisElement(14).key).toBe('listPP');
      expect(crisisElement(15).key).toBe('conclusion');
      expect(crisisElement(16).key).toBe('elementMinus6');
      expect(crisisElement(40).key).toBe('elementMinus6');
    });
  });

  describe('specialElement() — Special Elements Table', () => {
    it('maps 1d100 rolls to a label and Crisis PP delta', () => {
      expect(specialElement(1).label).toBe('WATCH OUT!');
      expect(specialElement(20).label).toBe('WATCH OUT!');
      expect(specialElement(21).label).toBe('THIS IS BAD');
      expect(specialElement(46).label).toBe('THIS IS GOOD');
      expect(specialElement(71).label).toBe('MOVING ALONG');
      expect(specialElement(80).pp).toBe(3);
      expect(specialElement(81).label).toBe('ROLLING BACK');
      expect(specialElement(85).pp).toBe(-2);
      expect(specialElement(86).label).toBe('ADVENTURE ELEMENT');
      expect(specialElement(100).pp).toBe(1);
    });
  });

  describe('The Prepared Adventure panel', () => {
    it('persists title / first-scene concept', () => {
      setValue('#pubTitle', 'The Sword Of Cacinth Castle');
      setValue('#pubFirstScene', 'Working for the great dwarf artificer.');
      expect(dec().title).toBe('The Sword Of Cacinth Castle');
      expect(dec().firstSceneConcept).toBe('Working for the great dwarf artificer.');
    });
    it('setting the page count snaps the Adventure Die to a valid option', () => {
      expect(dec().adventureDie).toBe('d20');
      setValue('#pubPageCount', '10');            // 10 pages -> only d4
      expect(dec().pageCount).toBe(10);
      expect(dec().adventureDie).toBe('d4');
      expect($('#pubAdvDie').value).toBe('d4');
    });
  });

  describe('Rolling an Adventure Element', () => {
    it('advances the running page counter and records history + section', async () => {
      await withRolls([13, 4], () => click('#btnPubRollElement'));   // d20=13, page 0+13=13; d6=4
      expect(dec().latestPage).toBe(13);
      expect(dec().pageHistory).toEqual([13]);
      expect($('#pubElementResult')).toContain('page 13');
      expect($('#pubElementResult')).toContain('middle right');
      expect(lastLog().md).toContain('Adventure Element');
    });
    it('adds the Adventure Die result to the counter each time', async () => {
      await withRolls([13, 1], () => click('#btnPubRollElement'));
      await withRolls([20, 1], () => click('#btnPubRollElement'));   // 13 + 20 = 33
      expect(dec().latestPage).toBe(33);
      expect(dec().pageHistory).toEqual([13, 33]);
    });
    it('wraps around at the end of the book', async () => {
      dec().pageCount = 20; dec().latestPage = 15; persist(); showTab('pub');
      await withRolls([12, 2], () => click('#btnPubRollElement'));   // 15 + 12 = 27 -> 27 - 20 = 7
      expect(dec().latestPage).toBe(7);
      expect($('#pubElementResult')).toContain('wrapped');
    });
    it('Reset page tracker clears the counter and history', async () => {
      await withRolls([13, 1], () => click('#btnPubRollElement'));
      await withDialogs({ confirm: true }, () => click('#btnPubResetPages'));
      expect(dec().latestPage).toBe(0);
      expect(dec().pageHistory).toEqual([]);
    });
  });

  describe('Deconstructed scene test', () => {
    beforeEach(() => { campaign().gme.chaosFactor = 5; persist(); showTab('pub'); });

    it('roll over CF and odd => Expected Scene, no Adventure Element', async () => {
      await withRolls([9], () => click('#btnPubTestScene'));
      expect($('#pubSceneTestResult')).toContain('Expected Scene');
      expect(dec().latestPage).toBe(0);
      expect(lastLog().md).toContain('→ **Expected Scene**');
    });

    it('roll over CF and even => Crisis Scene, generated inline (crisis PP advances)', async () => {
      // 8 => Crisis; crisis 1d10=2 (+0 PP) => "Adventure Element"; d20=40->20 (page); d6=3
      await withRolls([8, 2, 40, 3], () => click('#btnPubTestScene'));
      expect($('#pubSceneTestResult')).toContain('Crisis Scene');
      expect($('#pubSceneTestResult')).toContain('Adventure Element');
      expect(dec().crisisPP).toBe(1);
      expect(dec().latestPage).toBe(20);
      expect($('#pubCrisisResult')).toContain('Crisis Scene');   // mirrored into the Crisis card
    });

    it('roll within CF and odd => Altered Scene + Adventure Element', async () => {
      await withRolls([3, 15, 4], () => click('#btnPubTestScene'));
      expect($('#pubSceneTestResult')).toContain('Altered Scene');
      expect($('#pubSceneTestResult')).toContain('Adventure Element');
      expect(dec().latestPage).toBe(15);
    });

    it('roll within CF and even => Interrupt Scene + Event Focus + Adventure Element', async () => {
      // 4 => Interrupt; focus 1d100=30 => "NPC Action"; d20=12 (page); d6=2
      await withRolls([4, 30, 12, 2], () => click('#btnPubTestScene'));
      const box = $('#pubSceneTestResult');
      expect(box).toContain('Interrupt Scene');
      expect(box).toContain('Event Focus');
      expect(box).toContain('NPC Action');
      expect(box).toContain('Adventure Element');
      expect(dec().latestPage).toBe(12);
    });
  });

  describe('shared Chaos Factor / scene clock', () => {
    it('CF +/- here changes the shared gme.chaosFactor', () => {
      expect(campaign().gme.chaosFactor).toBe(5);
      click('#btnPubCfPlus');
      expect(campaign().gme.chaosFactor).toBe(6);
      showTab('gme');
      expect($('#panelHost').textContent).toContain('Chaos Factor');
      expect(campaign().gme.chaosFactor).toBe(6);   // Mythic GME tab sees the same value
    });
    it('End Scene adjusts the shared CF, advances the scene, clears the Expected Scene', () => {
      const g = campaign().gme;
      g.chaosFactor = 5; g.sceneNumber = 3; g.expectedScene = 'x'; persist(); showTab('pub');
      setValue('#pubControl', 'in');
      click('#btnPubEndScene');
      expect(campaign().gme.chaosFactor).toBe(4);
      expect(campaign().gme.sceneNumber).toBe(4);
      expect(campaign().gme.expectedScene).toBe('');
    });
  });

  describe('Adventure Meaning List', () => {
    it('adds words (capped at 20) and logs', () => {
      setValue('#pubMeaningInput', 'Mine');
      click('#btnPubAddMeaning');
      expect(dec().meaningList).toEqual(['Mine']);
      expect(lastLog().md).toContain('Meaning List');
      for (let i = 0; i < 25; i++) { setValue('#pubMeaningInput', 'w' + i); click('#btnPubAddMeaning'); }
      expect(dec().meaningList).toHaveLength(20);
      expect($('#pubMeaningInput').disabled).toBe(true);
      expect($('#btnPubAddMeaning').disabled).toBe(true);
    });
    it('removes a word by index', () => {
      ['A', 'B', 'C'].forEach(w => { setValue('#pubMeaningInput', w); click('#btnPubAddMeaning'); });
      click('[data-mn-rm="1"]');
      expect(dec().meaningList).toEqual(['A', 'C']);
    });
    it('Roll 1d10 picks a slot; a blank slot is called out', async () => {
      ['Mine', 'Workshop', 'Hidden'].forEach(w => { setValue('#pubMeaningInput', w); click('#btnPubAddMeaning'); });
      await withRolls([2], () => click('#btnPubRollMeaning'));
      expect($('#pubMeaningRollResult')).toContain('Workshop');
      await withRolls([7], () => click('#btnPubRollMeaning'));
      expect($('#pubMeaningRollResult')).toContain('blank slot');
    });
  });

  describe('Crisis Scenes', () => {
    it('the Generate button rolls the element table and applies the +1 Crisis PP', async () => {
      dec().crisisPP = 3; persist(); showTab('pub');
      // 1d10=9 (+3 PP = 12) => "Adventure Element"; d20=40->20; d6=3
      await withRolls([9, 40, 3], () => click('#btnPubCrisis'));
      expect($('#pubCrisisResult')).toContain('Crisis Scene Element');
      expect($('#pubCrisisResult')).toContain('Adventure Element');
      expect(dec().crisisPP).toBe(4);
      expect(dec().latestPage).toBe(20);
    });
    it('a Special result applies its own Crisis PP delta (ROLLING BACK = −2)', async () => {
      dec().crisisPP = 3; persist(); showTab('pub');
      // 1d10=10 (+3 = 13) => "Special"; 1d100=82 => ROLLING BACK (-2); then an Adventure Element (d20=5, d6=1)
      await withRolls([10, 82, 5, 1], () => click('#btnPubCrisis'));
      expect($('#pubCrisisResult')).toContain('ROLLING BACK');
      expect(dec().crisisPP).toBe(1);
    });
    it('manual Crisis PP −1 floors at 0', () => {
      dec().crisisPP = 0; persist(); showTab('pub');
      click('#btnPubCppMinus');
      expect(dec().crisisPP).toBe(0);
      click('#btnPubCppPlus'); click('#btnPubCppPlus');
      expect(dec().crisisPP).toBe(2);
    });
  });

  describe('Diminisher Value', () => {
    it('stores the choice and its divide helper scales a value', () => {
      setValue('#pubDiminisher', '1/5');
      expect(dec().diminisher).toBe('1/5');
      setValue('#pubScaleValue', '200');
      expect($('#pubScaleResult').textContent).toBe('40');
      setValue('#pubDiminisher', '1/10');
      setValue('#pubScaleValue', '95');
      expect($('#pubScaleResult').textContent).toBe('10');   // round(95/10)
    });
  });

  describe('sanitizeCampaign() — gme.deconstructed', () => {
    it('a fresh campaign has the default deconstructed state', () => {
      expect(freshCampaign().gme.deconstructed).toEqual({
        title: '', pageCount: 0, adventureDie: 'd20', latestPage: 0, pageHistory: [],
        firstSceneConcept: '', meaningList: [], crisisPP: 0, diminisher: '1/3'
      });
    });
    it('repairs junk: bad die -> d20, negatives -> 0, bad diminisher -> 1/3, list capped, pages filtered', () => {
      const c = sanitizeCampaign({ gme: { deconstructed: {
        adventureDie: 'd7', pageCount: -5, latestPage: -3, crisisPP: -9, diminisher: '1/4',
        pageHistory: [10, 'x', -2, 20.6],
        meaningList: Array.from({ length: 30 }, (_, i) => 'w' + i).concat(['', 5]),
      } } });
      const d = c.gme.deconstructed;
      expect(d.adventureDie).toBe('d20');
      expect(d.pageCount).toBe(0);
      expect(d.latestPage).toBe(0);
      expect(d.crisisPP).toBe(0);
      expect(d.diminisher).toBe('1/3');
      expect(d.pageHistory).toEqual([10, 21]);
      expect(d.meaningList).toHaveLength(20);
    });
    it('keeps valid deconstructed data', () => {
      const c = sanitizeCampaign({ gme: { deconstructed: {
        title: 'X', pageCount: 256, adventureDie: 'd100', latestPage: 187,
        pageHistory: [61, 88, 187], meaningList: ['Mine', 'Workshop'], crisisPP: 3, diminisher: '1/10',
      } } });
      expect(c.gme.deconstructed).toEqual({
        title: 'X', pageCount: 256, adventureDie: 'd100', latestPage: 187, pageHistory: [61, 88, 187],
        firstSceneConcept: '', meaningList: ['Mine', 'Workshop'], crisisPP: 3, diminisher: '1/10'
      });
    });
  });
});

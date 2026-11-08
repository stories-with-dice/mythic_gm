/* Mythic GME tab (14-tab-mythic-gme.js) + its gme state model / sanitiser. */

describe('Mythic GME tab', () => {

  beforeEach(() => { resetApp(); showTab('gme'); });

  describe('discoveryCheckResult() — Thread Discovery Check Table', () => {
    it('maps 1d10 + Progress totals per the 2e table', () => {
      expect(discoveryCheckResult(1).label).toBe('Progress +2');
      expect(discoveryCheckResult(9).label).toBe('Progress +2');
      expect(discoveryCheckResult(10)).toEqual({ label: 'Flashpoint +2', kind: 'flashpoint', delta: 2 });
      expect(discoveryCheckResult(11).label).toBe('Track +1');
      expect(discoveryCheckResult(14).label).toBe('Track +1');
      expect(discoveryCheckResult(15).label).toBe('Progress +3');
      expect(discoveryCheckResult(17).label).toBe('Progress +3');
      expect(discoveryCheckResult(18).label).toBe('Flashpoint +3');
      expect(discoveryCheckResult(19).label).toBe('Track +2');
      expect(discoveryCheckResult(20).label).toBe('Strengthen Progress +1');
      expect(discoveryCheckResult(24).label).toBe('Strengthen Progress +1');
      expect(discoveryCheckResult(25).label).toBe('Strengthen Progress +2');
      expect(discoveryCheckResult(99).label).toBe('Strengthen Progress +2');
    });
  });

  describe('sceneAdjustment() — Scene Adjustment Table', () => {
    it('maps 1d10 rolls 1-6 to a single adjustment', () => {
      expect(sceneAdjustment(1)).toBe('Remove A Character');
      expect(sceneAdjustment(2)).toBe('Add A Character');
      expect(sceneAdjustment(3)).toBe('Reduce/Remove An Activity');
      expect(sceneAdjustment(4)).toBe('Increase An Activity');
      expect(sceneAdjustment(5)).toBe('Remove An Object');
      expect(sceneAdjustment(6)).toBe('Add An Object');
    });
    it('rolls 7-10 make two (distinct) adjustments', async () => {
      await withRolls([2, 5], () => {
        expect(sceneAdjustment(8)).toBe('Make 2 Adjustments — Add A Character + Remove An Object');
      });
      await withRolls([4, 4, 5], () => {                     // a repeat is rolled again
        expect(sceneAdjustment(9)).toBe('Make 2 Adjustments — Increase An Activity + Remove An Object');
      });
    });
    it('rolls the two adjustments on 1d10, rolling again on 7-10', async () => {
      const sides = [];
      const vals = [9, 3, 7, 6];
      await withRolls(sd => { sides.push(sd); return vals[sides.length - 1]; }, () => {
        expect(sceneAdjustment(10)).toBe('Make 2 Adjustments — Reduce/Remove An Activity + Add An Object');
      });
      expect(sides).toEqual([10, 10, 10, 10]);
    });
  });

  describe('rollEventFocus() — Random Event Focus Table', () => {
    const T = () => freshCampaign().gme.eventFocusTable;
    it('matches a 1d100 roll against the contiguous ranges', () => {
      expect(rollEventFocus(T(), 1)).toBe('Remote Event');
      expect(rollEventFocus(T(), 5)).toBe('Remote Event');
      expect(rollEventFocus(T(), 6)).toBe('Ambiguous Event');
      expect(rollEventFocus(T(), 30)).toBe('NPC Action');
      expect(rollEventFocus(T(), 100)).toBe('Current Context');
    });
    it('a roll above the last row falls back to the last row', () => {
      expect(rollEventFocus([{ max: 40, result: 'A' }, { max: 60, result: 'B' }], 90)).toBe('B');
    });
    it('sorts rows before matching', () => {
      expect(rollEventFocus([{ max: 100, result: 'hi' }, { max: 20, result: 'lo' }], 10)).toBe('lo');
    });
  });

  describe('Fate Question', () => {
    it('answers with the Ask the Game Master odds and logs it', async () => {
      showTab('gme');
      setValue('#gmeFateQ', 'Is the door locked?');
      await withRolls([30], () => click('#btnGmeFate'));
      expect($('#gmeFateResult')).toContain('Yes');
      expect(lastLog().md).toContain('**Fate Question**');
      expect(lastLog().md).toContain('Is the door locked?');
    });
    it('a double at or under the Chaos Factor starts a Random Event', async () => {
      campaign().gme.chaosFactor = 5; showTab('gme');
      await withRolls([33, 1, 1, 1], () => click('#btnGmeFate'));
      expect($('#gmeFateResult')).toContain('Random Event');
      expect(lastLog().md).toContain('Event Focus');
    });
    it('a double over the Chaos Factor does not', async () => {
      campaign().gme.chaosFactor = 5; showTab('gme');
      await withRolls([77], () => click('#btnGmeFate'));
      expect($('#gmeFateResult')).toContain('no Random Event');
      expect(lastLog().md).not.toContain('Event Focus');
    });
    it('the result and the odds survive a re-render', async () => {
      showTab('gme');
      setValue('#gmeFateOdds', 'Likely');
      await withRolls([30], () => click('#btnGmeFate'));
      renderActive();
      expect($('#gmeFateResult')).toContain('Likely');
      expect($('#gmeFateOdds').value).toBe('Likely');
    });
  });


  describe('Fate Chart (One-Pages Cheat Sheet, p.7)', () => {
    // Read off the sheet cell by cell: [Exceptional Yes up to, Yes up to, Exceptional No from], x = null.
    const SHEET = {
      'Certain':           '10 50 91|13 65 94|15 75 96|17 85 98|18 90 99|19 95 100|20 99 x|20 99 x|20 99 x',
      'Nearly Certain':    '7 35 88|10 50 91|13 65 94|15 75 96|17 85 98|18 90 99|19 95 100|20 99 x|20 99 x',
      'Very Likely':       '5 25 86|7 35 88|10 50 91|13 65 94|15 75 96|17 85 98|18 90 99|19 95 100|20 99 x',
      'Likely':            '3 15 84|5 25 86|7 35 88|10 50 91|13 65 94|15 75 96|17 85 98|18 90 99|19 95 100',
      '50/50 or Unknown':  '2 10 83|3 15 84|5 25 86|7 35 88|10 50 91|13 65 94|15 75 96|17 85 98|18 90 99',
      'Unlikely':          '1 5 82|2 10 83|3 15 84|5 25 86|7 35 88|10 50 91|13 65 94|15 75 96|17 85 98',
      'Very Unlikely':     'x 1 81|1 5 82|2 10 83|3 15 84|5 25 86|7 35 88|10 50 91|13 65 94|15 75 96',
      'Nearly Impossible': 'x 1 81|x 1 81|1 5 82|2 10 83|3 15 84|5 25 86|7 35 88|10 50 91|13 65 94',
      'Impossible':        'x 1 81|x 1 81|x 1 81|1 5 82|2 10 83|3 15 84|5 25 86|7 35 88|10 50 91'
    };
    it('matches all 81 cells of the sheet', () => {
      Object.keys(SHEET).forEach(odds => SHEET[odds].split('|').forEach((cell, i) => {
        const want = cell.split(' ').map(v => v === 'x' ? null : Number(v));
        expect(fateChartCell(odds, i + 1)).toEqual(want);
      }));
    });
    it('reads a roll against the cell', () => {
      expect(fateChartAnswer('50/50 or Unknown', 5, 10).answer).toBe('Exceptional Yes');
      expect(fateChartAnswer('50/50 or Unknown', 5, 50).answer).toBe('Yes');
      expect(fateChartAnswer('50/50 or Unknown', 5, 51).answer).toBe('No');
      expect(fateChartAnswer('50/50 or Unknown', 5, 91).answer).toBe('Exceptional No');
      expect(fateChartAnswer('Certain', 9, 100).answer).toBe('No');            // no Exceptional No ("x")
      expect(fateChartAnswer('Impossible', 1, 1).answer).toBe('Yes');          // no Exceptional Yes ("x")
    });
    it('a double is a Random Event only when its digit is at or under the Chaos Factor', () => {
      expect(fateChartAnswer('Likely', 5, 33).event).toBe(true);
      expect(fateChartAnswer('Likely', 5, 55).event).toBe(true);
      expect(fateChartAnswer('Likely', 5, 66).event).toBe(false);
      expect(fateChartAnswer('Likely', 9, 100).event).toBe(false);
    });
  });

  describe('Fate Check (2d10 + modifiers)', () => {
    it('adds the Odds and Chaos Factor modifiers and reads the total', () => {
      expect(fateCheckAnswer('50/50 or Unknown', 5, 5, 6).total).toBe(11);
      expect(fateCheckAnswer('50/50 or Unknown', 5, 5, 6).answer).toBe('Yes');
      expect(fateCheckAnswer('50/50 or Unknown', 5, 4, 6).answer).toBe('No');
      expect(fateCheckAnswer('Certain', 9, 4, 4).total).toBe(18);
      expect(fateCheckAnswer('Certain', 9, 4, 4).answer).toBe('Exceptional Yes');
      expect(fateCheckAnswer('Impossible', 1, 6, 5).total).toBe(1);
      expect(fateCheckAnswer('Impossible', 1, 6, 5).answer).toBe('Exceptional No');
      expect(fateCheckAnswer('Likely', 6, 2, 2).total).toBe(6);   // 4 + 1 (Likely) + 1 (CF 6)
    });
    it('doubles at or under the Chaos Factor are a Random Event', () => {
      expect(fateCheckAnswer('Likely', 5, 5, 5).event).toBe(true);
      expect(fateCheckAnswer('Likely', 5, 6, 6).event).toBe(false);
      expect(fateCheckAnswer('Likely', 5, 2, 3).event).toBe(false);
    });
    it('the method select is saved in the campaign and the card rolls 2d10', async () => {
      showTab('gme');
      setValue('#gmeFateMethod', 'check');
      expect(campaign().gme.fateMethod).toBe('check');
      const sides = [];
      await withRolls(s => { sides.push(s); return 3; }, () => click('#btnGmeFate'));
      expect(sides.slice(0, 2)).toEqual([10, 10]);
      expect(lastLog().md).toContain('Fate Check 2d10: 3 + 3');
      expect(lastLog().md).toContain('Random Event');           // doubles 3 <= CF 5
      expect(sanitizeCampaign({ gme: { fateMethod: 'bogus' } }).gme.fateMethod).toBe('chart');
    });
    it('the Discovery Check of a Progress Track uses the same method', async () => {
      showTab('gme');
      campaign().gme.fateMethod = 'check';
      setValue('#gmeTrackFocus', 'Find it');
      click('#btnGmeAddTrack');
      const id = campaign().gme.tracks[0].id;
      await withRolls([2, 3], () => click('[data-discovery="' + id + '"]'));
      expect(lastLog().md).toContain('Fate Check 2d10: 2 + 3');
    });
  });

  describe('Random Events (One-Pages Cheat Sheet, p.8)', () => {
    it('Event Meaning: two words from one Meaning Table (Action)', async () => {
      const m = await withRolls([1, 3], () => eventMeaningWords());
      expect(m.a.word).toBe(DISCOVER_ACTION[0]);
      expect(m.d.word).toBe(DISCOVER_ACTION[1]);
    });
    it('an NPC or Thread Focus rolls on its List; an empty List means Current Context', async () => {
      campaign().gme.characters = ['Ann', 'Bob'];
      const r = await withRolls([2], () => focusListRoll('NPC Negative'));
      expect(r.md).toContain('Characters List (1d2: 2)');
      expect(r.md).toContain('Bob');
      expect(focusListRoll('Close A Thread').md).toContain('Current Context');
      expect(focusListRoll('Remote Event')).toBeNull();
    });
    it('an Interrupt Scene with a Thread Focus rolls the Threads List', async () => {
      campaign().gme.threads = ['Escape', 'Revenge'];
      showTab('gme');
      // 4 => Interrupt; focus 60 => Move Away From A Thread; list 2 => Revenge; words 1, 1
      await withRolls([4, 60, 2, 1, 1], () => click('#btnGmeTestScene'));
      expect(lastLog().md).toContain('Threads List (1d2: 2) → **Revenge**');
    });
  });

  describe('List limit: at most 3 copies of an entry', () => {
    it('Add and ⧉ stop at 3 copies, and the import cleans extra copies', async () => {
      showTab('gme');
      for (let i = 0; i < 3; i++) { setValue('#gmeThreadInput', 'Escape'); click('#btnGmeAddThread'); }
      await withDialogs({ alert: undefined }, () => { setValue('#gmeThreadInput', 'Escape'); click('#btnGmeAddThread'); });
      expect(campaign().gme.threads).toEqual(['Escape', 'Escape', 'Escape']);
      expect($('[data-dupe="threads"][data-i="0"]').disabled).toBe(true);
      expect(sanitizeCampaign({ gme: { characters: ['A', 'A', 'A', 'A', 'B'] } }).gme.characters).toEqual(['A', 'A', 'A', 'B']);
    });
  });

  describe('Chaos Factor', () => {
    it('starts at 5 and clamps to 1..9', () => {
      expect(campaign().gme.chaosFactor).toBe(5);
      for (let i = 0; i < 10; i++) click('#btnSceneCfMinus');
      expect(campaign().gme.chaosFactor).toBe(1);
      for (let i = 0; i < 20; i++) click('#btnSceneCfPlus');
      expect(campaign().gme.chaosFactor).toBe(9);
      expect(lastLog().md).toContain('Chaos Factor');
    });
  });

  describe('Testing the Expected Scene against the Chaos Factor', () => {
    beforeEach(() => { campaign().gme.chaosFactor = 5; persist(); showTab('gme'); });

    it('1d10 over the CF => Expected Scene', async () => {
      await withRolls([7], () => click('#btnGmeTestScene'));
      expect($('#gmeSceneTestResult')).toContain('Expected Scene');
      expect($('#gmeSceneTestResult')).not.toContain('Altered');
      expect(lastLog().md).toContain('→ **Expected Scene**');
    });
    it('an Altered Scene rolls the Scene Adjustment Table (1d10) + one Meaning word', async () => {
      // 3 => Altered; adj-roll 1 => "Remove A Character"; word-roll 40. The column
      // is the tool's pick (Math.random, not a die): 0.1 => Action.
      const realRandom = Math.random;
      Math.random = () => 0.1;
      try { await withRolls([3, 1, 40], () => click('#btnGmeTestScene')); }
      finally { Math.random = realRandom; }
      const box = $('#gmeSceneTestResult');
      expect(box).toContain('Altered Scene');
      expect(box).toContain('Scene Adjustment');
      expect(box).toContain('Remove A Character');
      expect(box).toContain('Meaning (Action');
      expect($$('#gmeSceneTestResult .word-chip')).toHaveLength(1);
      expect(lastLog().md).toContain('Scene Adjustment (1d10: 1) → **Remove A Character**');
      expect(lastLog().md).toContain('Meaning (Action, 1d100: 40)');
    });
    it('an Interrupt Scene is a Random Event: Event Focus (1d100) + a Meaning word pair (2 x 1d100)', async () => {
      // 4 => Interrupt; focus-roll 30 => "NPC Action" (default table); words 2 and 55
      await withRolls([4, 30, 2, 55], () => click('#btnGmeTestScene'));
      const box = $('#gmeSceneTestResult');
      expect(box).toContain('Interrupt Scene');
      expect(box).toContain('Event Focus');
      expect(box).toContain('NPC Action');
      expect($$('#gmeSceneTestResult .word-chip')).toHaveLength(2);
      expect(box).toContain(DISCOVER_ACTION[0]);   // word roll 2 -> row 1
      expect(box).toContain(DISCOVER_ACTION[27]);  // word roll 55 -> row 28: both words from the Action column
      expect(lastLog().md).toContain('Event Focus (1d100: 30) → **NPC Action**');
    });
    it('an Expected Scene result adds no Scene Adjustment, Event Focus or Meaning word', async () => {
      await withRolls([9], () => click('#btnGmeTestScene'));   // 9 > CF 5
      expect($('#gmeSceneTestResult')).toContain('Expected Scene');
      expect($$('#gmeSceneTestResult .word-chip')).toHaveLength(0);
      expect($('#gmeSceneTestResult')).not.toContain('Scene Adjustment');
      expect($('#gmeSceneTestResult')).not.toContain('Event Focus');
    });
    it('the boundary roll (== CF) counts as "within"', async () => {
      await withRolls([5], () => click('#btnGmeTestScene'));   // 5 == CF 5, odd
      expect($('#gmeSceneTestResult')).toContain('Altered Scene');
    });
    it('carries the Expected Scene text into the log', async () => {
      setValue('#gmeExpectedScene', 'PC visits the suspect at work');
      await withRolls([2], () => click('#btnGmeTestScene'));
      expect(lastLog().md).toContain('PC visits the suspect at work');
    });
  });

  describe('End Scene bookkeeping', () => {
    it('PC in control lowers CF, advances the Scene, clears the Expected Scene', () => {
      const g = campaign().gme;
      g.chaosFactor = 5; g.sceneNumber = 3; g.expectedScene = 'something'; persist(); showTab('gme');
      setValue('#sceneControl', 'in');
      click('#btnSceneEnd');
      expect(campaign().gme.chaosFactor).toBe(4);
      expect(campaign().gme.sceneNumber).toBe(4);
      expect(campaign().gme.expectedScene).toBe('');
      expect(lastLog().md).toContain('in control');
    });
    it('PC not in control raises CF, clamped at 9', () => {
      campaign().gme.chaosFactor = 9; persist(); showTab('gme');
      setValue('#sceneControl', 'out');
      click('#btnSceneEnd');
      expect(campaign().gme.chaosFactor).toBe(9);
      expect(campaign().gme.sceneNumber).toBe(2);
    });
  });

  describe('Threads / Characters Lists', () => {
    it('Add appends an entry and logs it', () => {
      setValue('#gmeThreadInput', 'Find the stone');
      click('#btnGmeAddThread');
      expect(campaign().gme.threads).toEqual(['Find the stone']);
      expect(lastLog().md).toContain('Threads List');
    });
    it('the dupe button inserts a weighting copy next to the original', () => {
      setValue('#gmeThreadInput', 'A'); click('#btnGmeAddThread');
      setValue('#gmeThreadInput', 'B'); click('#btnGmeAddThread');
      click('[data-dupe="threads"][data-i="0"]');
      expect(campaign().gme.threads).toEqual(['A', 'A', 'B']);
    });
    it('remove deletes the entry at that index', () => {
      ['A', 'B', 'C'].forEach(v => { setValue('#gmeThreadInput', v); click('#btnGmeAddThread'); });
      click('[data-rm="threads"][data-i="1"]');
      expect(campaign().gme.threads).toEqual(['A', 'C']);
    });
    it('Edit renames an entry in place (Enter saves, Escape cancels) and logs it', () => {
      ['A', 'B'].forEach(v => { setValue('#gmeThreadInput', v); click('#btnGmeAddThread'); });
      click('[data-edit="threads"][data-i="1"]');
      let input = $('#panelHost .gme-list li.editing input.list-edit');
      expect(input.value).toBe('B');
      input.value = '  Bee  ';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(campaign().gme.threads).toEqual(['A', 'Bee']);
      expect(lastLog().md).toContain('renamed "B" to "Bee"');
      expect($('#panelHost .gme-list li.editing')).toBeNull();
      click('[data-edit="threads"][data-i="0"]');
      input = $('#panelHost .gme-list li.editing input.list-edit');
      input.value = 'Other';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(campaign().gme.threads).toEqual(['A', 'Bee']);
      click('[data-edit="threads"][data-i="0"]');
      input = $('#panelHost .gme-list li.editing input.list-edit');
      input.value = '   ';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(campaign().gme.threads).toEqual(['A', 'Bee']);   // empty text is not saved
    });
    it('a row\'s buttons are hidden until the row is hovered or focused', () => {
      setValue('#gmeThreadInput', 'A'); click('#btnGmeAddThread');
      const btn = $('[data-edit="threads"][data-i="0"]');
      expect(btn.textContent).toBe('Edit');
      if (matchMedia('(hover:hover)').matches) expect(getComputedStyle(btn).opacity).toBe('0');
      btn.style.transition = 'none';   // read the end value, not the fade
      btn.focus();
      expect(btn.closest('li').matches(':focus-within')).toBe(true);
      expect(getComputedStyle(btn).opacity).toBe('1');
    });
    it('Roll on List is disabled while empty and picks an entry once populated', async () => {
      expect($('#btnGmeRollThread').disabled).toBe(true);
      ['A', 'B', 'C'].forEach(v => { setValue('#gmeThreadInput', v); click('#btnGmeAddThread'); });
      await withRolls([2], () => click('#btnGmeRollThread'));   // rollDie(3) -> 2 -> index 1
      expect($('#threadsRollResult')).toContain('B');
      expect(lastLog().md).toContain('Roll on Threads List');
    });
    it('the Characters List behaves the same way', () => {
      setValue('#gmeCharInput', 'The butler'); click('#btnGmeAddChar');
      expect(campaign().gme.characters).toEqual(['The butler']);
      expect($('#btnGmeRollChar').disabled).toBe(false);
    });
  });

  describe('Thread Progress Tracks', () => {
    function addTrack(focus, size) {
      setValue('#gmeTrackFocus', focus);
      setValue('#gmeTrackSize', String(size));
      click('#btnGmeAddTrack');
      return campaign().gme.tracks[campaign().gme.tracks.length - 1].id;
    }

    it('Start Track creates a track with size/5 - 1 Flashpoint phases', () => {
      addTrack('Restore the manna', 15);
      const t = campaign().gme.tracks[0];
      expect(t.size).toBe(15);
      expect(t.points).toBe(0);
      expect(t.flashpoints).toEqual([false, false]);
      expect(lastLog().md).toContain('Progress Track started');
    });

    it('Make Progress +2 advances points and shows the delta', () => {
      const id = addTrack('T', 10);
      click('[data-progress="' + id + '"]');
      expect(campaign().gme.tracks[0].points).toBe(2);
      expect($('#gmeTrackResult_' + id)).toContain('Progress +2');
    });

    it('crossing a 5-point phase boundary auto-fires that phase Flashpoint', () => {
      const id = addTrack('T', 10);
      const sel = '[data-progress="' + id + '"]';
      click(sel); click(sel); click(sel);   // 2, 4, 6 -> crosses 5
      const t = campaign().gme.tracks[0];
      expect(t.points).toBe(6);
      expect(t.flashpoints[0]).toBe(true);
      expect($('#gmeTrackResult_' + id)).toContain('Phase 1 Flashpoint auto-triggered');
      expect(lastLog().md).toContain('Phase 1 Flashpoint triggered');
    });

    it('a manual Flashpoint marks the current phase and does NOT auto-fire', () => {
      const id = addTrack('T', 15);
      click('[data-flash="' + id + '"]');   // +2 -> 2 pts
      const t = campaign().gme.tracks[0];
      expect(t.points).toBe(2);
      expect(t.flashpoints[0]).toBe(true);
      expect($('#gmeTrackResult_' + id)).not.toContain('auto-triggered');
    });

    it('reaching full points concludes the Track and removes its action buttons', () => {
      const id = addTrack('T', 10);
      for (let i = 0; i < 6; i++) {
        const b = document.querySelector('[data-progress="' + id + '"]');
        if (b) click(b);
      }
      const t = campaign().gme.tracks[0];
      expect(t.points).toBe(10);
      expect(t.concluded).toBe(true);
      expect($('#gmeTrackResult_' + id)).toContain('Conclusion reached');
      expect(document.querySelector('[data-progress="' + id + '"]')).toBeNull();
    });

    it('a phase Flashpoint checkbox toggle persists', () => {
      const id = addTrack('T', 20);
      const cb = document.querySelector('[data-fp="' + id + '"][data-idx="1"]');
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
      expect(campaign().gme.tracks[0].flashpoints[1]).toBe(true);
    });

    it('Remove deletes the Track after confirmation', async () => {
      const id = addTrack('Doomed', 10);
      await withDialogs({ confirm: true }, () => click('[data-rm-track="' + id + '"]'));
      expect(campaign().gme.tracks).toHaveLength(0);
    });

    it('multiple Tracks coexist independently', () => {
      const a = addTrack('Alpha', 10);
      const b = addTrack('Beta', 15);
      click('[data-progress="' + a + '"]');
      expect(campaign().gme.tracks.find(t => t.id === a).points).toBe(2);
      expect(campaign().gme.tracks.find(t => t.id === b).points).toBe(0);
    });

    it('the collapse toggle hides the phase flags and action buttons and persists', () => {
      const id = addTrack('T', 15);
      expect(document.querySelector('[data-progress="' + id + '"]')).toBeTruthy();
      click('[data-collapse-track="' + id + '"]');
      expect(campaign().gme.tracks[0].collapsed).toBe(true);
      expect(document.querySelector('[data-progress="' + id + '"]')).toBeNull();
      expect(document.querySelector('[data-fp="' + id + '"]')).toBeNull();
      // the header, mini readout and progress bar stay visible
      expect(document.querySelector('.gme-track .gme-progressbar')).toBeTruthy();
      expect($('.gme-track-mini')).toContain('/ 15');
      // survives an unrelated re-render
      click('#btnSceneCfPlus');
      expect(document.querySelector('[data-progress="' + id + '"]')).toBeNull();
      // expand again
      click('[data-collapse-track="' + id + '"]');
      expect(campaign().gme.tracks[0].collapsed).toBe(false);
      expect(document.querySelector('[data-progress="' + id + '"]')).toBeTruthy();
    });
  });

  describe('Discovery Check (Fate Question via askTheGM)', () => {
    function addTrack(size) {
      setValue('#gmeTrackFocus', 'Focus');
      setValue('#gmeTrackSize', String(size));
      click('#btnGmeAddTrack');
      return campaign().gme.tracks[campaign().gme.tracks.length - 1].id;
    }

    it('only offers odds of 50/50 or better', () => {
      const id = addTrack(10);
      expect($$('#gmeDiscOdds_' + id + ' option').map(o => o.value))
        .toEqual(['50/50 or Unknown', 'Likely', 'Very Likely', 'Nearly Certain', 'Certain']);
    });

    it('a Yes rolls once on the Discovery Check Table and adds points', async () => {
      const id = addTrack(15);
      setValue('#gmeDiscOdds_' + id, '50/50 or Unknown');
      // q-roll 30 => Yes; table 1d10 = 1 (+0 progress) => total 1 => Progress +2
      await withRolls([30, 1], () => click('[data-discovery="' + id + '"]'));
      expect(campaign().gme.tracks[0].points).toBe(2);
      expect($('#gmeTrackResult_' + id)).toContain('Progress +2');
      expect(lastLog().md).toContain('Discovery Check');
    });

    it('an Exceptional Yes rolls twice on the table, combining results', async () => {
      const id = addTrack(20);
      setValue('#gmeDiscOdds_' + id, '50/50 or Unknown');
      // q-roll 5 => Exceptional Yes; two table rolls of 1 => Progress +2 twice
      await withRolls([5, 1], () => click('[data-discovery="' + id + '"]'));
      expect(campaign().gme.tracks[0].points).toBe(4);
    });

    it('a No finds nothing and does not roll on the table', async () => {
      const id = addTrack(15);
      setValue('#gmeDiscOdds_' + id, '50/50 or Unknown');
      await withRolls([70], () => click('[data-discovery="' + id + '"]'));   // 70 => No
      expect(campaign().gme.tracks[0].points).toBe(0);
      expect($('#gmeTrackResult_' + id)).toContain('Nothing useful');
    });
  });

  describe('sanitizeCampaign() — gme block', () => {
    it('fills gme defaults for a campaign that predates the tab', () => {
      const c = sanitizeCampaign({ location: {}, adventure: {}, mystery: {} });
      expect(c.gme).toEqual(freshCampaign().gme);
    });
    it('clamps the Chaos Factor to 1..9 and defaults a non-number', () => {
      expect(sanitizeCampaign({ gme: { chaosFactor: 99 } }).gme.chaosFactor).toBe(9);
      expect(sanitizeCampaign({ gme: { chaosFactor: 0 } }).gme.chaosFactor).toBe(1);
      expect(sanitizeCampaign({ gme: { chaosFactor: 'x' } }).gme.chaosFactor).toBe(5);
    });
    it('drops non-string / blank list entries and trims the rest', () => {
      const c = sanitizeCampaign({ gme: { threads: ['ok', '   ', 5, null, ' trimmed '] } });
      expect(c.gme.threads).toEqual(['ok', 'trimmed']);
    });
    it('repairs a Progress Track: bad size -> 10, points clamped, flashpoints resized, concluded set', () => {
      const c = sanitizeCampaign({ gme: { tracks: [
        { focus: 'X', size: 13, points: 999, flashpoints: [true, true, true, true] },
      ] } });
      const t = c.gme.tracks[0];
      expect(t.size).toBe(10);
      expect(t.points).toBe(10);
      expect(t.flashpoints).toEqual([true]);
      expect(t.concluded).toBe(true);
    });
    it('assigns ids to id-less tracks and forces nextTrackId above them', () => {
      const c = sanitizeCampaign({ gme: { tracks: [ { focus: 'A', size: 10 }, { focus: 'B', size: 10 } ] } });
      const ids = c.gme.tracks.map(t => t.id);
      expect(ids[0]).not.toBe(ids[1]);
      expect(c.gme.nextTrackId).toBeGreaterThan(Math.max(ids[0], ids[1]));
    });

    it('a fresh campaign carries the default 12-row Event Focus Table', () => {
      expect(freshCampaign().gme.eventFocusTable).toHaveLength(12);
      expect(freshCampaign().gme.eventFocusTable[0]).toEqual({ max: 5, result: 'Remote Event' });
    });
    it('repairs the Event Focus Table: clamps maxes, blanks -> "(unnamed)", drops junk, sorts', () => {
      const c = sanitizeCampaign({ gme: { eventFocusTable: [
        { max: 200, result: 'Big' }, { max: 5, result: '   ' }, { max: 'x', result: 'skip' }, 'junk',
      ] } });
      expect(c.gme.eventFocusTable).toEqual([
        { max: 5, result: '(unnamed)' },
        { max: 100, result: 'Big' },
      ]);
    });
    it('an empty Event Focus Table falls back to the default', () => {
      const c = sanitizeCampaign({ gme: { eventFocusTable: [] } });
      expect(c.gme.eventFocusTable).toEqual(freshCampaign().gme.eventFocusTable);
    });
  });

  describe('Random Event Focus Table editor', () => {
    beforeEach(() => { resetApp(); showTab('gme'); });

    it('lives in Settings only: the tab has no card or Edit button for it', () => {
      expect($('#btnGmeFocusEdit')).toBeNull();
      expect($('#panelHost')).not.toContain('Random Event Focus Table');
    });

    it('openSettings(\'eventFocus\') opens Settings with the table expanded', () => {
      expect($$('[data-focus-max]')).toHaveLength(0);
      openSettings('eventFocus');
      expect($('#settingsOverlay').classList.contains('open')).toBe(true);
      expect($('#settingsTables details[data-settings-table="eventFocus"]').open).toBe(true);
      expect($('#settingsTables details[data-settings-table="inspiration"]').open).toBe(false);
      expect($$('[data-focus-max]')).toHaveLength(12);
    });

    it('editing a result persists it without collapsing the editor', () => {
      openSettings('eventFocus');
      setValue('[data-focus-result="3"]', 'Custom Focus');
      expect(campaign().gme.eventFocusTable[3].result).toBe('Custom Focus');
      expect(JSON.parse(sessionStorage.getItem('mythicToolkit_v1'))
        .campaigns[STORE.current].gme.eventFocusTable[3].result).toBe('Custom Focus');
      expect($$('[data-focus-max]')).toHaveLength(12);   // still open
    });

    it('editing a max re-sorts the rows', () => {
      openSettings('eventFocus');
      setValue('[data-focus-max="0"]', '90');   // "Remote Event" jumps to near the end
      const table = campaign().gme.eventFocusTable;
      expect(table.map(r => r.max)).toEqual(table.map(r => r.max).slice().sort((a, b) => a - b));
      expect(table.find(r => r.result === 'Remote Event').max).toBe(90);
    });

    it('Add row / Remove row / Reset to default', async () => {
      openSettings('eventFocus');
      click('#btnGmeFocusAdd');
      expect(campaign().gme.eventFocusTable.length).toBe(13);
      click('[data-focus-rm="0"]');
      expect(campaign().gme.eventFocusTable.length).toBe(12);
      await withDialogs({ confirm: true }, () => click('#btnGmeFocusReset'));
      expect(campaign().gme.eventFocusTable).toEqual(freshCampaign().gme.eventFocusTable);
      expect(lastLog().md).toContain('Event Focus Table');
    });

    it('a customised table is what an Interrupt Scene rolls against', async () => {
      openSettings('eventFocus');
      setValue('[data-focus-result="0"]', 'HOUSE RULE');   // covers rolls 1-5
      campaign().gme.chaosFactor = 9; persist(); showTab('gme');
      // 2 => Interrupt (<= CF 9, even); focus-roll 3 => row 0 => "HOUSE RULE"; col 1; word 10
      await withRolls([2, 3, 1, 10], () => click('#btnGmeTestScene'));
      expect($('#gmeSceneTestResult')).toContain('HOUSE RULE');
      expect(lastLog().md).toContain('Event Focus (1d100: 3) → **HOUSE RULE**');
    });
  });
});

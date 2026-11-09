/* Player Emulator tab (16-tab-player-emulator.js) + its slice of the state
   model (freshPlayerEmu / sanitizePlayerEmu in 03-state-persistence.js). */

describe('Player Emulator — data tables', () => {

  it('Character Response Types: 50 rows, sorted most-minus → most-plus', () => {
    expect(PE_RESPONSE_TYPES).toHaveLength(50);
    for (let i = 1; i < PE_RESPONSE_TYPES.length; i++) {
      expect(PE_RESPONSE_TYPES[i].rating).toBeGreaterThanOrEqual(PE_RESPONSE_TYPES[i - 1].rating);
    }
    expect(PE_RESPONSE_TYPES[0].rating).toBe(-3);
    expect(PE_RESPONSE_TYPES[49]).toEqual({ name: 'Violent', rating: 4 });
  });

  it('peResponseType maps a 1d100 roll onto a two-percentile row', () => {
    expect(peResponseType(1).name).toBe(PE_RESPONSE_TYPES[0].name);
    expect(peResponseType(2).name).toBe(PE_RESPONSE_TYPES[0].name);
    expect(peResponseType(3).name).toBe(PE_RESPONSE_TYPES[1].name);
    expect(peResponseType(100).name).toBe('Violent');
  });

  it('NPC Mood Table: 10 rows, Generous −3 first, Cruel +4 last', () => {
    expect(PE_NPC_MOODS).toHaveLength(10);
    expect(peNpcMood(1)).toEqual({ name: 'Generous', rating: -3, roll: 1 });
    expect(peNpcMood(10)).toEqual({ name: 'Cruel', rating: 4, roll: 10 });
  });

  it('Outlooks: 10 entries with Wild card at slot 3', () => {
    expect(PE_OUTLOOKS).toHaveLength(10);
    expect(PE_OUTLOOKS[PE_WILDCARD_OUTLOOK - 1].name).toBe('Wild card');
  });

  it('peRatingLabel renders +/− symbol runs and 0', () => {
    expect(peRatingLabel(-3)).toBe('− − −');
    expect(peRatingLabel(0)).toBe('0');
    expect(peRatingLabel(2)).toBe('+ +');
  });
});

describe('Player Emulator — Advantage / Disadvantage', () => {

  it('peRollType normal makes one d100 roll', async () => {
    await withRolls([42], () => {
      const t = peRollType('normal');
      expect(t.rolls).toHaveLength(1);
      expect(t.kept).toBe(42);
    });
  });

  it('Advantage keeps the lowest of 2d100, Disadvantage the highest', async () => {
    await withRolls([80, 20], () => {
      const t = peRollType('adv');
      expect(t.rolls).toEqual([80, 20]);
      expect(t.kept).toBe(20);
    });
    await withRolls([80, 20], () => {
      expect(peRollType('dis').kept).toBe(80);
    });
  });
});

describe('Player Emulator — chart building', () => {

  it('peBuildChart fills exactly 10 segments', async () => {
    await withRolls([50, 6, 60, 6], () => {
      const chart = peBuildChart('normal');
      expect(chart.reduce((s, e) => s + e.segments, 0)).toBe(10);
      expect(chart).toHaveLength(2);
      expect(chart[0].segments).toBe(6);
      expect(chart[1].segments).toBe(4);   // clamped to what remained
    });
  });

  it('peChartResponseAt walks the segments in order', () => {
    const entries = [{ name: 'A', rating: -1, segments: 6 }, { name: 'B', rating: 2, segments: 4 }];
    expect(peChartResponseAt(entries, 1).name).toBe('A');
    expect(peChartResponseAt(entries, 6).name).toBe('A');
    expect(peChartResponseAt(entries, 7).name).toBe('B');
    expect(peChartResponseAt(entries, 10).name).toBe('B');
  });
});

describe('Player Emulator — state model', () => {

  beforeEach(resetApp);

  it('freshCampaign seeds an empty playerEmu', () => {
    expect(freshCampaign().playerEmu).toEqual({ pcs: [], nextPcId: 1, npcs: [], nextNpcId: 1, adjust: 0, npcMoodMode: 'normal', useHeldResponses: true });
  });

  it('sanitizePlayerEmu keeps a valid npcMoodMode and defaults a bad one', () => {
    expect(sanitizePlayerEmu({ npcMoodMode: 'dis' }).npcMoodMode).toBe('dis');
    expect(sanitizePlayerEmu({ npcMoodMode: 'wat' }).npcMoodMode).toBe('normal');
  });

  it('sanitizePlayerEmu guards useHeldResponses (boolean, default true)', () => {
    expect(sanitizePlayerEmu({}).useHeldResponses).toBe(true);
    expect(sanitizePlayerEmu({ useHeldResponses: false }).useHeldResponses).toBe(false);
    expect(sanitizePlayerEmu({ useHeldResponses: 'yes' }).useHeldResponses).toBe(true);
  });

  it('sanitizePlayerEmu drops junk PCs and trims a chart to 10 segments', () => {
    const clean = sanitizePlayerEmu({
      pcs: [
        null,
        { id: 5, name: '  Gem  ', outlook: 8, chartMode: 'adv',
          chart: [{ name: 'Brutal', rating: 4, segments: 8 }, { name: 'Violent', rating: 4, segments: 8 }] },
        { name: 'x', outlook: 99, chartMode: 'nope', chart: 'bad' },
      ],
      npcs: [{ mood: 40 }, { id: 2, name: 'Courier', mood: 6 }],
      adjust: 999,
    });
    expect(clean.pcs).toHaveLength(2);
    expect(clean.pcs[0].name).toBe('Gem');
    expect(clean.pcs[0].outlook).toBe(8);
    expect(clean.pcs[0].chart.reduce((s, e) => s + e.segments, 0)).toBe(10);
    expect(clean.pcs[1].outlook).toBeNull();      // 99 rejected
    expect(clean.pcs[1].chartMode).toBe('normal'); // 'nope' rejected
    expect(clean.pcs[1].chart).toEqual([]);
    expect(clean.nextPcId).toBeGreaterThan(5);
    expect(clean.npcs[0].mood).toBe(1);            // 40 rejected -> default
    expect(clean.adjust).toBe(20);                 // clamped
  });

  it('sanitizeCampaign(null) still deep-equals freshCampaign()', () => {
    expect(sanitizeCampaign(null)).toEqual(freshCampaign());
  });
});

describe('Player Emulator — tab UI', () => {

  beforeEach(() => { resetApp(); showTab('playerEmu'); });

  function addPc(name) {
    setValue('#peNewPcName', name);
    click('#btnPeAddPc');
  }

  it('Add PC puts a character card on the roster and logs it', () => {
    addPc('Stan');
    // The name is an editable <input>, so read its value (textContent skips it).
    expect($('.pe-pc [data-pc-name]').value).toBe('Stan');
    expect($$('.pe-pc')).toHaveLength(1);
    expect(lastLog().section).toBe('Player Emulator');
  });

  it('Roll Outlook fills the PC Outlook line', async () => {
    addPc('Stan');
    await withRolls([2], () => click('[data-pc-outlook="1"]'));
    expect($('.pe-pc')).toContain('Pessimist');
  });

  it('Build Response Chart renders a 10-segment bar and enables Roll response', async () => {
    addPc('Stan');
    await withRolls([50, 6, 60, 6], () => click('[data-pc-build="1"]'));
    expect($$('.pe-pc .pe-chart .seg').length).toBeGreaterThanOrEqual(1);
    const rollBtn = $('[data-pc-roll="1"]');
    expect(rollBtn.disabled).toBe(false);
    await withRolls([3], () => click(rollBtn));
    expect($('#peResponseResult_1 .result-box')).toBeTruthy();
  });

  it('Add NPC rolls one mood and lists the NPC', async () => {
    await withRolls([10], () => click('#btnPeAddNpc'));
    expect($('#panelHost')).toContain('Cruel');
    expect($$('.gme-list li')).toHaveLength(1);
  });

  it('Edit renames an NPC and keeps its mood', async () => {
    await withRolls([10], () => click('#btnPeAddNpc'));
    const id = campaign().playerEmu.npcs[0].id;
    click(`[data-npc-edit="${id}"]`);
    const input = $('#panelHost .gme-list li.editing input.list-edit');
    input.value = 'The Courier';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(campaign().playerEmu.npcs[0].name).toBe('The Courier');
    expect(campaign().playerEmu.npcs[0].mood).toBe(10);
    expect($('#panelHost .gme-list')).toContain('The Courier');
  });

  it('NPC mood dropdown biases the roll with Advantage / Disadvantage', async () => {
    setValue('#peNpcMoodMode', 'dis');
    await withRolls([3, 9], () => click('#btnPeAddNpc'));   // 2d10 keep highest → 9 (Aggressive +3)
    expect($('#panelHost')).toContain('Aggressive');
    expect(lastLog().md).toContain('Disadvantage');
    expect($('#peNpcMoodMode').value).toBe('dis');          // selection persists across the re-render
  });

  it('the Encounter Mood follows the NPC moods by itself: violent at + + + +', async () => {
    expect($('#btnPeGenerateMood')).toBeFalsy();
    await withRolls([10], () => click('#btnPeAddNpc'));       // Cruel (+4) — enough on its own
    const box = $('#peEncounterResult .result-box');
    expect(box.className).toContain('no');                    // violent -> danger styling
    expect($('#peEncounterResult')).toContain('Violent encounter begins');
  });

  it('the Encounter Mood stays calm when the ratings stay below + + + +', async () => {
    await withRolls([2], () => click('#btnPeAddNpc'));        // Friendly (−2)
    expect($('#peEncounterResult .result-box').className).not.toContain('no');
    expect($('#peEncounterResult')).toContain('No violence');
    setValue('#peAdjust', '6');                               // −2 + 6 = +4
    expect($('#peEncounterResult')).toContain('Violent encounter begins');
  });

  it('a rolled PC response joins the Encounter Mood; a PC without one is listed as waiting', async () => {
    addPc('Stan');
    await withRolls([50, 6, 60, 6], () => click('[data-pc-build="1"]'));
    expect($('#peEncounterResult')).toContain('No response yet');
    await withRolls([3], () => click('[data-pc-roll="1"]'));
    const held = $('#peResponseResult_1 .word-chip b').textContent;
    expect($('#peEncounterResult')).not.toContain('No response yet');
    expect($('#peEncounterResult')).toContain(held);
    expect($('#peEncounterResult')).toContain('1d10 3 on chart');
  });

  it('a Wild card PC with no chart can respond and joins the mood', async () => {
    addPc('Goldfish');
    await withRolls([PE_WILDCARD_OUTLOOK], () => click('[data-pc-outlook="1"]'));
    expect($('[data-pc-roll="1"]').disabled).toBe(false);
    await withRolls([1], () => click('[data-pc-roll="1"]'));
    expect($('#peEncounterResult')).toContain('Goldfish');
    expect($('#peEncounterResult')).toContain('Wild card');
  });

  it('Clear encounter removes the NPCs and the PC responses', async () => {
    addPc('Stan');
    await withRolls([50, 6, 60, 6], () => click('[data-pc-build="1"]'));
    await withRolls([3], () => click('[data-pc-roll="1"]'));
    await withRolls([5], () => click('#btnPeAddNpc'));
    click('#btnPeClearEncounter');
    expect(campaign().playerEmu.npcs).toHaveLength(0);
    expect($('#peResponseResult_1 .result-box')).toBeFalsy();
    expect($('#peEncounterResult')).toContain('No response yet');
    expect($('#btnPeClearEncounter').disabled).toBe(true);
  });

  it('Extra conflict sits right of Clear encounter in one row', () => {
    const bar = $('.pe-encounter-bar');
    expect(bar.querySelector('#btnPeClearEncounter')).toBeTruthy();
    expect(bar.querySelector('#peAdjust')).toBeTruthy();
    expect(bar.lastElementChild.contains($('#peAdjust'))).toBe(true);
  });

  it('Reference tables toggle shows all 50 re-sorted response rows', () => {
    click('#btnPeRefToggle');
    // the first ref table lists the 50 Character Response Types
    expect($$('.pe-ref-table')[0].querySelectorAll('tbody tr')).toHaveLength(50);
  });

  it('existing PCs open collapsed; a PC added here opens expanded', () => {
    const pe = campaign().playerEmu;
    pe.pcs.push({ id: pe.nextPcId++, name: 'Saved', outlook: null, chartMode: 'normal',
      chart: [{ name: 'Charming', rating: -3, segments: 10 }] });
    persist(); showTab('playerEmu');
    expect($('.pe-pc.collapsed')).toBeTruthy();
    expect($('[data-pc-name="1"]')).toBeFalsy();
    expect($('[data-pc-collapse="1"]').textContent).toBe('Show');
    addPc('New');
    expect($('[data-pc-name="2"]')).toBeTruthy();          // the new card is expanded
    expect($('.pe-pc[data-pc="1"]').classList.contains('collapsed')).toBe(true);
  });

  it('Hide shows only the labeled chart and Roll response; Show brings the card back', async () => {
    addPc('Stan');
    await withRolls([50, 6, 60, 6], () => click('[data-pc-build="1"]'));
    click('[data-pc-collapse="1"]');
    expect($('.pe-pc.collapsed')).toBeTruthy();
    expect($('.pe-outlook-txt')).toBeFalsy();            // no Outlook rolled yet
    await withRolls([2], () => { campaign().playerEmu.pcs[0].outlook = 2; persist(); renderActive(); });
    expect($('.pe-pc.collapsed .pe-name-txt .pe-outlook-txt')).toContain('Pessimist');
    expect($('[data-pc-name="1"]')).toBeFalsy();
    expect($('[data-pc-build="1"]')).toBeFalsy();
    expect($('.pe-pc .pe-chart.labeled .seg-name')).toBeTruthy();
    expect($('.pe-pc .pe-chart.labeled')).toContain(campaign().playerEmu.pcs[0].chart[0].name);
    await withRolls([3], () => click('[data-pc-roll="1"]'));
    expect($('#peResponseResult_1 .result-box')).toBeTruthy();
    renderActive();
    expect($('#peResponseResult_1 .result-box')).toBeTruthy();   // survives a re-render
    click('[data-pc-collapse="1"]');
    expect($('[data-pc-name="1"]')).toBeTruthy();
  });

  it('Edit chart opens a modal; Save needs 10 segments and writes the chart', () => {
    addPc('Stan');
    click('[data-pc-edit-chart="1"]');
    expect($('#peChartModal').classList.contains('open')).toBe(true);
    expect($$('[data-pce-name]')).toHaveLength(1);
    expect($('#btnPceSave').disabled).toBe(true);       // no name yet
    setValue('[data-pce-name="0"]', 'charming');         // a Response Type fills its rating
    expect($('[data-pce-name="0"]').value).toBe('Charming');
    expect($('[data-pce-rating="0"]').value).toBe('-3');
    setValue('[data-pce-seg="0"]', '6');
    expect($('#btnPceSave').disabled).toBe(true);
    expect($('#peChartErrors')).toContain('sum to 6');
    click('#btnPceAdd');
    expect($('[data-pce-seg="1"]').value).toBe('4');
    setValue('[data-pce-name="1"]', 'Furious');
    setValue('[data-pce-rating="1"]', '3');
    click('[data-pce-down="0"]');
    expect($('[data-pce-name="0"]').value).toBe('Furious');
    expect($('#btnPceSave').disabled).toBe(false);
    click('#btnPceSave');
    expect($('#peChartModal').classList.contains('open')).toBe(false);
    expect(campaign().playerEmu.pcs[0].chart).toEqual([
      { name: 'Furious', rating: 3, segments: 4 },
      { name: 'Charming', rating: -3, segments: 6 }
    ]);
    expect(lastLog().md).toContain('Response Chart edited');
  });

  it('Cancel, the close button, the backdrop and Escape leave the chart as it was', async () => {
    addPc('Stan');
    await withRolls([50, 6, 60, 6], () => click('[data-pc-build="1"]'));
    const before = JSON.stringify(campaign().playerEmu.pcs[0].chart);
    const open = () => { click('[data-pc-edit-chart="1"]'); setValue('[data-pce-name="0"]', 'Changed'); };
    open(); click('#btnPceCancel');
    open(); click('#peChartClose');
    open(); click('#peChartModal');
    open(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect($('#peChartModal').classList.contains('open')).toBe(false);
    expect(JSON.stringify(campaign().playerEmu.pcs[0].chart)).toBe(before);
  });

  it('Remove PC clears it from the roster', async () => {
    addPc('Doomed');
    await withDialogs({ confirm: true }, () => click('[data-pc-rm="1"]'));
    expect($$('.pe-pc')).toHaveLength(0);
  });
});

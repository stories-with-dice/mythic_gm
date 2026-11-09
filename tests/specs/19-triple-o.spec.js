/* Triple-O tab (17c-tab-triple-o.js), its tables (01b-triple-o-tables.js)
   and its slice of the state model (freshTripleO / sanitizeTripleO in 03). */

describe('Triple-O — tables and helpers', () => {

  beforeEach(resetApp);

  it('has 14 d66 tables of 36 rows, all registered as editable random tables', () => {
    expect(TRIPLE_O_TABLES).toHaveLength(14);
    TRIPLE_O_TABLES.forEach(t => {
      expect(t.rows).toHaveLength(36);
      expect(RANDOM_TABLE_BY_KEY[t.key].sides).toBe(36);
      expect(RANDOM_TABLE_BY_KEY[t.key].group).toBe('Triple-O');
    });
    expect(TRIPLE_O_TABLES.filter(t => t.kind === 'spark')).toHaveLength(7);
  });

  it('spot-checks the transcription against the zine (d66 order)', () => {
    const at = (key, code) => tableEntry(key, tripleOIndex(Number(code[0]), Number(code[1])));
    expect(at('toAction', '11')).toBe('Abort');
    expect(at('toAction', '52')).toBe('Knock down');
    expect(at('toFocus', '65')).toBe('Wits');
    expect(at('toMotivation', '43')).toBe('Legacy');
    expect(at('toDisposition', '36')).toBe('Guarded');
    expect(at('toDynamics', '31')).toBe('Envious');
    expect(at('toMethod', '36')).toBe('Observation');
    expect(at('toApproaches', '66')).toBe('Stubbornly');
    expect(at('toCombat', '44')).toBe('Hold position and guard');
    expect(at('toSocial', '25')).toBe('Confide a secret');
    expect(at('toPlanning', '55')).toBe('Split the party');
    expect(at('toDelving', '66')).toBe('Toss something ahead to test a room');
  });

  it('tripleOBand: 4-6 Obvious, 2-3 Option, 1 Odd', () => {
    expect([1, 2, 3, 4, 5, 6].map(tripleOBand)).toEqual(['odd', 'option', 'option', 'obvious', 'obvious', 'obvious']);
  });

  it('tripleORoll gives the d66 code and the opposite combination', async () => {
    await withRolls([3, 4], () => {
      const r = tripleORoll('toCombat');
      expect(r.code).toBe('34');
      expect(r.text).toBe('Fall back and regroup');
      expect(r.opp.code).toBe('43');
      expect(r.opp.text).toBe('Help or assist an ally’s action');
    });
    await withRolls([2, 2], () => { expect(tripleORoll('toCombat').opp).toBeNull(); });
  });

  it('tripleORank: highest roll = Obvious; ties roll all three again', async () => {
    await withRolls([4, 5, 2], () => {
      const r = tripleORank(['Camp', 'Delve', 'Split']);
      expect(r.order.map(o => o.text)).toEqual(['Delve', 'Camp', 'Split']);
      expect(r.rerolls).toBe(0);
    });
    await withRolls([3, 3, 1, 6, 2, 4], () => {
      const r = tripleORank(['A', 'B', 'C']);
      expect(r.rerolls).toBe(1);
      expect(r.order.map(o => o.text)).toEqual(['A', 'C', 'B']);
    });
  });

  it('a campaign edit of a Triple-O table is used by the rolls', async () => {
    campaign().tables.toAction = ['Wait', 'Run'];
    await withRolls([1, 1], () => { expect(tripleORoll('toAction').text).toBe('Wait'); });
    await withRolls([6, 6], () => { expect(tripleORoll('toAction').text).toBe('Run'); });
  });
});

describe('Triple-O — sanitizeTripleO', () => {

  it('falls back to a fresh state on junk', () => {
    expect(sanitizeTripleO(null)).toEqual(freshTripleO());
    expect(sanitizeTripleO('x')).toEqual(freshTripleO());
    expect(sanitizeCampaign(null)).toEqual(freshCampaign());
  });

  it('cleans characters, Traits, party Traits and the draft', () => {
    const traits = Array.from({ length: 15 }, (_, i) => ({ text: 'T' + i, status: i === 0 ? 'prevalent' : 'weird', category: 'TOOLONGCAT' }));
    const out = sanitizeTripleO({
      chars: [
        { id: 4, name: '  Bran  ', details: 'Stocky', traits: [{ text: '' }, ...traits] },
        { id: 4, name: '', traits: 'nope' },
        'junk'
      ],
      nextCharId: 2,
      party: [{ text: 'Rest when hurt', status: 'temporary' }, { status: 'default' }],
      draft: { mode: 'bogus', who: 4, obvious: 'Open it', doubleDown: 1 }
    });
    expect(out.chars).toHaveLength(2);
    expect(out.chars[0].name).toBe('Bran');
    expect(out.chars[0].traits).toHaveLength(TRIPLE_O_MAX_TRAITS);
    expect(out.chars[0].traits[0]).toEqual({ text: 'T0', status: 'prevalent', category: 'TOOLON' });
    expect(out.chars[0].traits[1].status).toBe('default');
    expect(out.chars[1].name).toBe('Unnamed character');
    expect(out.chars[1].id).toBe(5);              // duplicate id gets a fresh one
    expect(out.nextCharId).toBe(6);
    expect(out.party).toEqual([{ text: 'Rest when hurt', status: 'temporary', category: '' }]);
    expect(out.draft.mode).toBe('action');
    expect(out.draft.who).toBe(4);
    expect(out.draft.obvious).toBe('Open it');
    expect(out.draft.doubleDown).toBe(true);
  });

  it('drops a draft character that does not exist, and any character in group mode', () => {
    expect(sanitizeTripleO({ chars: [], draft: { who: 9 } }).draft.who).toBeNull();
    expect(sanitizeTripleO({ chars: [{ id: 1, name: 'A' }], draft: { mode: 'group', who: 1 } }).draft.who).toBeNull();
  });
});

describe('Triple-O — tab UI', () => {

  beforeEach(resetApp);

  const addChar = (name) => {
    setValue('#toNewChar', name);
    click('#btnToAddChar');
    return tripleO().chars[tripleO().chars.length - 1];
  };

  it('is the last tab and renders the check, the tables and the Trait Sheets', () => {
    expect(TABS[TABS.length - 1].id).toBe('tripleO');
    const host = showTab('tripleO');
    expect(host).toContain('Triple-O Check');
    expect(host).toContain('Random tables');
    expect(host).toContain('Trait Sheets');
    expect($$('[data-to-mode]')).toHaveLength(4);
  });

  it('the ? shows the "How it works" flowchart, and Help embeds it', () => {
    showTab('tripleO');
    click('[data-intro-toggle="tripleO"]');
    expect($('#panelHost .pub-flow')).toBeTruthy();
    expect($('#panelHost')).toContain('Double-Down');
    click('#btnHelp');
    expect($('#help-tripleo .pub-flow')).toBeTruthy();
    expect($('#help-credits')).toContain('CC BY-SA 4.0');
  });

  it('adds a Trait Sheet, opens it for editing, and selects it for the Check', () => {
    showTab('tripleO');
    const ch = addChar('Bran, the Warrior');
    expect(ch.name).toBe('Bran, the Warrior');
    expect(tripleO().draft.who).toBe(ch.id);
    expect($(`[data-to-name="${ch.id}"]`)).toBeTruthy();
    expect(lastLog().md).toContain('Trait Sheet added');
  });

  it('lists every character under the Check, one per row; a click picks or clears who acts', () => {
    showTab('tripleO');
    const a = addChar('Bran');
    const b = addChar('Mira');
    expect($$('[data-to-who]')).toHaveLength(2);
    expect(tripleO().draft.who).toBe(a.id);          // the first character added is picked
    click(`[data-to-who="${b.id}"]`);
    expect(tripleO().draft.who).toBe(b.id);
    expect($(`[data-to-who="${b.id}"]`).getAttribute('aria-pressed')).toBe('true');
    click(`[data-to-who="${b.id}"]`);
    expect(tripleO().draft.who).toBeNull();
    click('[data-to-mode="group"]');
    expect($('[data-to-who]')).toBeFalsy();
    expect($('.to-who.party')).toContain('The party');
    expect($$('.to-who-list .to-who')).toHaveLength(3);
  });

  it('a click on a Trait chip under Who acts? cycles Default → Prevalent → Temporary → Default', () => {
    showTab('tripleO');
    const ch = addChar('Bran');
    ch.traits.push({ text: 'Brave', status: 'default', category: '' });
    tripleO().party.push({ text: 'Rest when hurt', status: 'default', category: '' });
    persist(); renderActive();
    click(`[data-to-tstat="${ch.id}:0"]`);
    expect(ch.traits[0].status).toBe('prevalent');
    expect(tripleO().draft.who).toBe(ch.id);            // a chip click does not change who acts
    click(`[data-to-tstat="${ch.id}:0"]`);
    expect(ch.traits[0].status).toBe('temporary');
    click(`[data-to-tstat="${ch.id}:0"]`);
    expect(ch.traits[0].status).toBe('default');
    click('[data-to-mode="group"]');
    click('[data-to-tstat="party:0"]');
    expect(tripleO().party[0].status).toBe('prevalent');
  });

  it('tripleORollTrait weighs a Prevalent Trait twice', async () => {
    const items = [
      { owner: 'A', trait: { text: 'One', status: 'default' } },
      { owner: 'A', trait: { text: 'Two', status: 'prevalent' } },
      { owner: 'A', trait: { text: 'Three', status: 'temporary' } }
    ];
    const pick = n => withRolls([n], () => tripleORollTrait(items));
    expect((await pick(1)).trait.text).toBe('One');
    expect((await pick(2)).trait.text).toBe('Two');
    expect((await pick(3)).trait.text).toBe('Two');
    expect((await pick(4)).trait.text).toBe('Three');
    expect((await pick(4)).total).toBe(4);
    expect(tripleORollTrait([])).toBeNull();
  });

  it('Roll a Trait rolls on the picked character, logs it, and can fill an entry', async () => {
    showTab('tripleO');
    const ch = addChar('Bran');
    expect($('#btnToTraitRoll').disabled).toBe(true);   // no Traits yet
    ch.traits.push({ text: 'Brave', status: 'default', category: '' }, { text: 'Greedy', status: 'prevalent', category: '' });
    persist(); renderActive();
    await withRolls([3], () => click('#btnToTraitRoll'));
    expect($('#toTraitResult')).toContain('Greedy');
    expect($('#toTraitResult')).toContain('1d3');
    expect(lastLog().md).toContain('Trait roll');
    expect(lastLog().md).toContain('weighted ×2');
    click('[data-to-trait-use="option"]');
    expect(tripleO().draft.option).toBe('Greedy');
    expect($('#toTraitResult')).toContain('Copied to The Option');
    click(`[data-to-who="${ch.id}"]`);                  // no character picked → disabled
    expect($('#btnToTraitRoll').disabled).toBe(true);
  });

  it('in group mode Roll a Trait uses the party and every character', async () => {
    showTab('tripleO');
    const ch = addChar('Bran');
    ch.traits.push({ text: 'Brave', status: 'default', category: '' });
    tripleO().party.push({ text: 'Rest when hurt', status: 'default', category: '' });
    persist();
    click('[data-to-mode="group"]');
    await withRolls([2], () => click('#btnToTraitRoll'));
    expect($('#toTraitResult')).toContain('Bran');
    expect($('#toTraitResult')).toContain('Brave');
  });

  it('puts the Random tables card below the Trait Sheets', () => {
    const titles = $$('h3.block-title', showTab('tripleO')).map(h => h.textContent);
    expect(titles.indexOf('Random tables')).toBeGreaterThan(titles.indexOf('Trait Sheets'));
    expect(titles.indexOf('Trait Sheets')).toBeGreaterThan(titles.indexOf('Triple-O Check'));
  });

  it('a closed Trait Sheet is one compact row with its Trait counts', () => {
    showTab('tripleO');
    const ch = addChar('Bran');
    setValue(`#toNewTrait_${ch.id}`, 'Leader');
    click(`[data-to-trait-add="${ch.id}"]`);
    click(`[data-to-edit="${ch.id}"]`);
    expect($('.to-sheet-row')).toContain('1 Default');
    expect($('.to-sheet.editing')).toBeFalsy();
  });

  it('adds, edits, re-statuses and removes Traits', () => {
    showTab('tripleO');
    const ch = addChar('Bran');
    setValue(`#toNewTrait_${ch.id}`, 'Charismatic leader');
    click(`[data-to-trait-add="${ch.id}"]`);
    expect(ch.traits).toEqual([{ text: 'Charismatic leader', status: 'default', category: '' }]);

    setValue(`[data-to-text="${ch.id}:0"]`, 'Born leader');
    setValue(`[data-to-cat="${ch.id}:0"]`, 'PR');
    expect(ch.traits[0].text).toBe('Born leader');
    expect(ch.traits[0].category).toBe('PR');

    setValue(`[data-to-status="${ch.id}:0"]`, 'prevalent');
    expect(ch.traits[0].status).toBe('prevalent');
    expect($(`.to-trait-row.prevalent`)).toBeTruthy();

    click(`[data-to-edit="${ch.id}"]`);   // Done → view mode with chips
    expect($('.to-trait.prevalent')).toContain('Born leader');

    click(`[data-to-edit="${ch.id}"]`);
    click(`[data-to-trait-rm="${ch.id}:0"]`);
    expect(ch.traits).toHaveLength(0);
  });

  it('Spark a Trait rolls the chosen table and adds the word with its category', async () => {
    showTab('tripleO');
    const ch = addChar('Ranger');
    setValue(`#toSparkTrait_${ch.id}`, 'toMotivation');
    await withRolls([4, 5], () => click(`[data-to-trait-spark="${ch.id}"]`));
    expect(ch.traits[0]).toEqual({ text: 'Loyalty', status: 'default', category: 'MT' });
    expect(lastLog().md).toContain('Loyalty');
  });

  it('a 1d6 Action check picks the band, shows it and logs all three entries', async () => {
    showTab('tripleO');
    const ch = addChar('Wizard');
    setValue('#toEntry_obvious', 'Open the grimoire');
    setValue('#toEntry_option', 'Cast detect magic first');
    await withRolls([3], () => click('#btnToCheck'));
    expect($('#toCheckResult')).toContain('The Option');
    expect($('#toCheckResult')).toContain('Cast detect magic first');
    const md = lastLog().md;
    expect(md).toContain('Triple-O Check — Action');
    expect(md).toContain('(Wizard)');
    expect(md).toContain('The Odd: (blank)');
    // the result survives an unrelated re-render
    renderActive();
    expect($('#toCheckResult')).toContain('Cast detect magic first');
    expect(ch.traits).toHaveLength(0);
  });

  it('an undefined band says so', async () => {
    showTab('tripleO');
    setValue('#toEntry_obvious', 'Open it');
    await withRolls([1], () => click('#btnToCheck'));
    expect($('#toCheckResult')).toContain('not defined yet');
  });

  it('Double-Down with two different results waits for a pick', async () => {
    showTab('tripleO');
    setValue('#toEntry_obvious', 'Let the thief cook');
    setValue('#toEntry_option', 'The warrior cooks');
    $('#toDoubleDown').checked = true;
    $('#toDoubleDown').dispatchEvent(new Event('change'));
    const before = logEntries().length;
    await withRolls([5, 2], () => click('#btnToCheck'));
    expect($$('[data-to-keep]')).toHaveLength(2);
    expect(logEntries().length).toBe(before);
    click('[data-to-keep="1"]');
    expect($('#toCheckResult')).toContain('The warrior cooks');
    expect(lastLog().md).toContain('2d6 5/2, kept 2');
  });

  it('Double-Down doubles on an Action can mark a Trait Prevalent', async () => {
    showTab('tripleO');
    const ch = addChar('Bran');
    setValue(`#toNewTrait_${ch.id}`, 'Grew up on a farm');
    click(`[data-to-trait-add="${ch.id}"]`);
    setValue('#toEntry_option', 'Offers to cook');
    $('#toDoubleDown').checked = true;
    $('#toDoubleDown').dispatchEvent(new Event('change'));
    await withRolls([3, 3], () => click('#btnToCheck'));
    expect($('#toCheckResult')).toContain('becomes more prevalent');
    expect(lastLog().md).toContain('**Doubles**');
    click('#btnToDoublesMark');
    expect(ch.traits[0].status).toBe('prevalent');
    expect(lastLog().md).toContain('marked Prevalent');
  });

  it('doubles on a Check add a Temporary condition Trait', async () => {
    showTab('tripleO');
    const ch = addChar('Bran');
    click('[data-to-mode="check"]');
    setValue('#toEntry_obvious', 'Fends off the spider, gets bitten');
    $('#toDoubleDown').checked = true;
    $('#toDoubleDown').dispatchEvent(new Event('change'));
    await withRolls([6, 6], () => click('#btnToCheck'));
    setValue('#toDoublesText', 'Injured forearm');
    click('#btnToDoublesAdd');
    expect(ch.traits[0]).toEqual({ text: 'Injured forearm', status: 'temporary', category: 'CN' });
  });

  it('a Question shows its text in the result and the log', async () => {
    showTab('tripleO');
    click('[data-to-mode="question"]');
    setValue('#toQuestion', 'Would she check the plinth?');
    setValue('#toEntry_odd', 'No, she grabs the crystal ball');
    await withRolls([1], () => click('#btnToCheck'));
    expect($('#toCheckResult')).toContain('Would she check the plinth?');
    expect(lastLog().md).toContain('*Would she check the plinth?*');
  });

  it('Group Action: Rank by dice reorders the courses; doubles add a party Trait', async () => {
    showTab('tripleO');
    click('[data-to-mode="group"]');
    expect($('[data-to-who]')).toBeFalsy();
    setValue('#toEntry_obvious', 'Camp');
    setValue('#toEntry_option', 'Delve');
    setValue('#toEntry_odd', 'Split up');
    await withRolls([4, 5, 2], () => click('#btnToRank'));
    expect(tripleO().draft.obvious).toBe('Delve');
    expect(tripleO().draft.option).toBe('Camp');
    expect($('#toEntry_obvious').value).toBe('Delve');
    expect(lastLog().md).toContain('Group Action ranked');

    $('#toDoubleDown').checked = true;
    $('#toDoubleDown').dispatchEvent(new Event('change'));
    await withRolls([4, 4], () => click('#btnToCheck'));
    setValue('#toDoublesText', 'Rest when hurt');
    click('#btnToDoublesParty');
    expect(tripleO().party).toEqual([{ text: 'Rest when hurt', status: 'default', category: '' }]);
  });

  it('Rank by dice asks for all three courses first', () => {
    showTab('tripleO');
    click('[data-to-mode="group"]');
    setValue('#toEntry_obvious', 'Camp');
    click('#btnToRank');
    expect($('#toRankResult')).toContain('Write all three');
  });

  it('a spark combo fills an entry or becomes a Trait of the selected character', async () => {
    showTab('tripleO');
    const ch = addChar('Warrior');
    await withRolls([6, 1, 6, 5], () => click('[data-to-spark="af"]'));
    expect($('#toSparkResult')).toContain('Probe');
    expect($('#toSparkResult')).toContain('Wits');
    click('[data-to-use="option"]');
    expect(tripleO().draft.option).toBe('Probe + Wits');
    expect($('#toSparkResult')).toContain('Copied to The Option');
    expect($('#toEntry_option').value).toBe('Probe + Wits');
    click('#btnToSparkTrait');
    expect(ch.traits[0].text).toBe('Probe + Wits');
  });

  it('a specific table shows the opposite combination', async () => {
    showTab('tripleO');
    await withRolls([2, 5], () => click('[data-to-spark="toSocial"]'));
    expect($('#toSparkResult')).toContain('Confide a secret');
    expect($('#toSparkResult')).toContain('Opposite combination 52');
  });

  it('party Traits can be added and removed by hand', () => {
    showTab('tripleO');
    setValue('#toNewParty', 'Never split up');
    click('#btnToAddParty');
    expect(tripleO().party).toHaveLength(1);
    click('[data-to-party-rm="0"]');
    expect(tripleO().party).toHaveLength(0);
  });

  it('removing a character asks first and clears it from the Check', async () => {
    showTab('tripleO');
    const ch = addChar('Thief');
    await withDialogs({ confirm: true }, () => click(`[data-to-rm="${ch.id}"]`));
    expect(tripleO().chars).toHaveLength(0);
    expect(tripleO().draft.who).toBeNull();
  });

  it('escapes user text in sheets, entries and results', async () => {
    showTab('tripleO');
    const ch = addChar('<img src=x onerror=alert(1)>');
    setValue(`#toNewTrait_${ch.id}`, '"><b>x</b>');
    click(`[data-to-trait-add="${ch.id}"]`);
    setValue('#toEntry_obvious', '<script>bad()</script>');
    await withRolls([6], () => click('#btnToCheck'));
    expect($('#panelHost img[src="x"]')).toBeFalsy();
    expect($('#panelHost script')).toBeFalsy();
    expect($('#toCheckResult')).toContain('<script>bad()</script>');
  });

  it('the draft survives a re-render and a reload of the campaign', () => {
    showTab('tripleO');
    setValue('#toEntry_odd', 'Walks away');
    renderActive();
    expect($('#toEntry_odd').value).toBe('Walks away');
    const copy = sanitizeCampaign(JSON.parse(JSON.stringify(campaign())));
    expect(copy.tripleO.draft.odd).toBe('Walks away');
  });

  it('the Reference tables card lists every table', () => {
    showTab('tripleO');
    click('#btnToRefToggle');
    expect($$('.to-ref-grid table')).toHaveLength(14);
    expect($('.to-ref-grid')).toContain('Stubbornly');
  });

  it('the Triple-O tables are in the Settings editors', () => {
    click('#btnSettings');
    expect($('#settingsTables')).toContain('Triple-O');
    expect($('[data-settings-table="rt_toCombat"]')).toBeTruthy();
  });
});

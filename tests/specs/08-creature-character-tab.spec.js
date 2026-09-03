/* Creature Crafter (09) + Character Crafter (10) tab UIs. */

describe('Creature Crafter tab', () => {

  beforeEach(() => { resetApp(); showTab('creature'); });

  it('Roll 2 descriptor words shows two chips and logs them', async () => {
    await withRolls([1, 2], () => click('#btnCreatureDescriptors'));
    expect($$('#creatureDescResult .word-chip')).toHaveLength(2);
    expect($('#creatureDescResult')).toContain(CREATURE_DESCRIPTORS[0]);
    expect(lastLog().section).toBe('Creature Crafter');
  });

  it('+ one more word appends without clearing the list', async () => {
    await withRolls([1, 2], () => click('#btnCreatureDescriptors'));
    await withRolls([3], () => click('#btnCreatureMoreWord'));
    expect($$('#creatureDescResult .word-chip')).toHaveLength(3);
  });

  it('Roll 1d10 modifier maps through STAT_MOD', async () => {
    await withRolls([4], () => click('#btnCreatureStat'));
    expect($('#creatureStatResult')).toContain(STAT_MOD[4]);
  });

  it('Initial Behavior of 10 auto-rolls an Ability word pair', async () => {
    await withRolls([10, 1, 2], () => click('#btnInitialBehavior'));
    expect($('#initialBehaviorResult')).toContain('Ability triggered');
    expect($$('#initialBehaviorResult .word-chip')).toHaveLength(2);
    expect(lastLog().md).toContain('Ability rolled');
  });

  it('Roll 2 ability words renders a pair', async () => {
    await withRolls([1, 100], () => click('#btnAbility'));
    expect($$('#abilityResult .word-chip')).toHaveLength(2);
  });
});

describe('Character Crafter tab', () => {

  beforeEach(() => { resetApp(); showTab('character'); });

  it('each category "Roll word" button sets one word and logs the category', async () => {
    const rollBtn = $$('.btnCharRoll').find(b => b.dataset.cat === 'identity');
    await withRolls([1], () => click(rollBtn));
    expect($('#charWords_identity')).toContain(CHARACTER_DESCRIPTORS[0]);
    expect(lastLog().md).toContain('Identity Descriptor');
  });

  it('"+ more" appends and "Clear" empties that category only', async () => {
    const cat = 'mind';
    await withRolls([1], () => click($$('.btnCharRoll').find(b => b.dataset.cat === cat)));
    await withRolls([2], () => click($$('.btnCharMore').find(b => b.dataset.cat === cat)));
    expect($$('#charWords_' + cat + ' .word-chip')).toHaveLength(2);
    click($$('.btnCharClear').find(b => b.dataset.cat === cat));
    expect($('#charWords_' + cat)).toContain('Nothing rolled yet');
  });

  it('NPC Statistics roll maps through NPC_STAT_MOD', async () => {
    await withRolls([10], () => click('#btnNpcStat'));
    expect($('#npcStatResult')).toContain(NPC_STAT_MOD[10]);
  });

  it('Behavior Context rolls 1d100 and renders a result', async () => {
    await withRolls([50], () => click('#btnBehaviorContext'));
    expect($('#behaviorContextResult .result-box')).toBeTruthy();
    expect(lastLog().section).toBe('Character Crafter');
  });
});

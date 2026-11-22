/* Character Arc tab (17d-tab-character-arc.js), its state (freshArc /
   sanitizeArc in 03), its trait-pair table (01), and the hidden tabs in
   Settings (21-settings.js, setTabShown() in 04). */

describe('Character Arc — rules', () => {

  beforeEach(resetApp);

  it('arcTest: under the number = should, +1; over = could, -1', async () => {
    await withRolls([3], () => {
      expect(arcTest(6)).toEqual({ rolls: [3], side: 'should', from: 6, to: 7, shift: 1 });
    });
    await withRolls([9], () => {
      expect(arcTest(7)).toEqual({ rolls: [9], side: 'could', from: 7, to: 6, shift: 1 });
    });
  });

  it('arcTest: a tie rolls again and moves one point per roll made', async () => {
    await withRolls([6, 6, 2], () => {
      const t = arcTest(6);
      expect(t.rolls).toEqual([6, 6, 2]);
      expect(t.side).toBe('should');
      expect(t.to).toBe(9);
    });
    await withRolls([7, 12], () => {
      const t = arcTest(7);
      expect(t.side).toBe('could');
      expect(t.to).toBe(5);
    });
  });

  it('arcTest clamps the number to 1-12', async () => {
    await withRolls([11, 11, 1], () => { expect(arcTest(11).to).toBe(12); });
    await withRolls([2, 2, 12], () => { expect(arcTest(2).to).toBe(1); });
  });

  it('arcAct5: 12 = should, 1 = could, else the arc goes on', () => {
    expect(arcAct5(12)).toBe('should');
    expect(arcAct5(1)).toBe('could');
    expect(arcAct5(6)).toBeNull();
    expect(arcShouldChance(1)).toBe(0);
    expect(arcShouldChance(12)).toBe(1);
  });

  it('the trait pairs are a d66 table in RANDOM_TABLES; arcRollPair splits a row', async () => {
    expect(ARC_TRAIT_PAIRS).toHaveLength(36);
    expect(RANDOM_TABLE_BY_KEY.arcTraitPairs.sides).toBe(36);
    ARC_TRAIT_PAIRS.forEach(r => expect(r).toContain(' / '));
    await withRolls([1, 2], () => {
      expect(arcRollPair()).toEqual({ code: '12', should: 'Honest', could: 'Deceitful' });
    });
    expect(arcSplitPair('Brave')).toEqual({ should: 'Brave', could: '' });
  });

  it('sanitizeArc drops junk, clamps the number, and keeps axis ids unique', () => {
    expect(sanitizeArc(null)).toEqual(freshArc());
    const s = sanitizeArc({
      chars: [
        { id: 1, name: ' Juliet ', axes: [{ id: 1, should: 'Loyalty', could: 'Passion', value: 40, tests: 3 }, { should: '', could: 'x' }] },
        { id: 1, name: '', axes: [{ id: 1, should: '<b>Faith', could: 'Fear', value: 'x' }] },
        'junk'
      ],
      nextCharId: 0, nextAxisId: 0
    });
    expect(s.chars).toHaveLength(2);
    expect(s.chars[0].name).toBe('Juliet');
    expect(s.chars[0].axes).toEqual([{ id: 1, should: 'Loyalty', could: 'Passion', value: 12, tests: 3 }]);
    expect(s.chars[1].name).toBe('Unnamed character');
    expect(s.chars[1].id).toBe(2);
    expect(s.chars[1].axes[0].should).toBe('bFaith');
    expect(s.chars[1].axes[0].value).toBe(6);
    expect(s.chars[1].axes[0].id).toBe(2);
    expect(s.nextCharId).toBe(3);
    expect(s.nextAxisId).toBe(3);
    expect(sanitizeCampaign(null)).toEqual(freshCampaign());
  });
});

describe('Character Arc — tab', () => {

  beforeEach(resetApp);

  const addChar = name => {
    setValue('#arcNewChar', name);
    click('#btnArcAddChar');
    return arcState().chars[arcState().chars.length - 1];
  };
  const addAxis = (c, should, could, start = '6') => {
    setValue(`#arcShould_${c.id}`, should);
    setValue(`#arcCould_${c.id}`, could);
    setValue(`#arcStart_${c.id}`, start);
    click(`[data-arc-axis-add="${c.id}"]`);
    return c.axes[c.axes.length - 1];
  };

  it('is in the Players group and adds a character with a log line', () => {
    expect(TABS.find(t => t.id === 'arc').group).toBe('players');
    showTab('arc');
    const c = addChar('Juliet');
    expect(c.name).toBe('Juliet');
    expect(lastLog().md).toContain('Juliet');
    expect($('[data-arc-name]').value).toBe('Juliet');
  });

  it('adds an axis at 6, 7, or a coin flip', async () => {
    showTab('arc');
    const c = addChar('Juliet');
    expect(addAxis(c, 'Loyalty', 'Passion', '7').value).toBe(7);
    await withRolls([1], () => { expect(addAxis(c, 'Insecurity', 'Independence', 'coin').value).toBe(6); });
    expect(lastLog().md).toContain('coin flip');
    expect($$('.arc-axis')).toHaveLength(2);
    expect($$('.arc-cell')).toHaveLength(24);
  });

  it('an axis needs both traits', () => {
    showTab('arc');
    const c = addChar('Juliet');
    setValue(`#arcShould_${c.id}`, 'Loyalty');
    click(`[data-arc-axis-add="${c.id}"]`);
    expect(c.axes).toHaveLength(0);
  });

  it('the suggestion buttons fill the New axis fields from the trait pairs', async () => {
    showTab('arc');
    const c = addChar('Gawain');
    await withRolls([1, 6], () => click(`[data-arc-suggest="${c.id}:pair"]`));
    expect($(`#arcShould_${c.id}`).value).toBe('Faith');
    expect($(`#arcCould_${c.id}`).value).toBe('Fear');
    await withRolls([1, 5], () => click(`[data-arc-suggest="${c.id}:should"]`));
    expect($(`#arcShould_${c.id}`).value).toBe('Duty');
    expect($(`#arcCould_${c.id}`).value).toBe('Fear');
    await withRolls([1, 1], () => click(`[data-arc-suggest="${c.id}:could"]`));
    expect($(`#arcShould_${c.id}`).value).toBe('Duty');
    expect($(`#arcCould_${c.id}`).value).toBe('Selfish');
  });

  it('Test rolls a d12, moves the number, logs it, and the result survives a re-render', async () => {
    showTab('arc');
    const c = addChar('Juliet');
    const a = addAxis(c, 'Loyalty', 'Passion', '6');
    await withRolls([6, 9], () => click(`[data-arc-test="${a.id}"]`));
    expect(a.value).toBe(4);
    expect(a.tests).toBe(1);
    expect(lastLog().md).toContain('d12 6, 9');
    expect(lastLog().md).toContain('**Passion** (could)');
    expect(lastLog().md).toContain('6 → 4');
    renderActive();
    expect($(`[data-arc-result="${a.id}"]`)).toContain('Passion');
    expect($('.arc-cell.last').textContent).toBe('9');
    expect($('.arc-cell.mark').textContent).toBe('4');
  });

  it('reaching 12 is Act 5: Test is disabled', async () => {
    showTab('arc');
    const c = addChar('Juliet');
    const a = addAxis(c, 'Loyalty', 'Passion', '7');
    a.value = 11; persist(); renderActive();
    await withRolls([3], () => click(`[data-arc-test="${a.id}"]`));
    expect(a.value).toBe(12);
    expect(lastLog().md).toContain('Act 5');
    expect($(`[data-arc-test="${a.id}"]`).disabled).toBe(true);
    expect($('.arc-done')).toContain('Loyalty');
  });

  it('the ±1 buttons correct the number by hand', () => {
    showTab('arc');
    const c = addChar('Juliet');
    const a = addAxis(c, 'Loyalty', 'Passion', '6');
    click(`[data-arc-shift="${a.id}:1"]`);
    expect(a.value).toBe(7);
    click(`[data-arc-shift="${a.id}:-1"]`);
    expect(a.value).toBe(6);
    expect(lastLog().md).toContain('by hand');
  });

  it('Remove axis and Remove character offer Undo', () => {
    showTab('arc');
    const c = addChar('Juliet');
    const a = addAxis(c, 'Loyalty', 'Passion', '6');
    click(`[data-arc-axis-rm="${a.id}"]`);
    expect(c.axes).toHaveLength(0);
    click('#btnToastUndo');
    expect(arcChar(c.id).axes[0].should).toBe('Loyalty');
    click(`[data-arc-char-rm="${c.id}"]`);
    expect(arcState().chars).toHaveLength(0);
    click('#btnToastUndo');
    expect(arcState().chars[0].name).toBe('Juliet');
  });

  it('escapes user text in the markup', () => {
    showTab('arc');
    const c = addChar('<img src=x onerror=1>');
    expect($('#panelHost img')).toBeNull();
    expect(c.name).toBe('<img src=x onerror=1>');
  });
});

describe('Hidden tabs (Settings → Tabs)', () => {

  beforeEach(resetApp);

  it('sanitizeUi keeps a clean `hidden` list', () => {
    expect(sanitizeUi({ hidden: ['gm', 'gm', 3, ''] }).hidden).toEqual(['gm']);
    expect(freshUi().hidden).toEqual([]);
  });

  it('a cleared box hides the tab from the tab bar and saves it in the campaign', () => {
    openSettings();
    expect($$('[data-settings-tab]')).toHaveLength(TABS.length);
    const box = $('[data-settings-tab="mystery"]');
    box.checked = false;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect($('#tabNav [data-tab="mystery"]')).toBeNull();
    expect(campaign().ui.hidden).toEqual(['mystery']);
    const again = $('[data-settings-tab="mystery"]');
    again.checked = true;
    again.dispatchEvent(new Event('change', { bubbles: true }));
    expect($('#tabNav [data-tab="mystery"]')).toBeTruthy();
    expect(campaign().ui.hidden).toEqual([]);
  });

  it('hiding the main tab moves the main pane; hiding the split tab closes the split', () => {
    showTab('gm');
    rightClickTab('arc');
    expect(rightTab).toBe('arc');
    setTabShown('gm', false);
    expect(currentTab).toBe('gme');
    setTabShown('arc', false);
    expect(rightTab).toBeNull();
  });

  it('a group with no shown tab leaves the tab bar, and the last shown tab stays', () => {
    ['playerEmu', 'tripleO', 'arc'].forEach(id => setTabShown(id, false));
    expect($$('#tabNav .tab-group')).toHaveLength(TAB_GROUPS.length - 1);
    TABS.forEach(t => setTabShown(t.id, false));
    expect(shownTabs()).toHaveLength(1);
    openSettings();
    expect($$('[data-settings-tab]:disabled')).toHaveLength(1);
  });

  it('each campaign keeps its own list', async () => {
    setTabShown('mystery', false);
    await withDialogs({ prompt: 'Second' }, () => click('#btnNewCampaign'));
    setTabShown('mystery', true);
    setTabShown('location', false);
    STORE.current = Object.keys(STORE.campaigns)[0];
    switchCampaignView();
    expect([...hiddenTabs]).toEqual(['mystery']);
    expect($('#tabNav [data-tab="mystery"]')).toBeNull();
    expect($('#tabNav [data-tab="location"]')).toBeTruthy();
  });
});

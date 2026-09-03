/* Mystery Matrix tab UI + logic (11-tab-mystery-matrix.js). */

describe('Mystery Matrix tab', () => {

  beforeEach(() => { resetApp(); showTab('mystery'); });

  function addBoxViaUI(type, label) {
    setValue('#newBoxLabel', label);
    click(type === 'C' ? '#btnAddClue' : '#btnAddSuspect');
  }

  it('starts empty', () => {
    expect(campaign().mystery.boxes).toHaveLength(0);
    expect($('#panelHost')).toContain('No Clues or Suspects yet');
  });

  it('Add as Clue / Add as Suspect create typed boxes with incrementing uids', () => {
    addBoxViaUI('C', 'Bloody knife');
    addBoxViaUI('S', 'The butler');
    const boxes = campaign().mystery.boxes;
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toEqual({ uid: 1, type: 'C', label: 'Bloody knife', connections: [] });
    expect(boxes[1].uid).toBe(2);
    expect(boxes[1].type).toBe('S');
    expect(lastLog().md).toContain('Added Suspect');
  });

  it('a blank label rolls two Mystery descriptor words instead', async () => {
    await withRolls([1, 2], () => { setValue('#newBoxLabel', ''); click('#btnAddClue'); });
    expect(campaign().mystery.boxes[0].label).toBe(MYSTERY_DESCRIPTORS[0] + ' / ' + MYSTERY_DESCRIPTORS[1]);
  });

  it('checking a matrix cell creates a symmetric Clue<->Suspect connection', () => {
    addBoxViaUI('C', 'clue');
    addBoxViaUI('S', 'suspect');
    const cb = $('input[type="checkbox"][data-clue]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(connectionExists(1, 2)).toBe(true);
    expect(connectionExists(2, 1)).toBe(true);
    expect(lastLog().md).toContain('Connected');
  });

  it('unchecking the same cell removes the connection', () => {
    addBoxViaUI('C', 'clue');
    addBoxViaUI('S', 'suspect');
    let cb = $('input[type="checkbox"][data-clue]');
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
    cb = $('input[type="checkbox"][data-clue]');           // re-queried after re-render
    cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(connectionExists(1, 2)).toBe(false);
  });

  it('a Suspect reaching 6 connections is auto-flagged as the answer', () => {
    for (let i = 0; i < 6; i++) addBoxViaUI('C', 'clue' + i);
    addBoxViaUI('S', 'culprit');
    const suspect = campaign().mystery.boxes.find(b => b.type === 'S');
    campaign().mystery.boxes.filter(b => b.type === 'C').forEach(c => {
      c.connections.push(suspect.uid);
      suspect.connections.push(c.uid);
    });
    checkClincherByConnections();
    expect(campaign().mystery.solvedBoxUid).toBe(suspect.uid);
    expect(lastLog().md).toContain('Automatic Clincher');
  });

  it('Discovery Check with an empty matrix rolls low and finds nothing', async () => {
    await withRolls([10], () => click('#btnDiscoveryCheck'));   // 10 + 0 boxes = 10 => nothing
    expect($('#discoveryResult')).toContain('Nothing useful');
    expect(lastLog().section).toBe('Mystery Matrix');
  });

  it('Discovery Check that lands on newSuspect adds an unconnected Suspect', async () => {
    await withRolls([40, 1, 2], () => click('#btnDiscoveryCheck'));  // 40 + 0 = 40 => newSuspect
    const boxes = campaign().mystery.boxes;
    expect(boxes).toHaveLength(1);
    expect(boxes[0].type).toBe('S');
    expect($('#discoveryResult')).toContain('New Unconnected Suspect');
  });

  it('Reset Matrix clears every box, connection and the solved flag', async () => {
    addBoxViaUI('C', 'a');
    addBoxViaUI('S', 'b');
    await withDialogs({ confirm: true }, () => click('#btnResetMatrix'));
    expect(campaign().mystery.boxes).toHaveLength(0);
    expect(campaign().mystery.nextUid).toBe(1);
    expect(campaign().mystery.solvedBoxUid).toBeNull();
    expect(lastLog().md).toContain('Matrix reset');
  });

  it('Remove (✕) deletes one box and prunes its connections', async () => {
    addBoxViaUI('C', 'clue');
    addBoxViaUI('S', 'suspect');
    const cb = $('input[type="checkbox"][data-clue]');
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
    await withDialogs({ confirm: true }, () => click('[data-rm="1"]'));
    const boxes = campaign().mystery.boxes;
    expect(boxes).toHaveLength(1);
    expect(boxes[0].uid).toBe(2);
    expect(boxes[0].connections).toEqual([]);
  });
});

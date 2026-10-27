/* 3-Act Story tab (17-tab-three-act-story.js) plus its gme.threeAct state
   model / sanitiser. Shares chaosFactor/threads with the Mythic GME tab. */

describe('3-Act Story tab', () => {

  beforeEach(() => { resetApp(); showTab('threeAct'); });

  const ta = () => campaign().gme.threeAct;

  describe('placement + render', () => {
    it('is registered as a tab, after Published Adventures', () => {
      const idx = TABS.findIndex(t => t.id === 'threeAct');
      expect(idx).toBeGreaterThan(-1);
      expect(TABS[idx - 1].id).toBe('pub');
    });
    it('renders without throwing, starting in Act 1', () => {
      const host = showTab('threeAct');
      expect(host).toContain('3-Act Story Structure');
      expect(ta().act).toBe(1);
      expect(ta().phase).toBe('acts');
    });
  });

  describe('"How it works" flowchart (behind the ? intro toggle)', () => {
    it('has no How it works card; the ? shows the intro and the flowchart', () => {
      expect($('#btn3aFlowToggle')).toBeNull();
      expect(document.querySelector('.pub-flow')).toBeNull();
      click('#panelHost [data-intro-toggle]');
      expect($('#panelHost .tool-desc')).toContain('screenwriting');
      expect(document.querySelector('#panelHost .tool-intro-more .pub-flow')).toBeTruthy();
      click('#panelHost [data-intro-toggle]');
      expect(document.querySelector('.pub-flow')).toBeNull();
    });
  });

  describe('The Story Thread card', () => {
    it('is open while no Story Thread is set, and collapsed by default once one is', () => {
      expect($('#btn3aThreadToggle').textContent).toBe('Hide');
      expect($('#threeActThreadInput')).toBeTruthy();
      ta().storyThread = 'Find the journal'; persist(); showTab('threeAct');
      expect($('#btn3aThreadToggle').textContent).toBe('Show');
      expect($('#threeActThreadInput')).toBeNull();
      expect($('#panelHost')).toContain('Story Thread: Find the journal');
    });
    it('Show / Hide override the automatic state', () => {
      click('#btn3aThreadToggle');
      expect($('#threeActThreadInput')).toBeNull();
      expect($('#panelHost')).toContain('No Story Thread yet');
      click('#btn3aThreadToggle');
      expect($('#threeActThreadInput')).toBeTruthy();
    });
  });

  describe('threeActInnerEvent() — inner track sequence', () => {
    it('Act 1: Incident, Introduce NPC, then Story Thread Activity repeats', () => {
      expect(threeActInnerEvent(0, 1)).toBe('incident');
      expect(threeActInnerEvent(0, 2)).toBe('introduceNpc');
      expect(threeActInnerEvent(0, 3)).toBe('threadActivity');
      expect(threeActInnerEvent(0, 4)).toBe('threadActivity');
      expect(threeActInnerEvent(0, 9)).toBe('threadActivity'); // cycles past the end
    });
    it('Act 2: Conflict x3, Progress, Twist, New Conflict, then Story Thread Activity repeats', () => {
      expect(threeActInnerEvent(1, 1)).toBe('conflict');
      expect(threeActInnerEvent(1, 2)).toBe('conflict');
      expect(threeActInnerEvent(1, 3)).toBe('conflict');
      expect(threeActInnerEvent(1, 4)).toBe('progress');
      expect(threeActInnerEvent(1, 5)).toBe('twist');
      expect(threeActInnerEvent(1, 6)).toBe('newConflict');
      expect(threeActInnerEvent(1, 7)).toBe('threadActivity');
      expect(threeActInnerEvent(1, 20)).toBe('threadActivity');
    });
    it('Act 3: Story Thread Activity x3, then Tension repeats', () => {
      expect(threeActInnerEvent(2, 1)).toBe('threadActivity');
      expect(threeActInnerEvent(2, 3)).toBe('threadActivity');
      expect(threeActInnerEvent(2, 4)).toBe('tension');
      expect(threeActInnerEvent(2, 5)).toBe('tension');
      expect(threeActInnerEvent(2, 12)).toBe('tension');
    });
  });

  describe('fireThreeActEvent() — Act Event resolution', () => {
    it('Incident Scene fires only if the Story Thread is not yet established', async () => {
      const fresh = freshThreeAct();
      const res = await withRolls([50, 50], () => fireThreeActEvent('incident', fresh));
      expect(res.lines.join(' ')).toContain('Incident Scene');
      const established = freshThreeAct();
      established.storyThread = 'Find the journal';
      const res2 = fireThreeActEvent('incident', established);
      expect(res2.lines.join(' ')).toContain('already established');
    });
    it('Introduce NPC fires only if no NPC has been introduced yet', async () => {
      const fresh = freshThreeAct();
      const res = await withRolls([50, 50], () => fireThreeActEvent('introduceNpc', fresh));
      expect(res.lines.join(' ')).toContain('Introduce NPC');
      const done = freshThreeAct();
      done.npcIntroduced = true;
      const res2 = fireThreeActEvent('introduceNpc', done);
      expect(res2.lines.join(' ')).toContain('already exists');
    });
    it('Story Thread Activity: 1-5 Move Toward, 6-10 Move Away', async () => {
      const r1 = await withRolls([5, 50, 50], () => fireThreeActEvent('threadActivity', freshThreeAct()));
      expect(r1.lines[0]).toContain('Move Toward');
      const r2 = await withRolls([6, 50, 50], () => fireThreeActEvent('threadActivity', freshThreeAct()));
      expect(r2.lines[0]).toContain('Move Away');
    });
    it('Conflict: 1-4 Move Away, 5-7 PC Negative, 8-10 suggests a new blocking Thread', async () => {
      const low = await withRolls([1, 50, 50], () => fireThreeActEvent('conflict', freshThreeAct()));
      expect(low.lines.join(' ')).toContain('Move Away From A Thread');
      expect(low.addThreadSuggestion).toBeNull();
      const mid = await withRolls([5, 50, 50], () => fireThreeActEvent('conflict', freshThreeAct()));
      expect(mid.lines.join(' ')).toContain('PC Negative');
      const high = await withRolls([8, 50, 50], () => fireThreeActEvent('conflict', freshThreeAct()));
      expect(high.lines.join(' ')).toContain('new Thread');
      expect(high.addThreadSuggestion).toBeTruthy();
    });
    it('Twist?: 1-5 no twist, 6-10 changes the Story Thread', async () => {
      const no = await withRolls([5], () => fireThreeActEvent('twist', freshThreeAct()));
      expect(no.lines.join(' ')).toContain('No Twist');
      const yes = await withRolls([6, 50, 50], () => fireThreeActEvent('twist', freshThreeAct()));
      expect(yes.lines.join(' ')).toContain('Twist!');
    });
    it('New Conflict?: 1-5 nothing, 6-10 re-rolls Conflict', async () => {
      const no = await withRolls([5], () => fireThreeActEvent('newConflict', freshThreeAct()));
      expect(no.lines.join(' ')).toContain('No new conflict');
      const yes = await withRolls([6, 1, 50, 50], () => fireThreeActEvent('newConflict', freshThreeAct()));
      expect(yes.lines.join(' ')).toContain('Conflict');
      expect(yes.lines.join(' ')).toContain('Move Away From A Thread');
    });
    it('Tension always fires (no roll gate)', async () => {
      const res = await withRolls([50, 50], () => fireThreeActEvent('tension', freshThreeAct()));
      expect(res.lines.join(' ')).toContain('Tension');
      expect(res.lines.join(' ')).toContain('PC Negative');
    });
  });

  describe('sanitizeThreeAct()', () => {
    it('falls back to fresh defaults on junk input', () => {
      expect(sanitizeThreeAct(null)).toEqual(freshThreeAct());
      expect(sanitizeThreeAct({ act: 99, phase: 'bogus', outer: 'x', inner: null })).toEqual(freshThreeAct());
    });
    it('clamps outer to 0-4 and act/phase to their enums', () => {
      const s = sanitizeThreeAct({ act: 2, phase: 'closing', outer: [10, -1, 2], inner: [3, -5, 1], storyThread: 'Find it', npcIntroduced: true, pcProtected: true });
      expect(s.act).toBe(2);
      expect(s.phase).toBe('closing');
      expect(s.outer).toEqual([4, 0, 2]);
      expect(s.inner).toEqual([3, 0, 1]);
      expect(s.storyThread).toBe('Find it');
      expect(s.npcIntroduced).toBe(true);
      expect(s.pcProtected).toBe(true);
    });
    it('sanitizeCampaign(null) still deep-equals freshCampaign() for threeAct', () => {
      expect(sanitizeCampaign(null).gme.threeAct).toEqual(freshThreeAct());
    });
  });

  describe('UI — Bookkeeping', () => {
    it('checking a Story Beat marks an outer circle', () => {
      setValue('#threeActThreadInput', 'Find the journal');
      $('.beat-checks input[data-beat="progress"]').checked = true;
      click('#btn3aRecordScene');
      expect(ta().outer[0]).toBe(1);
      expect(ta().inner[0]).toBe(0);
      expect(lastLog().section).toBe('3-Act Story');
    });
    it('checking "Establish Story Thread" saves the typed Story Thread text', () => {
      setValue('#threeActThreadInput', 'Find the journal');
      $('.beat-checks input[data-beat="establish"]').checked = true;
      click('#btn3aRecordScene');
      expect(ta().storyThread).toBe('Find the journal');
      expect(ta().outer[0]).toBe(1);
      // re-render: the "Establish" checkbox is gone once established
      showTab('threeAct');
      expect(document.querySelector('.beat-checks input[data-beat="establish"]')).toBeNull();
    });
    it('checking "Introduce Important NPC(s)" sets npcIntroduced', () => {
      $('.beat-checks input[data-beat="npc"]').checked = true;
      click('#btn3aRecordScene');
      expect(ta().npcIntroduced).toBe(true);
    });
    it('recording a Scene with nothing checked marks an inner circle and fires an Act Event', async () => {
      await withRolls([50, 50], () => click('#btn3aRecordScene'));
      expect(ta().inner[0]).toBe(1);
      expect(ta().outer[0]).toBe(0);
      expect($('#threeActResult .result-box')).toBeTruthy();
    });
    it('reaching the 4th outer circle advances to the next Act', () => {
      const t = ta();
      t.outer[0] = 3;
      persist();
      showTab('threeAct');
      $('.beat-checks input[data-beat="progress"]').checked = true;
      click('#btn3aRecordScene');
      expect(t.outer[0]).toBe(4);
      expect(t.act).toBe(2);
      expect(t.phase).toBe('acts');
    });
    it('completing Act 3 moves to the Resolution phase', () => {
      const t = ta();
      t.act = 3;
      t.outer[2] = 3;
      t.storyThread = 'Find the journal';
      persist();
      showTab('threeAct');
      $('.beat-checks input[data-beat="progress"]').checked = true;
      click('#btn3aRecordScene');
      expect(t.phase).toBe('resolution');
    });
  });

  describe('UI — In Media Res', () => {
    it('is offered only at the very start of Act 1, and fires all three opening events', async () => {
      expect($('#btn3aMediaRes')).toBeTruthy();
      await withRolls([50, 50, 50, 50, 50, 50], () => click('#btn3aMediaRes'));
      const t = ta();
      expect(t.inner[0]).toBe(3);
      expect(t.outer[0]).toBe(3);
      expect(t.npcIntroduced).toBe(true);
      showTab('threeAct');
      expect($('#btn3aMediaRes')).toBeNull(); // no longer offered
    });
  });

  describe('UI — Conflict\'s suggested new Thread', () => {
    it('offers an "Add to Threads List" button on an 8-10 Conflict roll, which adds it', async () => {
      const t = ta();
      t.act = 2;
      persist();
      showTab('threeAct');
      await withRolls([8, 50, 50], () => click('#btn3aRecordScene'));
      const btn = $('#btn3aAddSuggestedThread');
      expect(btn).toBeTruthy();
      const before = g().threads.length;
      click(btn);
      expect(g().threads.length).toBe(before + 1);
      function g(){ return campaign().gme; }
    });
  });

  describe('UI — Resolution / Closing / Done', () => {
    it('walks Resolution -> Closing -> Done, then resets', async () => {
      const t = ta();
      t.phase = 'resolution';
      t.storyThread = 'Find the journal';
      persist();
      showTab('threeAct');
      expect($('#btn3aMarkResolved')).toBeTruthy();
      click('#btn3aMarkResolved');
      expect(t.phase).toBe('closing');
      expect($('#btn3aComplete')).toBeTruthy();
      click('#btn3aComplete');
      expect(t.phase).toBe('done');
      await withDialogs({ confirm: true }, async () => click('#btn3aReset'));
      expect(ta()).toEqual(freshThreeAct());
    });
  });
});

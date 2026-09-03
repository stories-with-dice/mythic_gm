/* State model + import sanitiser (03-state-persistence.js).
   The sanitizeCampaign() invariants documented in AGENTS.md are the contract
   here — each `it` pins one of them. */

describe('state / persistence', () => {

  beforeEach(resetApp);

  describe('freshCampaign()', () => {
    it('has the four top-level sections with default values', () => {
      const c = freshCampaign();
      expect(c.location).toEqual({ pp: 0, regionSize: 'Average', areaCount: 0, complete: false, ppSetupDone: false });
      expect(c.adventure).toEqual({ mainTheme: null });
      expect(c.mystery).toEqual({ boxes: [], nextUid: 1, solvedBoxUid: null });
      expect(c.log).toEqual([]);
    });
  });

  describe('load / save round-trip', () => {
    it('persist() writes STORE to sessionStorage under mythicToolkit_v1', () => {
      addLog('Test', 'hello');
      const raw = JSON.parse(sessionStorage.getItem('mythicToolkit_v1'));
      expect(raw.current).toBe(STORE.current);
      expect(raw.campaigns[raw.current].log[0].md).toBe('hello');
    });
    it('loadStore() falls back to a default store on garbage input', () => {
      sessionStorage.setItem('mythicToolkit_v1', '{not json');
      const s = loadStore();
      expect(Object.keys(s.campaigns)).toHaveLength(1);
      expect(s.current).toBe('Campaign 1');
    });
  });

  describe('sanitizeCampaign()', () => {
    it('returns a full default campaign for non-object input', () => {
      expect(sanitizeCampaign(null)).toEqual(freshCampaign());
      expect(sanitizeCampaign('nope')).toEqual(freshCampaign());
    });

    it('defaults every malformed field individually', () => {
      const c = sanitizeCampaign({
        location: { pp: 'x', regionSize: 'Huge', areaCount: -5, complete: 1 },
        adventure: { mainTheme: 'NotATheme' },
        mystery: 'broken',
        log: 'broken',
      });
      expect(c.location.pp).toBe(0);
      expect(c.location.regionSize).toBe('Average');
      expect(c.location.areaCount).toBe(0);          // clamped >= 0
      expect(c.location.complete).toBe(true);         // coerced from truthy
      expect(c.adventure.mainTheme).toBeNull();       // not in THEMES
      expect(c.mystery).toEqual({ boxes: [], nextUid: 1, solvedBoxUid: null });
      expect(c.log).toEqual([]);
    });

    it('keeps a valid main theme', () => {
      expect(sanitizeCampaign({ adventure: { mainTheme: 'Mystery' } }).adventure.mainTheme).toBe('Mystery');
    });

    it('dedupes mystery boxes by uid (first occurrence wins)', () => {
      const c = sanitizeCampaign({ mystery: { boxes: [
        { uid: 1, type: 'C', label: 'first' },
        { uid: 1, type: 'S', label: 'dupe' },
        { uid: 2, type: 'S', label: 'ok' },
      ] } });
      expect(c.mystery.boxes).toHaveLength(2);
      expect(c.mystery.boxes[0].label).toBe('first');
    });

    it('drops connections that are not exactly one Clue <-> one Suspect', () => {
      const c = sanitizeCampaign({ mystery: { boxes: [
        { uid: 1, type: 'C', label: 'c1', connections: [2, 3, 99] }, // 2 is clue (bad), 3 is suspect (ok), 99 missing
        { uid: 2, type: 'C', label: 'c2', connections: [1] },
        { uid: 3, type: 'S', label: 's1', connections: [] },
      ] } });
      const c1 = c.mystery.boxes.find(b => b.uid === 1);
      const s1 = c.mystery.boxes.find(b => b.uid === 3);
      expect(c1.connections).toEqual([3]);
      expect(s1.connections).toEqual([1]);  // re-symmetrized
    });

    it('forces nextUid above the highest surviving uid', () => {
      const c = sanitizeCampaign({ mystery: { boxes: [{ uid: 7, type: 'C', label: 'x' }], nextUid: 2 } });
      expect(c.mystery.nextUid).toBe(8);
    });

    it('nulls solvedBoxUid when it points at no real box', () => {
      const c = sanitizeCampaign({ mystery: { boxes: [{ uid: 1, type: 'S', label: 'x' }], solvedBoxUid: 42 } });
      expect(c.mystery.solvedBoxUid).toBeNull();
    });
  });

  describe('sanitizeBox()', () => {
    it('rejects non-objects and non-finite uids', () => {
      expect(sanitizeBox(null)).toBeNull();
      expect(sanitizeBox({ uid: 'abc' })).toBeNull();
    });
    it('defaults type to C and label to Unnamed', () => {
      expect(sanitizeBox({ uid: 3 })).toEqual({ uid: 3, type: 'C', label: 'Unnamed', connections: [] });
    });
  });
});

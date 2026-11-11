/* 3D dice (the rpg-dice-3d library in js/vendor/rpg-dice-3d/, 21d-dice-roll.js).
   The WebGL throw itself is checked by hand in a browser; these specs cover
   the roll capture, the dice mapping and the Settings section, with
   RpgDice3D.throwDice stubbed. The library has its own tests. */
describe('3D dice', () => {
  beforeEach(() => { resetApp(); });

  // Runs cb with RpgDice3D.throwDice replaced by a recorder; returns the calls.
  async function withThrowStub(cb, result) {
    const real = RpgDice3D.throwDice, realCover = RpgDice3D.cover;
    const calls = [];
    RpgDice3D.throwDice = (list, opts) => { calls.push({ list, opts }); return result === undefined ? { settleTime: 1 } : result; };
    RpgDice3D.cover = () => { calls.covered = (calls.covered || 0) + 1; };
    try { await cb(); await new Promise(r => setTimeout(r, 10)); }
    finally { RpgDice3D.throwDice = real; RpgDice3D.cover = realCover; }
    return calls;
  }

  describe('diceForRolls()', () => {
    it('maps the sizes with a 3D shape to that die, with the roll on top', () => {
      const out = diceForRolls([{ sides: 4, value: 3 }, { sides: 6, value: 5 }, { sides: 20, value: 17 }]);
      expect(out.map(d => d.shape)).toEqual(['d4', 'd6', 'd20']);
      expect(out.map(d => d.top)).toEqual(['3', '5', '17']);
    });
    it('shows a d100 as a tens die and a units die (00 + 0 = 100)', () => {
      expect(diceForRolls([{ sides: 100, value: 57 }]).map(d => d.shape + ':' + d.top)).toEqual(['d10t:50', 'd10u:7']);
      expect(diceForRolls([{ sides: 100, value: 100 }]).map(d => d.top)).toEqual(['00', '0']);
      expect(diceForRolls([{ sides: 100, value: 5 }]).map(d => d.top)).toEqual(['00', '5']);
    });
    it('shows other sizes as a coin with the number', () => {
      const [d] = diceForRolls([{ sides: 36, value: 17 }]);
      expect(d.shape).toBe('token');
      expect(d.top).toBe('17');
    });
    it('puts at most DICE_MAX dice on the table', () => {
      const many = Array.from({ length: 30 }, () => ({ sides: 6, value: 1 }));
      expect(diceForRolls(many)).toHaveLength(DICE_MAX);
    });
  });

  describe('the roll capture', () => {
    it('throws the dice an action rolled, with the rolled values', async () => {
      diceConfig.enabled = true;
      const realRandom = Math.random;
      Math.random = () => 0.565;   // rollDie(100) -> 57
      let calls;
      try { calls = await withThrowStub(() => click('#btnGmeFate')); }
      finally { Math.random = realRandom; }
      expect(calls).toHaveLength(1);
      expect(calls.covered).toBe(1);
      expect(calls[0].list.map(d => d.top)).toEqual(['50', '7']);
      expect(lastLog().md).toContain('1d100: 57');
      expect(calls[0].opts.skin).toBe('indigo');   // the Mythic GME theme
      expect(calls[0].opts.backdrop).toBe(true);
    });
    it('does nothing with 3D dice off', async () => {
      const calls = await withThrowStub(() => click('#btnGmeFate'));
      expect(calls).toHaveLength(0);
      expect(diceCapture).toBeNull();
    });
    it('does nothing for an action that rolls no dice', async () => {
      diceConfig.enabled = true;
      const calls = await withThrowStub(() => click('#btnSceneCfPlus'));
      expect(calls).toHaveLength(0);
    });
    it('passes the sound setting to the throw', async () => {
      diceConfig.enabled = true; diceConfig.sound = false;
      const calls = await withThrowStub(() => click('#btnGmeFate'));
      expect(calls[0].opts.sound).toBe(false);
    });
    it('shows the result at once when WebGL is missing (throwDice returns null)', async () => {
      diceConfig.enabled = true;
      await withThrowStub(() => click('#btnGmeFate'), null);
      const stage = document.querySelector('.rpg-dice3d');
      expect(!stage || stage.hidden).toBe(true);
    });
  });

  describe('the dice of a Mythic GME Scene test', () => {
    // Records the sides of every die the button rolls, with the rolls forced.
    async function diceOf(vals) {
      const sides = [];
      await withRolls(sd => { sides.push(sd); return vals[sides.length - 1] || 1; }, () => click('#btnGmeTestScene'));
      return sides;
    }
    it('Expected: the 1d10 only', async () => {
      expect(await diceOf([9])).toEqual([10]);
    });
    it('Altered: 1d10, the Scene Adjustment 1d10 and one Meaning 1d100 (no coin for the column)', async () => {
      expect(await diceOf([3, 2, 40])).toEqual([10, 10, 100]);
    });
    it('Altered with Make 2 Adjustments: two more 1d10, rolled again on 7-10', async () => {
      expect(await diceOf([3, 8, 9, 2, 5, 40])).toEqual([10, 10, 10, 10, 10, 100]);
    });
    it('Interrupt: 1d10, the Event Focus 1d100 and the Meaning pair (2 x 1d100)', async () => {
      expect(await diceOf([4, 30, 2, 55])).toEqual([10, 100, 100, 100]);
    });
  });

  describe('Settings', () => {
    it('has a Dice section with both options on by default', () => {
      try { localStorage.removeItem(DICE_KEY); } catch (_) {}
      diceConfig = loadDiceConfig();
      renderDiceSettings();
      expect($('#diceEnabled').checked).toBe(true);
      expect($('#diceSound').checked).toBe(true);
    });
    it('saves the options in localStorage and greys out the sound while 3D dice are off', () => {
      renderDiceSettings();
      $('#diceEnabled').checked = false;
      $('#diceEnabled').dispatchEvent(new Event('change'));
      expect(JSON.parse(localStorage.getItem(DICE_KEY)).enabled).toBe(false);
      expect($('#diceSound').disabled).toBe(true);
      $('#diceEnabled').checked = true;
      $('#diceEnabled').dispatchEvent(new Event('change'));
      $('#diceSound').checked = false;
      $('#diceSound').dispatchEvent(new Event('change'));
      expect(loadDiceConfig()).toEqual({ enabled: true, sound: false, skin: 'theme' });
      try { localStorage.removeItem(DICE_KEY); } catch (_) {}
    });
  });

  describe('skins', () => {
    it('has the library\'s 14 skins, and the dropdown lists them plus Match the theme and Random', () => {
      expect(RpgDice3D.SKIN_IDS).toHaveLength(14);
      renderDiceSettings();
      const vals = Array.from($('#diceSkin').options).map(o => o.value);
      expect(vals).toHaveLength(16);
      expect(vals[0]).toBe('theme');
      expect(vals[15]).toBe('random');
    });
    it('a chosen skin goes to every die; Random gives each die its own', async () => {
      diceConfig.enabled = true; diceConfig.skin = 'marble';
      let calls = await withThrowStub(() => click('#btnGmeFate'));
      expect(calls[0].opts.skin).toBe('marble');
      diceConfig.skin = 'random';
      calls = await withThrowStub(() => click('#btnGmeFate'));
      calls[0].list.forEach(d => expect(RpgDice3D.SKIN_IDS.includes(d.skin)).toBe(true));
    });
    it('saves the skin, and an unknown saved skin falls back to the theme', () => {
      renderDiceSettings();
      setValue('#diceSkin', 'oak');
      expect(loadDiceConfig().skin).toBe('oak');
      localStorage.setItem(DICE_KEY, JSON.stringify({ enabled: true, sound: true, skin: 'plaid' }));
      expect(loadDiceConfig().skin).toBe('theme');
      localStorage.setItem(DICE_KEY, JSON.stringify({ enabled: true, sound: true, skin: 'nebula' }));
      expect(loadDiceConfig().skin).toBe('galaxy');   // an id from before the library
      try { localStorage.removeItem(DICE_KEY); } catch (_) {}
    });
  });

  describe('the engine (no WebGL needed)', () => {
    it('builds every shape with the right number of faces', () => {
      const faces = k => RpgDice3D.buildShape(THREE, k, 0).faces.length;
      expect([faces('d4'), faces('d6'), faces('d8'), faces('d10'), faces('d12'), faces('d20')]).toEqual([4, 6, 8, 10, 12, 20]);
    });
    it('labels opposite faces of a d6 to sum to 7', () => {
      const s = RpgDice3D.buildShape(THREE, 'd6', 6);
      s.faces.forEach(f => {
        const opp = s.faces.find(o => o.normal.dot(f.normal) < -0.999);
        expect(Number(f.label) + Number(opp.label)).toBe(7);
      });
    });
  });
});

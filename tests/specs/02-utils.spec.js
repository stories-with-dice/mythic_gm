/* Dice + Markdown/HTML escaping utilities (02-dice-markdown-utils.js). */

describe('utils', () => {

  describe('rollDie()', () => {
    it('stays within 1..sides across many rolls', () => {
      for (let i = 0; i < 300; i++) {
        const r = rollDie(20);
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(20);
      }
    });
    it('is uniform enough to hit both extremes of a d6', () => {
      const seen = new Set();
      for (let i = 0; i < 500; i++) seen.add(rollDie(6));
      expect(seen.has(1)).toBe(true);
      expect(seen.has(6)).toBe(true);
    });
  });

  describe('timestamp()', () => {
    it('is a YYYY-MM-DD HH:MM:SS string', () => {
      expect(timestamp()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('escapeMd()', () => {
    it('escapes only the pipe (Markdown table cell safety)', () => {
      expect(escapeMd('a | b')).toBe('a \\| b');
      expect(escapeMd('<b>"x"</b>')).toBe('<b>"x"</b>');
      expect(escapeMd(null)).toBe('');
    });
  });

  describe('escapeAttr()', () => {
    it('escapes & " < > for HTML attribute values', () => {
      expect(escapeAttr('Tom & "Jerry" <x>')).toBe('Tom &amp; &quot;Jerry&quot; &lt;x&gt;');
      expect(escapeAttr(null)).toBe('');
      expect(escapeAttr(42)).toBe('42');
    });
    it('keeps a label with a quote from breaking an attribute', () => {
      const div = document.createElement('div');
      div.innerHTML = `<input value="${escapeAttr('say "hi"')}">`;
      expect(div.querySelector('input').value).toBe('say "hi"');
    });
  });
});

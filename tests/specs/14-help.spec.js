/* Help overlay (18-help.js). Pure informational content — no persisted
   state — so these specs mostly cover the open/close mechanics and that
   every tool gets a section. */

describe('Help overlay', () => {

  beforeEach(resetApp);

  it('is closed by default', () => {
    const overlay = document.getElementById('helpOverlay');
    expect(overlay.classList.contains('open')).toBe(false);
    expect(overlay.innerHTML).toBe('');
  });

  it('the ? button opens it with a section for every tool', () => {
    click('#btnHelp');
    const overlay = document.getElementById('helpOverlay');
    expect(overlay.classList.contains('open')).toBe(true);
    expect(overlay).toContain('Ask the GM');
    expect(overlay).toContain('Discover Meaning');
    expect(overlay).toContain('Crafters');
    expect(overlay).toContain('Mystery Matrix');
    expect(overlay).toContain('Mythic GME');
    expect(overlay).toContain('Published Adventures');
    expect(overlay).toContain('Player Emulator');
    expect(overlay).toContain('Quick Note');
    expect(overlay).toContain('Campaign Log');
  });

  it('embeds the Published Adventures tab\'s own flowchart verbatim (single source of truth)', () => {
    click('#btnHelp');
    expect($('#help-pub .pub-flow')).toBeTruthy();
    expect($('#help-pub')).toContain('Deconstruct The Known');
  });

  it('the table of contents links resolve to real sections in the page', () => {
    click('#btnHelp');
    const links = $$('.help-toc a');
    expect(links).toHaveLength(6);
    links.forEach(a => {
      const id = a.getAttribute('href').slice(1);
      expect(document.getElementById(id)).toBeTruthy();
    });
  });

  it('the close button closes it and clears the content', () => {
    click('#btnHelp');
    click('#btnHelpClose');
    const overlay = document.getElementById('helpOverlay');
    expect(overlay.classList.contains('open')).toBe(false);
    expect(overlay.innerHTML).toBe('');
  });

  it('clicking the backdrop (not the panel) closes it', () => {
    click('#btnHelp');
    click('#helpOverlay');
    expect(document.getElementById('helpOverlay').classList.contains('open')).toBe(false);
  });

  it('clicking inside the panel does not close it', () => {
    click('#btnHelp');
    click($('.help-inner'));
    expect(document.getElementById('helpOverlay').classList.contains('open')).toBe(true);
  });

  it('pressing Escape closes it', () => {
    click('#btnHelp');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('helpOverlay').classList.contains('open')).toBe(false);
  });

  it('works regardless of which tab is currently active', () => {
    showTab('playerEmu');
    click('#btnHelp');
    expect(document.getElementById('helpOverlay').classList.contains('open')).toBe(true);
  });
});

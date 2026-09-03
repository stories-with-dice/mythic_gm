/* Quick Note editor (12-quick-note.js) + Campaign Log (13-campaign-log.js). */

describe('Quick Note', () => {

  beforeEach(() => {
    resetApp();
    renderNoteSection();   // (re)builds the EasyMDE instance against #noteSection
  });

  it('mounts an EasyMDE editor into #noteSection', () => {
    expect(noteMDE).toBeTruthy();
    expect($('#noteSection .EasyMDEContainer')).toBeTruthy();
  });

  it('the bound Enter key commits the note to the log as raw Markdown and clears the editor', () => {
    noteMDE.value('A **bold** aside');
    const enter = noteMDE.codemirror.getOption('extraKeys').Enter;
    expect(typeof enter).toBe('function');
    enter(noteMDE.codemirror);
    expect(lastLog().section).toBe('Note');
    expect(lastLog().md).toBe('A **bold** aside');
    expect(noteMDE.value()).toBe('');
  });

  it('Enter on an empty / whitespace-only note does nothing', () => {
    const before = logEntries().length;
    noteMDE.value('   ');
    noteMDE.codemirror.getOption('extraKeys').Enter(noteMDE.codemirror);
    expect(logEntries()).toHaveLength(before);
  });

  it('EasyMDE keeps its built-in shortcuts after the Enter binding is merged in', () => {
    const keys = noteMDE.codemirror.getOption('extraKeys');
    expect(keys['Shift-Enter']).toBe('newlineAndIndent');
  });
});

describe('Campaign Log', () => {

  beforeEach(resetApp);

  it('shows the empty-state line when nothing is logged', () => {
    renderLogSection();
    expect($('#logSection')).toContain('No results logged yet');
    expect(buildLogMarkdown()).toContain('_No results logged yet');
  });

  it('buildLogMarkdown() is the raw-Markdown source of truth, newest entries included', () => {
    addLog('Ask the GM', '**Ask the GM** — Roll: **50** → **Yes**');
    addLog('Note', 'plain note');
    const md = buildLogMarkdown();
    expect(md).toContain('# Campaign Log');
    expect(md).toContain('### ');
    expect(md).toContain('**Ask the GM**');
    expect(md).toContain('plain note');
  });

  it('renders Markdown to sanitised HTML for display (script tags stripped)', () => {
    addLog('Note', 'hi <script>window.__pwned = 1<\/script> there');
    renderLogSection();
    expect(window.__pwned).toBe(undefined);
    expect($('#logSection .log-render')).toContain('hi');
    expect($('#logSection .log-render').innerHTML).not.toContain('<script');
  });

  it('the entry counter reflects campaign().log length', () => {
    addLog('X', 'one');
    addLog('X', 'two');
    renderLogSection();
    expect($('#logSection .log-toolbar')).toContain('2 entries');
  });

  it('Clear log empties this campaign\'s log after confirmation', async () => {
    addLog('X', 'one');
    renderLogSection();
    await withDialogs({ confirm: true }, () => click('#btnClearLog'));
    expect(campaign().log).toHaveLength(0);
  });

  it('Clear log is a no-op when the user cancels the confirm', async () => {
    addLog('X', 'one');
    renderLogSection();
    await withDialogs({ confirm: false }, () => click('#btnClearLog'));
    expect(campaign().log).toHaveLength(1);
  });

  it('the log is per-campaign', async () => {
    addLog('X', 'in campaign one');
    await withDialogs({ prompt: 'Campaign Two' }, () => click('#btnNewCampaign'));
    expect(campaign().log).toHaveLength(0);
  });
});

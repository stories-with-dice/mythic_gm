/* Location Crafter tab UI (08-tab-location-crafter.js). */

describe('Location Crafter tab', () => {

  beforeEach(() => { resetApp(); showTab('location'); });

  it('Start New Region seeds PP from the region size and resets counts', async () => {
    setValue('#regionSize', 'Small');            // Small => start PP +3
    await withDialogs({ confirm: true }, () => click('#btnStartRegion'));
    const loc = campaign().location;
    expect(loc.pp).toBe(3);
    expect(loc.areaCount).toBe(0);
    expect(loc.complete).toBe(false);
    expect(lastLog().md).toContain('New Region started');
  });

  it('PP +1 / PP -1 adjust Progress Points and persist', () => {
    click('#btnPPplus');
    expect(campaign().location.pp).toBe(1);
    click('#btnPPminus');
    click('#btnPPminus');
    expect(campaign().location.pp).toBe(-1);
    expect(JSON.parse(sessionStorage.getItem('mythicToolkit_v1')).campaigns[STORE.current].location.pp).toBe(-1);
  });

  it('Explore New Area rolls three elements, bumps the area count and logs', async () => {
    // pp = 0; three d10 rolls of 1 => raw 1 => "Expected" (no descriptor sub-rolls)
    await withRolls([1], () => click('#btnExploreArea'));
    expect(campaign().location.areaCount).toBe(1);
    expect($('#areaResult')).toContain('Area 1');
    expect($$('#areaResult .plotpoint')).toHaveLength(3);
    expect(lastLog().section).toBe('Location Crafter');
    expect(lastLog().md).toContain('**Area 1**');
  });

  it('the last Area result survives an unrelated re-render (cached in module state)', async () => {
    await withRolls([1], () => click('#btnExploreArea'));
    expect($('#areaResult')).toContain('Area 1');
    click('#btnPPplus');                      // triggers renderActive() for an unrelated reason
    expect($('#areaResult')).toContain('Area 1');   // still there
  });

  it('once Complete, further exploration yields three Expected auto-results', async () => {
    campaign().location.complete = true;
    persist();
    showTab('location');
    await withRolls([1], () => click('#btnExploreArea'));
    const cells = $$('#areaResult .plotpoint .word').map(w => w.textContent);
    expect(cells).toEqual(['Expected', 'Expected', 'Expected']);
  });
});

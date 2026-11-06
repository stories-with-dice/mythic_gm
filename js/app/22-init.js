/* =========================================================================
   INIT
   ========================================================================= */
// The page is rendered by script after load, so the browser's own scroll
// restore runs too early. restoreViewTabs()/saveView() (04) do it instead.
if('scrollRestoration' in history) history.scrollRestoration = 'manual';

document.addEventListener('DOMContentLoaded', ()=>{
  const view = restoreViewTabs(); // the campaign's saved tabs + intros, and the scroll position from before a reload
  updateHints();                  // no hint text in a campaign older than a day (05-campaign-bar.js)
  renderCampaignBar();
  wireCampaignBar();
  renderTabNav();
  renderActive();
  renderNoteSection();
  renderLogSection();
  wireHelp();
  wireSettings(); // builds the Settings modal that wireTheme() and wireDropbox() fill
  wireTheme();
  wireDropbox();
  if(view.scrollY) requestAnimationFrame(() => window.scrollTo(0, view.scrollY));
  window.addEventListener('pagehide', saveView);
  initDropbox(); // last: syncs this tab's campaigns, if Dropbox sync is on
});

/* =========================================================================
   INIT
   ========================================================================= */
document.addEventListener('DOMContentLoaded', ()=>{
  renderCampaignBar();
  wireCampaignBar();
  renderTabNav();
  renderActive();
  renderNoteSection();
  renderLogSection();
  wireHelp();
  wireTheme();
  wireDropbox();
  initDropbox(); // last: syncs this tab's campaigns, if Dropbox sync is on
});

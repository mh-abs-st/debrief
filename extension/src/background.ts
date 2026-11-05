// Clicking the toolbar icon opens the side panel and keeps it open: a second click never hides it.
// (Chrome's openPanelOnActionClick toggles the panel, so a click while it's open would close it.)
// Handling the click ourselves also counts as invoking Debrief on that tab, which is what lets
// "Start listening" capture the tab's audio (chrome.tabCapture needs it).

// The behavior is saved by Chrome, so turn the old toggle off explicitly for existing installs.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((err) => console.error('Debrief: could not set panel behavior', err));

chrome.action.onClicked.addListener((tab) => {
  // open() must run straight away, inside the click: no await before it.
  chrome.sidePanel.open({ windowId: tab.windowId }).catch((err) => console.error('Debrief: could not open the side panel', err));
});

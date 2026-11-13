// Which call tab Debrief is listening to, and when to stop. Pure, so it can be tested in Node.

// True when the captured tab has moved to another site (a different origin), so we stop listening.
// Moving around inside the call's own site (Meet, Zoom or Teams changing the address) doesn't count.
export function leftCallSite(callUrl: string, nextUrl: string): boolean {
  try {
    return new URL(callUrl).origin !== new URL(nextUrl).origin;
  } catch {
    return false; // an address we can't read: keep listening rather than guess
  }
}

// The text on the toolbar icon while listening. "LIVE", not "REC": nothing is recorded.
export const LISTENING_BADGE = 'LIVE';

// How to give Debrief the tab: the toolbar icon, or the keyboard shortcut Chrome has for it.
// shortcut is what chrome.commands reports ('' when unset, for example when another extension has the keys).
export function howToInvoke(shortcut: string): string {
  return shortcut
    ? `click the Debrief icon in the toolbar, or press ${shortcut}, while you’re on the call tab`
    : 'click the Debrief icon in the toolbar while you’re on the call tab (you can set a keyboard shortcut at chrome://extensions/shortcuts)';
}

export function needsOkMessage(shortcut: string): string {
  const how = howToInvoke(shortcut);
  return `Chrome needs your OK for this tab. ${how[0].toUpperCase()}${how.slice(1)}, then press Start listening again. The panel stays open.`;
}

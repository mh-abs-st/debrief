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

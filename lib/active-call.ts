// Tracks call sessions the user is currently engaged with (i.e. the call
// screen for that session is mounted). This is the single source of truth used
// to suppress *duplicate* incoming-call surfaces.
//
// Why this exists: a CALL_INCOMING_EVENT can be re-delivered by Pusher after a
// reconnect once the 30s dedupe window in realtime-bridge has expired (and the
// native FCM path can dispatch independently). If that happens while the user
// is already inside the call, the native CallKeep UI + full-screen notification
// pop up *on top of the live call*. Accepting it just re-runs /accept (409) and
// re-navigates to the same screen; declining fires /reject on a call that's
// already active — so the overlay feels stuck. Guarding on an active-call set
// stops the duplicate surface from ever appearing.

const activeCallSessions = new Set<string>();

export function markCallActive(callSessionId: string): void {
  if (callSessionId) activeCallSessions.add(callSessionId);
}

export function clearActiveCall(callSessionId: string): void {
  if (callSessionId) activeCallSessions.delete(callSessionId);
}

export function isCallActive(callSessionId: string): boolean {
  return activeCallSessions.has(callSessionId);
}

export function hasAnyActiveCall(): boolean {
  return activeCallSessions.size > 0;
}

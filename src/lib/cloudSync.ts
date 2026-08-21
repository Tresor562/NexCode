import type { LocalState } from './localState';
import { isCloudConfigured, loadCloudSession, pushCloudState, saveCloudSession } from './cloudAccount';

let pendingPush: ReturnType<typeof setTimeout> | null = null;
let latestState: LocalState | null = null;

export function scheduleCloudStatePush(state: LocalState, delayMs = 900): void {
  if (!isCloudConfigured() || !loadCloudSession()) return;
  latestState = state;
  if (pendingPush) clearTimeout(pendingPush);
  pendingPush = setTimeout(() => {
    pendingPush = null;
    const snapshot = latestState;
    latestState = null;
    if (!snapshot) return;
    const session = loadCloudSession();
    if (!session) return;
    void pushCloudState(session, snapshot)
      .then((refreshed) => saveCloudSession(refreshed))
      .catch(() => {
        // Keep local progress authoritative while offline; the next mutation retries.
      });
  }, delayMs);
}

import type { LocalState } from './localState';
import { isCloudConfigured, loadCloudSession, pushCloudState, saveCloudSession } from './cloudAccount';

let pendingPush: ReturnType<typeof setTimeout> | null = null;
let latestState: LocalState | null = null;
let pushInFlight = false;
let retryDelayMs = 1_500;

const MAX_RETRY_DELAY_MS = 30_000;
const FOLLOW_UP_DELAY_MS = 250;

function clearPendingPush(): void {
  if (!pendingPush) return;
  clearTimeout(pendingPush);
  pendingPush = null;
}

function queueFlush(delayMs: number): void {
  if (pendingPush || pushInFlight || !latestState) return;
  pendingPush = setTimeout(() => {
    pendingPush = null;
    void flushLatestState();
  }, Math.max(0, delayMs));
}

async function flushLatestState(): Promise<void> {
  if (pushInFlight || !latestState) return;
  const session = loadCloudSession();
  if (!session) {
    latestState = null;
    return;
  }

  const snapshot = latestState;
  latestState = null;
  pushInFlight = true;

  try {
    const refreshed = await pushCloudState(session, snapshot);
    saveCloudSession(refreshed);
    retryDelayMs = 1_500;
  } catch {
    // Keep the newest local snapshot queued while offline. If another mutation
    // happened during the request, that newer state already supersedes this one.
    if (!latestState) latestState = snapshot;
    const delay = retryDelayMs;
    retryDelayMs = Math.min(MAX_RETRY_DELAY_MS, retryDelayMs * 2);
    pushInFlight = false;
    queueFlush(delay);
    return;
  }

  pushInFlight = false;
  if (latestState) queueFlush(FOLLOW_UP_DELAY_MS);
}

export function scheduleCloudStatePush(state: LocalState, delayMs = 900): void {
  if (!isCloudConfigured() || !loadCloudSession()) return;
  latestState = state;

  // Debounce rapid local mutations, but never start a second request while one
  // is in flight. The completed request immediately flushes any newer snapshot.
  if (pushInFlight) return;
  clearPendingPush();
  queueFlush(delayMs);
}

import type { LocalState } from './localState';
import { isCloudConfigured, loadCloudSession, pullCloudState, pushCloudState } from './cloudAccount';

type PendingCloudState = {
  userId: string;
  state: LocalState;
};

let pendingPush: ReturnType<typeof setTimeout> | null = null;
let latestState: PendingCloudState | null = null;
let pushInFlight = false;
let retryDelayMs = 1_500;

const BASE_RETRY_DELAY_MS = 1_500;
const MAX_RETRY_DELAY_MS = 30_000;
const FOLLOW_UP_DELAY_MS = 250;

function snapshotCloudState(state: LocalState): LocalState {
  // LocalState is intentionally JSON-serializable because the same shape is
  // persisted to disk and Supabase. Clone it when queueing so later in-memory
  // mutations cannot silently rewrite a snapshot that is already waiting for
  // upload or currently being retried.
  return JSON.parse(JSON.stringify(state)) as LocalState;
}

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

  // A debounce timer can outlive a sign-out/sign-in. Never send learner A's
  // queued progress through learner B's Supabase session.
  if (session.user.id !== snapshot.userId) {
    latestState = null;
    retryDelayMs = BASE_RETRY_DELAY_MS;
    return;
  }

  latestState = null;
  pushInFlight = true;

  try {
    // Reconcile the queued local snapshot with the latest remote state before
    // writing. Without this read-merge-write boundary, device B could upload an
    // older local snapshot after device A and silently remove completed lessons,
    // mastery evidence, XP or streak progress already present in Supabase.
    const reconciled = await pullCloudState(session, snapshot.state);
    const currentBeforePush = loadCloudSession();
    if (!currentBeforePush || currentBeforePush.user.id !== snapshot.userId) {
      // Route this through the normal failure handoff so a snapshot queued for a
      // newly signed-in learner while the pull was running is scheduled at once.
      throw new Error('Cloud account changed during reconciliation.');
    }
    await pushCloudState(reconciled.session, reconciled.state);
    retryDelayMs = BASE_RETRY_DELAY_MS;
  } catch {
    // Keep the newest local snapshot queued while offline. If another mutation
    // happened during the request, that newer state already supersedes this one.
    if (!latestState) latestState = snapshot;
    const delay = retryDelayMs;
    retryDelayMs = Math.min(MAX_RETRY_DELAY_MS, retryDelayMs * 2);
    pushInFlight = false;

    const current = loadCloudSession();
    if (!current) {
      if (latestState?.userId === snapshot.userId) latestState = null;
      retryDelayMs = BASE_RETRY_DELAY_MS;
      return;
    }

    if (current.user.id !== snapshot.userId) {
      // The failed request belonged to learner A, but learner B may already have
      // queued a newer snapshot while A's request was in flight. Do not strand B's
      // progress until another mutation happens: discard only A's stale retry and
      // immediately schedule B's pending state under B's own current session.
      if (latestState?.userId === snapshot.userId) latestState = null;
      retryDelayMs = BASE_RETRY_DELAY_MS;
      if (latestState?.userId === current.user.id) queueFlush(FOLLOW_UP_DELAY_MS);
      return;
    }

    queueFlush(delay);
    return;
  } finally {
    pushInFlight = false;
  }

  if (latestState) queueFlush(FOLLOW_UP_DELAY_MS);
}

export function scheduleCloudStatePush(state: LocalState, delayMs = 900): void {
  if (!isCloudConfigured()) return;
  const session = loadCloudSession();
  if (!session) return;
  latestState = { userId: session.user.id, state: snapshotCloudState(state) };

  // Debounce rapid local mutations, but never start a second request while one
  // is in flight. The completed request immediately flushes any newer snapshot.
  if (pushInFlight) return;
  clearPendingPush();
  queueFlush(delayMs);
}

export async function flushCloudStateNow(): Promise<void> {
  // Mobile operating systems may suspend JavaScript shortly after the app leaves
  // the foreground. Do not let a learner finish a lesson and lose the cloud copy
  // simply because the normal debounce timer had not fired yet.
  clearPendingPush();
  await flushLatestState();
}

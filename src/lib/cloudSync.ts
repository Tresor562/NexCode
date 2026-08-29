import type { LocalState } from './localState';
import { isCloudConfigured, loadCloudSession, pullCloudState, pushCloudState } from './cloudAccount';

type PendingCloudState = {
  userId: string;
  state: LocalState;
};

let pendingPush: ReturnType<typeof setTimeout> | null = null;
let latestState: PendingCloudState | null = null;
let activeFlush: Promise<boolean> | null = null;
let deferredFlushDelayMs: number | null = null;
let retryDelayMs = 1_500;

const BASE_RETRY_DELAY_MS = 1_500;
const MAX_RETRY_DELAY_MS = 30_000;
const FOLLOW_UP_DELAY_MS = 250;
const DEFAULT_PUSH_DELAY_MS = 900;
const MAX_PUSH_DELAY_MS = 60_000;

function normalizeFlushDelay(value: unknown, fallback = DEFAULT_PUSH_DELAY_MS): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(MAX_PUSH_DELAY_MS, Math.floor(value)));
}

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
  if (!latestState) return;
  const safeDelay = normalizeFlushDelay(delayMs, FOLLOW_UP_DELAY_MS);

  if (activeFlush) {
    // A retry or account handoff may be requested while the current request is
    // still unwinding. Preserve the requested delay and schedule it only after
    // the active promise has settled; otherwise the fallback follow-up delay can
    // accidentally erase exponential backoff while offline.
    deferredFlushDelayMs = deferredFlushDelayMs === null
      ? safeDelay
      : Math.min(deferredFlushDelayMs, safeDelay);
    return;
  }

  if (pendingPush) return;
  pendingPush = setTimeout(() => {
    pendingPush = null;
    void flushLatestState();
  }, safeDelay);
}

async function performLatestStateFlush(): Promise<boolean> {
  if (!latestState) return true;
  const session = loadCloudSession();
  if (!session) {
    latestState = null;
    return true;
  }

  const snapshot = latestState;

  // A debounce timer can outlive a sign-out/sign-in. Never send learner A's
  // queued progress through learner B's Supabase session.
  if (session.user.id !== snapshot.userId) {
    latestState = null;
    retryDelayMs = BASE_RETRY_DELAY_MS;
    return true;
  }

  latestState = null;

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
    return true;
  } catch {
    // Keep the newest local snapshot queued while offline. If another mutation
    // happened during the request, that newer state already supersedes this one.
    if (!latestState) latestState = snapshot;
    const delay = retryDelayMs;
    retryDelayMs = Math.min(MAX_RETRY_DELAY_MS, retryDelayMs * 2);

    const current = loadCloudSession();
    if (!current) {
      if (latestState?.userId === snapshot.userId) latestState = null;
      retryDelayMs = BASE_RETRY_DELAY_MS;
      return false;
    }

    if (current.user.id !== snapshot.userId) {
      // The failed request belonged to learner A, but learner B may already have
      // queued a newer snapshot while A's request was in flight. Do not strand B's
      // progress until another mutation happens: discard only A's stale retry and
      // immediately schedule B's pending state under B's own current session.
      if (latestState?.userId === snapshot.userId) latestState = null;
      retryDelayMs = BASE_RETRY_DELAY_MS;
      if (latestState?.userId === current.user.id) queueFlush(FOLLOW_UP_DELAY_MS);
      return false;
    }

    queueFlush(delay);
    return false;
  }
}

async function flushLatestState(): Promise<boolean> {
  // Share the same promise with lifecycle flushes so a background transition can
  // wait for an already-running Supabase reconciliation instead of returning
  // immediately and relying on a follow-up timer that the OS may suspend.
  if (activeFlush) return activeFlush;

  const flush = performLatestStateFlush();
  activeFlush = flush;
  try {
    return await flush;
  } finally {
    if (activeFlush === flush) activeFlush = null;

    const deferredDelay = deferredFlushDelayMs;
    deferredFlushDelayMs = null;
    if (latestState && !pendingPush) {
      queueFlush(deferredDelay ?? FOLLOW_UP_DELAY_MS);
    }
  }
}

export function scheduleCloudStatePush(state: LocalState, delayMs = DEFAULT_PUSH_DELAY_MS): void {
  if (!isCloudConfigured()) return;
  const session = loadCloudSession();
  if (!session) return;
  latestState = { userId: session.user.id, state: snapshotCloudState(state) };

  // Debounce rapid local mutations, but never start a second request while one
  // is in flight. The completed request immediately flushes any newer snapshot.
  if (activeFlush) return;
  clearPendingPush();
  queueFlush(normalizeFlushDelay(delayMs));
}

export async function flushCloudStateNow(): Promise<void> {
  // Mobile operating systems may suspend JavaScript shortly after the app leaves
  // the foreground. Cancel the debounce, await any request already in flight,
  // then immediately drain one newer snapshot that arrived during that request.
  clearPendingPush();
  const completed = await flushLatestState();
  clearPendingPush();

  // Only perform the second drain after a successful reconciliation. When the
  // device is offline, the failed snapshot must keep its exponential retry rather
  // than spin synchronously while the app is transitioning to the background.
  if (completed && latestState) {
    await flushLatestState();
  }
}

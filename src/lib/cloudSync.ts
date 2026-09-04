import type { LocalState } from './localState';
import { isCloudConfigured, loadCloudSession, pullCloudState, pushCloudState } from './cloudAccount';

type PendingCloudState = {
  userId: string;
  state: LocalState;
};

let pendingPush: ReturnType<typeof setTimeout> | null = null;
let pendingPushPreservesBackoff = false;
let latestState: PendingCloudState | null = null;
let activeFlush: Promise<boolean> | null = null;
let deferredFlushDelayMs: number | null = null;
let deferredFlushPreservesBackoff = false;
let retryDelayMs = 1_500;
let retryUserId: string | null = null;

const BASE_RETRY_DELAY_MS = 1_500;
const MAX_RETRY_DELAY_MS = 30_000;
const FOLLOW_UP_DELAY_MS = 250;
const DEFAULT_PUSH_DELAY_MS = 900;
const MAX_PUSH_DELAY_MS = 60_000;

function normalizeFlushDelay(value: unknown, fallback = DEFAULT_PUSH_DELAY_MS): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(MAX_PUSH_DELAY_MS, Math.floor(value)));
}

function resetRetryBackoff(): void {
  retryDelayMs = BASE_RETRY_DELAY_MS;
  retryUserId = null;
}

function consumeRetryDelay(userId: string): number {
  // Backoff belongs to the learner whose request failed. A previous account may
  // have reached the 30s ceiling while offline; carrying that delay into another
  // learner session would make the first retry on the new account unnecessarily
  // slow even though it has never failed.
  if (retryUserId !== userId) {
    retryDelayMs = BASE_RETRY_DELAY_MS;
    retryUserId = userId;
  }
  const delay = retryDelayMs;
  retryDelayMs = Math.min(MAX_RETRY_DELAY_MS, retryDelayMs * 2);
  return delay;
}

function snapshotCloudState(state: LocalState): LocalState | null {
  // LocalState is intentionally JSON-serializable because the same shape is
  // persisted to disk and Supabase. Clone it when queueing so later in-memory
  // mutations cannot silently rewrite a snapshot that is already waiting for
  // upload or currently being retried. Treat serialization as an untrusted
  // persistence boundary: a circular or otherwise non-JSON runtime mutation
  // must never crash a learning interaction just because cloud sync is enabled.
  try {
    const serialized = JSON.stringify(state);
    if (!serialized) return null;
    const snapshot = JSON.parse(serialized) as unknown;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    return snapshot as LocalState;
  } catch {
    return null;
  }
}

function clearPendingPush(): void {
  if (!pendingPush) return;
  clearTimeout(pendingPush);
  pendingPush = null;
  pendingPushPreservesBackoff = false;
}

function queueFlush(delayMs: number, preserveBackoff = false): void {
  if (!latestState) return;
  const safeDelay = normalizeFlushDelay(delayMs, FOLLOW_UP_DELAY_MS);

  if (activeFlush) {
    // A retry or account handoff may be requested while the current request is
    // still unwinding. Never shorten an already-requested deferred delay: a
    // shorter follow-up request must not erase exponential backoff and hammer
    // Supabase while the device is offline. Account handoffs reset backoff before
    // they enqueue their own follow-up, so retaining the longer delay here is safe.
    deferredFlushDelayMs = deferredFlushDelayMs === null
      ? safeDelay
      : Math.max(deferredFlushDelayMs, safeDelay);
    deferredFlushPreservesBackoff = deferredFlushPreservesBackoff || preserveBackoff;
    return;
  }

  if (pendingPush) return;
  pendingPushPreservesBackoff = preserveBackoff;
  pendingPush = setTimeout(() => {
    pendingPush = null;
    pendingPushPreservesBackoff = false;
    void flushLatestState();
  }, safeDelay);
}

async function performLatestStateFlush(): Promise<boolean> {
  if (!latestState) return true;
  const session = loadCloudSession();
  if (!session) {
    latestState = null;
    resetRetryBackoff();
    return true;
  }

  const snapshot = latestState;

  // A debounce timer can outlive a sign-out/sign-in. Never send learner A's
  // queued progress through learner B's Supabase session.
  if (session.user.id !== snapshot.userId) {
    latestState = null;
    resetRetryBackoff();
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

    // pullCloudState may have started with a session whose access token was
    // refreshed while the request was in flight. We already re-read and verify
    // the active learner above, so push with that freshest session rather than
    // reusing the potentially stale session object returned by the reconciliation.
    await pushCloudState(currentBeforePush, reconciled.state);
    resetRetryBackoff();
    return true;
  } catch {
    // Keep the newest local snapshot queued while offline. If another mutation
    // happened during the request, that newer state already supersedes this one.
    if (!latestState) latestState = snapshot;

    const current = loadCloudSession();
    if (!current) {
      if (latestState?.userId === snapshot.userId) latestState = null;
      resetRetryBackoff();
      return false;
    }

    if (current.user.id !== snapshot.userId) {
      // The failed request belonged to learner A, but learner B may already have
      // queued a newer snapshot while A's request was in flight. Do not strand B's
      // progress until another mutation happens: discard only A's stale retry and
      // immediately schedule B's pending state under B's own current session.
      if (latestState?.userId === snapshot.userId) latestState = null;
      resetRetryBackoff();
      if (latestState?.userId === current.user.id) queueFlush(FOLLOW_UP_DELAY_MS);
      return false;
    }

    queueFlush(consumeRetryDelay(snapshot.userId), true);
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
    const preserveDeferredBackoff = deferredFlushPreservesBackoff;
    deferredFlushDelayMs = null;
    deferredFlushPreservesBackoff = false;
    if (latestState && !pendingPush) {
      queueFlush(deferredDelay ?? FOLLOW_UP_DELAY_MS, preserveDeferredBackoff);
    }
  }
}

export function scheduleCloudStatePush(state: LocalState, delayMs = DEFAULT_PUSH_DELAY_MS): void {
  if (!isCloudConfigured()) return;
  const session = loadCloudSession();
  if (!session) return;
  const snapshot = snapshotCloudState(state);
  if (!snapshot) return;
  latestState = { userId: session.user.id, state: snapshot };

  // Debounce rapid local mutations, but never start a second request while one
  // is in flight. The completed request immediately flushes any newer snapshot.
  if (activeFlush) return;

  // When this learner is already waiting for an exponential retry, keep that
  // retry timer intact. Local XP, streak or editor mutations should replace the
  // queued snapshot with the freshest state, not collapse a 30s offline backoff
  // back to the ordinary ~900ms debounce and repeatedly hammer Supabase.
  if (pendingPush && pendingPushPreservesBackoff && retryUserId === session.user.id) return;

  // A pending retry from a previous learner must never delay the new account.
  // Clearing it here is safe because latestState above is already scoped to the
  // newly active session and resetRetryBackoff will occur on the stale handoff.
  clearPendingPush();
  queueFlush(normalizeFlushDelay(delayMs));
}

export async function flushCloudStateNow(): Promise<void> {
  // Mobile operating systems may suspend JavaScript shortly after the app leaves
  // the foreground. Cancel the debounce, await any request already in flight,
  // then immediately drain one newer snapshot that arrived during that request.
  clearPendingPush();
  const completed = await flushLatestState();

  // A failed reconciliation schedules its exponential retry from flushLatestState's
  // finally block. Do not clear that timer here: backgrounding while offline must
  // never strand unsynced XP, streak, NexCoins or lesson progress until the next
  // local mutation happens.
  if (!completed) return;

  // Successful reconciliation can leave a short follow-up timer for a newer local
  // snapshot that arrived while the first request was running. Cancel only that
  // successful follow-up because we are about to drain the newest snapshot now.
  clearPendingPush();
  if (latestState) {
    await flushLatestState();
  }
}

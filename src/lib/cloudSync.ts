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
const MAX_CLOUD_DATE_LEAD_MS = 36 * 60 * 60 * 1000;

function normalizeFlushDelay(value: unknown, fallback = DEFAULT_PUSH_DELAY_MS): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(MAX_PUSH_DELAY_MS, Math.floor(value)));
}

function resetRetryBackoff(): void {
  retryDelayMs = BASE_RETRY_DELAY_MS;
  retryUserId = null;
}

function consumeRetryDelay(userId: string): number {
  if (retryUserId !== userId) {
    retryDelayMs = BASE_RETRY_DELAY_MS;
    retryUserId = userId;
  }
  const delay = retryDelayMs;
  retryDelayMs = Math.min(MAX_RETRY_DELAY_MS, retryDelayMs * 2);
  return delay;
}

function snapshotCloudState(state: LocalState): LocalState | null {
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

function localDateKeyTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
  return candidate.getTime();
}

function isImpossibleFutureCloudDate(value: unknown, reference: Date): boolean {
  const timestamp = localDateKeyTimestamp(value);
  if (timestamp === null) return false;
  return timestamp > reference.getTime() + MAX_CLOUD_DATE_LEAD_MS;
}

export function sanitizeReconciledCloudActivityClock(
  reconciled: LocalState,
  local: LocalState,
  reference = new Date(),
): LocalState {
  const safeReference = reference instanceof Date && Number.isFinite(reference.getTime()) ? reference : new Date();
  const invalidActivityDate = isImpossibleFutureCloudDate(reconciled.lastActiveDate, safeReference);
  const invalidRewardDate = isImpossibleFutureCloudDate(reconciled.dailyGoalRewardDate, safeReference);
  if (!invalidActivityDate && !invalidRewardDate) return reconciled;

  return {
    ...reconciled,
    ...(invalidActivityDate ? {
      lastActiveDate: local.lastActiveDate,
      dailyCompleted: local.dailyCompleted,
      streak: local.streak,
    } : {}),
    ...(invalidRewardDate ? { dailyGoalRewardDate: local.dailyGoalRewardDate } : {}),
  };
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
  if (session.user.id !== snapshot.userId) {
    latestState = null;
    resetRetryBackoff();
    return true;
  }

  latestState = null;

  try {
    const reconciled = await pullCloudState(session, snapshot.state);
    const currentBeforePush = loadCloudSession();
    if (!currentBeforePush || currentBeforePush.user.id !== snapshot.userId) {
      throw new Error('Cloud account changed during reconciliation.');
    }

    const safeReconciledState = sanitizeReconciledCloudActivityClock(reconciled.state, snapshot.state);
    await pushCloudState(currentBeforePush, safeReconciledState);
    resetRetryBackoff();
    return true;
  } catch {
    if (!latestState) latestState = snapshot;

    const current = loadCloudSession();
    if (!current) {
      if (latestState?.userId === snapshot.userId) latestState = null;
      resetRetryBackoff();
      return false;
    }

    if (current.user.id !== snapshot.userId) {
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

  if (activeFlush) return;
  if (pendingPush && pendingPushPreservesBackoff && retryUserId === session.user.id) return;

  clearPendingPush();
  queueFlush(normalizeFlushDelay(delayMs));
}

export async function flushCloudStateNow(): Promise<void> {
  // Background transitions are a narrow reliability window on mobile. Cancel the
  // debounce and keep draining successful reconciliations until no newer snapshot
  // remains. A single follow-up is insufficient: local state can mutate again while
  // that second request is in flight, and the OS may suspend the timer scheduled by
  // its finally block before that newest XP, streak, NexCoins or Lab state is sent.
  clearPendingPush();

  while (latestState || activeFlush) {
    const completed = await flushLatestState();
    if (!completed) return;

    // Successful reconciliation may have scheduled a short follow-up for state
    // captured during the request. We are already in an explicit lifecycle flush,
    // so cancel only that success timer and immediately drain the newest snapshot.
    clearPendingPush();
  }
}

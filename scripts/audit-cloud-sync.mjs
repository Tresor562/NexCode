import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sourcePath = path.join(root, 'src/lib/cloudSync.ts');
const accountPath = path.join(root, 'src/lib/cloudAccount.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const accountSource = fs.readFileSync(accountPath, 'utf8');

function requirePattern(pattern, message, haystack = source) {
  if (!pattern.test(haystack)) throw new Error(message);
}

requirePattern(
  /type PendingCloudState = \{[\s\S]*userId: string;[\s\S]*state: LocalState;/,
  'Cloud sync must keep every queued snapshot scoped to a user id.',
);
requirePattern(
  /function snapshotCloudState\(state: LocalState\): LocalState \| null \{[\s\S]*JSON\.stringify\(state\)[\s\S]*JSON\.parse\(serialized\) as unknown[\s\S]*typeof snapshot !== 'object'[\s\S]*Array\.isArray\(snapshot\)[\s\S]*catch \{[\s\S]*return null;/,
  'Queued cloud progress must be cloned through a fail-safe JSON boundary so invalid runtime state cannot crash learning interactions.',
);
requirePattern(
  /const snapshot = snapshotCloudState\(state\);[\s\S]{0,80}if \(!snapshot\) return;[\s\S]{0,120}latestState = \{ userId: session\.user\.id, state: snapshot \};/,
  'Cloud scheduling must reject invalid snapshots before mutating the pending queue and enqueue only the immutable clone.',
);
requirePattern(
  /const MAX_PUSH_DELAY_MS = 60_000;[\s\S]*function normalizeFlushDelay\(value: unknown, fallback = DEFAULT_PUSH_DELAY_MS\): number \{[\s\S]*Number\.isFinite\(value\)[\s\S]*Math\.min\(MAX_PUSH_DELAY_MS, Math\.floor\(value\)\)/,
  'Cloud scheduling delays must reject non-finite input and remain bounded before reaching setTimeout.',
);
requirePattern(
  /function queueFlush\(delayMs: number\): void \{[\s\S]*const safeDelay = normalizeFlushDelay\(delayMs, FOLLOW_UP_DELAY_MS\);[\s\S]*setTimeout\([\s\S]*safeDelay\);/,
  'Every queued cloud flush, including retry and handoff paths, must use a sanitized finite delay.',
);
requirePattern(
  /export function scheduleCloudStatePush\(state: LocalState, delayMs = DEFAULT_PUSH_DELAY_MS\): void \{[\s\S]*queueFlush\(normalizeFlushDelay\(delayMs\)\);/,
  'Caller-provided debounce delays must be normalized before scheduling cloud state.',
);
requirePattern(
  /const reconciled = await pullCloudState\(session, snapshot\.state\);[\s\S]*const currentBeforePush = loadCloudSession\(\);[\s\S]*await pushCloudState\(currentBeforePush, reconciled\.state\);/,
  'Cloud pushes must reconcile the queued snapshot and use the freshest verified session for the write, so refreshed credentials are not discarded.',
);
requirePattern(
  /const currentBeforePush = loadCloudSession\(\);[\s\S]*if \(!currentBeforePush \|\| currentBeforePush\.user\.id !== snapshot\.userId\) \{[\s\S]*throw new Error\('Cloud account changed during reconciliation\.'\);/,
  'Account identity must be rechecked after remote reconciliation and account changes must enter the normal handoff path.',
);
requirePattern(
  /let retryUserId: string \| null = null;[\s\S]*function resetRetryBackoff\(\): void \{[\s\S]*retryDelayMs = BASE_RETRY_DELAY_MS;[\s\S]*retryUserId = null;/,
  'Cloud retry state must retain the learner identity and provide an explicit account-safe reset.',
);
requirePattern(
  /function consumeRetryDelay\(userId: string\): number \{[\s\S]*if \(retryUserId !== userId\) \{[\s\S]*retryDelayMs = BASE_RETRY_DELAY_MS;[\s\S]*retryUserId = userId;[\s\S]*retryDelayMs = Math\.min\(MAX_RETRY_DELAY_MS, retryDelayMs \* 2\);/,
  'Exponential retry backoff must restart from the base delay when the failing learner changes.',
);
requirePattern(
  /if \(session\.user\.id !== snapshot\.userId\) \{[\s\S]*latestState = null;[\s\S]*resetRetryBackoff\(\);/,
  'A debounce timer must not send a queued snapshot through another learner session.',
);
requirePattern(
  /if \(current\.user\.id !== snapshot\.userId\) \{[\s\S]*if \(latestState\?\.userId === snapshot\.userId\) latestState = null;[\s\S]*resetRetryBackoff\(\);[\s\S]*if \(latestState\?\.userId === current\.user\.id\) queueFlush\(FOLLOW_UP_DELAY_MS\);/,
  'A failed stale-account request must reset old backoff and schedule the newly active learner snapshot instead of stranding it.',
);
requirePattern(
  /if \(!current\) \{[\s\S]*latestState\?\.userId === snapshot\.userId[\s\S]*resetRetryBackoff\(\);/,
  'Signing out during a failed push must clear only the stale learner retry and reset backoff.',
);
requirePattern(
  /queueFlush\(consumeRetryDelay\(snapshot\.userId\)\);/,
  'Transient cloud failures must consume bounded backoff for the learner that actually failed.',
);
requirePattern(
  /let activeFlush: Promise<boolean> \| null = null;/,
  'Cloud sync must retain the active reconciliation promise instead of using a lossy boolean lock.',
);
requirePattern(
  /async function flushLatestState\(\): Promise<boolean> \{[\s\S]*if \(activeFlush\) return activeFlush;[\s\S]*activeFlush = flush;[\s\S]*finally \{[\s\S]*if \(activeFlush === flush\) activeFlush = null;/,
  'Cloud sync must share in-flight work and always release the active reconciliation promise.',
);
requirePattern(
  /finally \{[\s\S]*const deferredDelay = deferredFlushDelayMs;[\s\S]*if \(latestState && !pendingPush\) \{[\s\S]*queueFlush\(deferredDelay \?\? FOLLOW_UP_DELAY_MS\);/,
  'A settled push must schedule any newer queued snapshot while preserving deferred retry timing.',
);

requirePattern(
  /function mergeMaxNumberRecord\([\s\S]*merged\[key\] = Math\.max\(merged\[key\] \?\? 0, value\);/,
  'Cross-device numeric progress maps must merge monotonically instead of letting a stale local value overwrite newer cloud progress.',
  accountSource,
);
requirePattern(
  /lessonAttempts: mergeMaxNumberRecord\(progress\?\.lesson_attempts, local\.lessonAttempts\)/,
  'Lesson attempt counts must preserve the highest count seen on either device.',
  accountSource,
);
requirePattern(
  /projectProgress: mergeMaxNumberRecord\(progress\?\.project_progress, local\.projectProgress, 100\)/,
  'Guided project progress must preserve the furthest completed percentage across devices.',
  accountSource,
);
requirePattern(
  /function mergeErrorTagRecord\([\s\S]*unique\(\[\.\.\.\(merged\[key\] \?\? \[\]\), \.\.\.remoteTags\]\)\.slice\(-12\)/,
  'Adaptive-practice error tags must be unioned across devices instead of replacing one device history.',
  accountSource,
);
requirePattern(
  /function mergeMastery\(remote: unknown, local: LocalState\['mastery'\]\): LocalState\['mastery'\]/,
  'Cross-device mastery must use a dedicated reconciliation boundary instead of shallow object overwrite.',
  accountSource,
);
requirePattern(
  /const preferred = remoteAt > localAt \? remoteSkill : localSkill;/,
  'Mastery score and review scheduling must prefer the most recently practiced device snapshot.',
  accountSource,
);
requirePattern(
  /const evidenceByKey = new Map<string, LocalState\['mastery'\]\[string\]\['evidence'\]\[number\]>\(\);[\s\S]*for \(const evidence of \[\.\.\.remoteEvidence, \.\.\.localEvidence\]\)/,
  'Mastery reconciliation must preserve evidence from both devices and deduplicate it by stable event identity.',
  accountSource,
);
requirePattern(
  /\.sort\(\(left, right\) => validIsoTimestamp\(left\.at\) - validIsoTimestamp\(right\.at\)\)[\s\S]*\.slice\(-20\);/,
  'Merged mastery evidence must remain chronological and bounded to the persisted history window.',
  accountSource,
);
requirePattern(
  /for \(let index = evidence\.length - 1; index >= 0; index -= 1\) \{[\s\S]*if \(!evidence\[index\]\?\.correct\) break;[\s\S]*consecutiveCorrect \+= 1;/,
  'Consecutive-correct mastery must be recomputed from merged evidence so a newer failure on either device resets the streak.',
  accountSource,
);
requirePattern(
  /attempts: Math\.max\(localSkill\.attempts, finiteCloudNumber\(remoteSkill\.attempts\)\)/,
  'Mastery attempt counters must not regress when devices reconcile.',
  accountSource,
);
requirePattern(
  /errorTags: unique\(\[\.\.\.\(localSkill\.errorTags \?\? \[\]\), \.\.\.\(Array\.isArray\(remoteSkill\.errorTags\)/,
  'Mastery error tags must preserve diagnostic context from both devices.',
  accountSource,
);
requirePattern(
  /mastery: mergeMastery\(progress\?\.mastery, local\.mastery\)/,
  'Supabase state merge must route mastery through cross-device reconciliation.',
  accountSource,
);
requirePattern(
  /portfolioProofs: mergePortfolioProofs\(progress\?\.portfolio_proofs, local\.portfolioProofs\)/,
  'Portfolio proofs must be reconciled by project identity instead of choosing one array only by length.',
  accountSource,
);
requirePattern(
  /remoteScore > currentScore[\s\S]*remoteScore === currentScore[\s\S]*remoteAt > currentAt/,
  'Conflicting portfolio proofs must prefer stronger evidence, then the newer proof when scores tie.',
  accountSource,
);
requirePattern(
  /const remoteCompleted = finiteCloudNumber\(progress\?\.daily_completed, 0, 0, 240\);[\s\S]*const remoteStreak = finiteCloudNumber\(progress\?\.streak, 0, 0, 100_000\);/,
  'Malformed non-finite daily counters from Supabase must be rejected before Math.max can poison valid local progress.',
  accountSource,
);
requirePattern(
  /xp: Math\.max\(local\.xp, finiteCloudNumber\(progress\?\.xp\)\),[\s\S]*nexCoins: Math\.max\(local\.nexCoins, finiteCloudNumber\(progress\?\.nexcoins\)\),/,
  'XP and NexCoins reconciliation must keep valid local totals when remote JSON contains NaN or Infinity.',
  accountSource,
);
requirePattern(
  /bestStreak: Math\.max\(local\.bestStreak, daily\.streak, finiteCloudNumber\(settings\.bestStreak, 0, 0, 100_000\)\),[\s\S]*dailyGoal: finiteCloudNumber\(progress\?\.daily_goal, local\.dailyGoal, 5, 240\),/,
  'Streak and daily-goal values from Supabase must be finite and bounded before merging.',
  accountSource,
);
requirePattern(
  /totalLearningMinutes: Math\.max\(local\.totalLearningMinutes, finiteCloudNumber\(settings\.totalLearningMinutes\)\),/,
  'Malformed cloud learning-minute totals must not erase a valid local total during sanitization.',
  accountSource,
);

console.log('Cloud sync audit OK: immutable fail-safe snapshots, bounded scheduling delays, remote reconciliation, finite scalar progress merges, freshest verified write sessions, account-scoped queueing and retry backoff, monotonic progress maps, cross-device mastery evidence, merged error evidence, portfolio reconciliation, bounded retries, shared in-flight work, and deferred follow-up flushes are protected.');

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
  /function snapshotCloudState\(state: LocalState\): LocalState \{[\s\S]*JSON\.parse\(JSON\.stringify\(state\)\) as LocalState;/,
  'Queued cloud progress must be cloned at scheduling time so later in-memory mutations cannot rewrite an existing snapshot.',
);
requirePattern(
  /latestState = \{ userId: session\.user\.id, state: snapshotCloudState\(state\) \};/,
  'Cloud scheduling must enqueue the immutable state snapshot rather than the caller-owned object reference.',
);
requirePattern(
  /const reconciled = await pullCloudState\(session, snapshot\.state\);[\s\S]*await pushCloudState\(reconciled\.session, reconciled\.state\);/,
  'Cloud pushes must reconcile the queued snapshot with the latest Supabase state before writing, so another device\'s newer progress is not blindly overwritten.',
);
requirePattern(
  /const currentBeforePush = loadCloudSession\(\);[\s\S]*if \(!currentBeforePush \|\| currentBeforePush\.user\.id !== snapshot\.userId\) \{[\s\S]*throw new Error\('Cloud account changed during reconciliation\.'\);/,
  'Account identity must be rechecked after remote reconciliation and account changes must enter the normal handoff path.',
);
requirePattern(
  /if \(session\.user\.id !== snapshot\.userId\) \{[\s\S]*latestState = null;[\s\S]*retryDelayMs = BASE_RETRY_DELAY_MS;/,
  'A debounce timer must not send a queued snapshot through another learner session.',
);
requirePattern(
  /if \(current\.user\.id !== snapshot\.userId\) \{[\s\S]*if \(latestState\?\.userId === snapshot\.userId\) latestState = null;[\s\S]*if \(latestState\?\.userId === current\.user\.id\) queueFlush\(FOLLOW_UP_DELAY_MS\);/,
  'A failed stale-account request must schedule the newly active learner snapshot instead of stranding it.',
);
requirePattern(
  /if \(!current\) \{[\s\S]*latestState\?\.userId === snapshot\.userId[\s\S]*retryDelayMs = BASE_RETRY_DELAY_MS;/,
  'Signing out during a failed push must clear only the stale learner retry and reset backoff.',
);
requirePattern(
  /retryDelayMs = Math\.min\(MAX_RETRY_DELAY_MS, retryDelayMs \* 2\)/,
  'Transient cloud failures must retain bounded exponential backoff.',
);
requirePattern(
  /finally \{[\s\S]*pushInFlight = false;[\s\S]*\}/,
  'Cloud sync must always release its in-flight lock, including account changes during reconciliation.',
);
requirePattern(
  /if \(latestState\) queueFlush\(FOLLOW_UP_DELAY_MS\);/,
  'A successful push must immediately follow up with any newer queued snapshot.',
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
  /portfolioProofs: mergePortfolioProofs\(progress\?\.portfolio_proofs, local\.portfolioProofs\)/,
  'Portfolio proofs must be reconciled by project identity instead of choosing one array only by length.',
  accountSource,
);
requirePattern(
  /remoteScore > currentScore[\s\S]*remoteScore === currentScore[\s\S]*remoteAt > currentAt/,
  'Conflicting portfolio proofs must prefer stronger evidence, then the newer proof when scores tie.',
  accountSource,
);

console.log('Cloud sync audit OK: immutable snapshots, remote reconciliation, account-scoped queueing, monotonic progress maps, merged error evidence, portfolio reconciliation, bounded retries, and follow-up flushes are protected.');

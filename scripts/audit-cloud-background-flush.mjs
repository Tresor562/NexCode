import fs from 'node:fs';

const cloudSync = fs.readFileSync(new URL('../src/lib/cloudSync.ts', import.meta.url), 'utf8');
const rootApp = fs.readFileSync(new URL('../src/ui/RootApp.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function extractFunctionBody(source, signature) {
  const signatureIndex = source.indexOf(signature);
  assert(signatureIndex >= 0, `missing function signature: ${signature}`);
  const bodyStart = source.indexOf('{', signatureIndex);
  assert(bodyStart >= 0, `missing function body: ${signature}`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart + 1, index);
    }
  }

  throw new Error(`unterminated function body: ${signature}`);
}

const immediateFlush = extractFunctionBody(
  cloudSync,
  'export async function flushCloudStateNow(): Promise<void>',
);
const snapshotBody = extractFunctionBody(
  cloudSync,
  'function snapshotCloudState(state: LocalState): LocalState | null',
);
const scheduleBody = extractFunctionBody(
  cloudSync,
  'export function scheduleCloudStatePush(state: LocalState, delayMs = DEFAULT_PUSH_DELAY_MS): void',
);
const initialClearIndex = immediateFlush.indexOf('clearPendingPush();');
const drainLoopIndex = immediateFlush.indexOf('while (latestState || activeFlush)');
const awaitFlushIndex = immediateFlush.indexOf('const completed = await flushLatestState();', drainLoopIndex);
const failedReturnIndex = immediateFlush.indexOf('if (!completed) return;', awaitFlushIndex);
const successfulClearIndex = immediateFlush.indexOf('clearPendingPush();', failedReturnIndex);

assert(
  /export\s+async\s+function\s+flushCloudStateNow\s*\(/.test(cloudSync),
  'cloud sync must expose an immediate flush boundary for lifecycle transitions',
);
assert(
  /let\s+activeFlush:\s*Promise<boolean>\s*\|\s*null/.test(cloudSync),
  'cloud sync must retain the active flush promise so lifecycle transitions can await in-flight work',
);
assert(
  /if\s*\(activeFlush\)\s*return\s+activeFlush/.test(cloudSync),
  'concurrent flush callers must join the existing Supabase reconciliation instead of returning early',
);
assert(
  /let\s+deferredFlushDelayMs:\s*number\s*\|\s*null/.test(cloudSync),
  'cloud sync must retain retry timing requested while a reconciliation is still unwinding',
);
assert(
  /let\s+deferredFlushPreservesBackoff\s*=\s*false/.test(cloudSync),
  'cloud sync must retain whether a deferred flush carries protected retry backoff',
);
assert(
  /deferredFlushDelayMs\s*=\s*deferredFlushDelayMs\s*===\s*null[\s\S]{0,220}Math\.max/.test(cloudSync),
  'multiple deferred flush requests must preserve the longest requested delay so a short follow-up cannot erase retry backoff',
);
assert(
  /deferredFlushPreservesBackoff\s*=\s*deferredFlushPreservesBackoff\s*\|\|\s*preserveBackoff/.test(cloudSync),
  'deferred flush requests must retain retry intent when any queued request is protected by backoff',
);
assert(
  /const\s+deferredDelay\s*=\s*deferredFlushDelayMs;[\s\S]{0,220}const\s+preserveDeferredBackoff\s*=\s*deferredFlushPreservesBackoff;[\s\S]{0,260}queueFlush\(deferredDelay\s*\?\?\s*FOLLOW_UP_DELAY_MS,\s*preserveDeferredBackoff\)/.test(cloudSync),
  'settled reconciliations must honor deferred retry timing and retry intent before using the normal follow-up delay',
);
assert(
  /deferredFlushDelayMs\s*=\s*null;[\s\S]{0,120}deferredFlushPreservesBackoff\s*=\s*false;/.test(cloudSync),
  'settled reconciliations must clear both deferred timing and retry intent before queueing the next flush',
);
assert(
  initialClearIndex >= 0 &&
    drainLoopIndex > initialClearIndex &&
    awaitFlushIndex > drainLoopIndex &&
    failedReturnIndex > awaitFlushIndex &&
    successfulClearIndex > failedReturnIndex,
  'background flush must drain all queued reconciliations, preserve a failed retry, and only cancel successful follow-up timers',
);
assert(
  /while\s*\(latestState\s*\|\|\s*activeFlush\)\s*\{[\s\S]*const\s+completed\s*=\s*await\s+flushLatestState\(\);[\s\S]*if\s*\(!completed\)\s*return;[\s\S]*clearPendingPush\(\);[\s\S]*\}/.test(immediateFlush),
  'background flush must keep draining state captured during reconciliation until no queued or in-flight work remains',
);
assert(
  !/const\s+completed\s*=\s*await\s+flushLatestState\(\);\s*clearPendingPush\(\);/.test(immediateFlush),
  'background flush must never clear the retry timer immediately after a failed Supabase reconciliation',
);
assert(
  failedReturnIndex >= 0,
  'background draining must stop after a failed/offline flush so exponential retry remains effective',
);
assert(
  /try\s*\{[\s\S]*JSON\.stringify\(state\)[\s\S]*JSON\.parse\(serialized\)[\s\S]*\}\s*catch\s*\{[\s\S]*return\s+null;/.test(snapshotBody),
  'cloud snapshot creation must contain JSON serialization failures instead of crashing learning interactions',
);
assert(
  /!snapshot\s*\|\|\s*typeof\s+snapshot\s*!==\s*['"]object['"]\s*\|\|\s*Array\.isArray\(snapshot\)/.test(snapshotBody),
  'cloud snapshots must reject non-object JSON roots before queueing',
);
assert(
  /const\s+snapshot\s*=\s*snapshotCloudState\(state\);[\s\S]{0,80}if\s*\(!snapshot\)\s*return;[\s\S]{0,120}latestState\s*=/.test(scheduleBody),
  'failed cloud snapshots must be dropped before mutating the pending queue',
);
assert(
  /AppState\.addEventListener\(['"]change['"]/.test(rootApp),
  'RootApp must listen for React Native AppState changes',
);
assert(
  /nextState\s*!==\s*['"]active['"][\s\S]{0,120}flushCloudStateNow\(\)/.test(rootApp),
  'leaving the active app state must flush queued learning progress immediately',
);
assert(
  /return\s*\(\)\s*=>\s*subscription\.remove\(\)/.test(rootApp),
  'AppState lifecycle listener must be removed on cleanup',
);

console.log('Cloud background flush audit passed: lifecycle flushes fully drain successful reconciliations while deferred retry timing and retry intent survive failures.');

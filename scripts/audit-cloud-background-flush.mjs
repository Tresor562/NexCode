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
const initialClearIndex = immediateFlush.indexOf('clearPendingPush();');
const awaitFlushIndex = immediateFlush.indexOf('const completed = await flushLatestState();');
const failedReturnIndex = immediateFlush.indexOf('if (!completed) return;');
const successfulClearIndex = immediateFlush.indexOf('clearPendingPush();', initialClearIndex + 1);
const drainIndex = immediateFlush.indexOf('if (latestState)');
const secondFlushIndex = immediateFlush.indexOf('await flushLatestState();', drainIndex);

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
  /deferredFlushDelayMs\s*=\s*deferredFlushDelayMs\s*===\s*null[\s\S]{0,220}Math\.min/.test(cloudSync),
  'multiple deferred flush requests must preserve the earliest requested safe deadline',
);
assert(
  /const\s+deferredDelay\s*=\s*deferredFlushDelayMs;[\s\S]{0,160}queueFlush\(deferredDelay\s*\?\?\s*FOLLOW_UP_DELAY_MS\)/.test(cloudSync),
  'settled reconciliations must honor deferred retry timing before using the normal follow-up delay',
);
assert(
  initialClearIndex >= 0 &&
    awaitFlushIndex > initialClearIndex &&
    failedReturnIndex > awaitFlushIndex &&
    successfulClearIndex > failedReturnIndex,
  'background flush must preserve a failed reconciliation retry and only cancel successful follow-up timers',
);
assert(
  !/const\s+completed\s*=\s*await\s+flushLatestState\(\);\s*clearPendingPush\(\);/.test(immediateFlush),
  'background flush must never clear the retry timer immediately after a failed Supabase reconciliation',
);
assert(
  drainIndex > successfulClearIndex && secondFlushIndex > drainIndex,
  'background flush must immediately drain a newer snapshot after a successful first reconciliation',
);
assert(
  failedReturnIndex >= 0,
  'background draining must stop after a failed/offline flush so exponential retry remains effective',
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

console.log('Cloud background flush audit passed.');

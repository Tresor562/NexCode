import fs from 'node:fs';

const cloudSync = fs.readFileSync(new URL('../src/lib/cloudSync.ts', import.meta.url), 'utf8');
const rootApp = fs.readFileSync(new URL('../src/ui/RootApp.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
  /clearPendingPush\(\);[\s\S]*const\s+completed\s*=\s*await\s+flushLatestState\(\);[\s\S]*clearPendingPush\(\)/.test(cloudSync),
  'immediate cloud flush must cancel timers around the awaited in-flight reconciliation',
);
assert(
  /if\s*\(completed\s*&&\s*latestState\)\s*\{[\s\S]{0,120}await\s+flushLatestState\(\)/.test(cloudSync),
  'background flush must immediately drain a newer snapshot queued while the first request was running',
);
assert(
  /if\s*\(completed\s*&&\s*latestState\)/.test(cloudSync),
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

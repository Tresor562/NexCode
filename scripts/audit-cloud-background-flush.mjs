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
  /clearPendingPush\(\);[\s\S]*await\s+flushLatestState\(\)/.test(cloudSync),
  'immediate cloud flush must cancel the debounce timer before flushing the latest snapshot',
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

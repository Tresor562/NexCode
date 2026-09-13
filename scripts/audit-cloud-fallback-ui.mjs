import fs from 'node:fs';

const source = fs.readFileSync('src/ui/RootApp.tsx', 'utf8');

const expectations = [
  ['typed fallback state', "type SyncNotice = { kind: 'offline-fallback'; message: string } | null;"],
  ['fallback state storage', 'const [syncNotice, setSyncNotice] = useState<SyncNotice>(null);'],
  ['fallback set only after pull failure', "setSyncNotice({\n          kind: 'offline-fallback'"],
  ['local state preserved before notice', 'bindLocalStateOwner(session.user.id);\n        saveLocalState(scopedLocal);\n        setSyncNotice({'],
  ['success clears stale fallback', 'setSession(refreshed);\n        setSyncNotice(null);'],
  ['accessible visible status', 'accessibilityRole="alert"'],
  ['polite announcement', 'accessibilityLiveRegion="polite"'],
  ['premium local fallback label', 'Mode local sécurisé'],
];

for (const [label, fragment] of expectations) {
  if (!source.includes(fragment)) {
    console.error(`Cloud fallback UI audit failed: missing ${label}.`);
    process.exit(1);
  }
}

const catchStart = source.indexOf('.catch(() => {');
const catchEnd = catchStart >= 0 ? source.indexOf('\n      })\n      .finally(', catchStart) : -1;
const noticeIndex = source.indexOf("kind: 'offline-fallback'", catchStart);
if (catchStart < 0 || catchEnd < 0 || noticeIndex < catchStart || noticeIndex > catchEnd) {
  console.error('Cloud fallback UI audit failed: fallback notice must originate from the cloud pull failure handler.');
  process.exit(1);
}

const cloudPullCatchBody = source.slice(catchStart, catchEnd);
if (cloudPullCatchBody.includes('setAuthError(')) {
  console.error('Cloud fallback UI audit failed: recoverable cloud pull failure must not eject the learner into auth error state.');
  process.exit(1);
}

console.log('Cloud fallback UI audit passed: cloud hydration failure preserves local progress and surfaces an accessible, non-blocking recovery state.');

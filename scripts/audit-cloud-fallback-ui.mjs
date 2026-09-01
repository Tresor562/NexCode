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

const catchIndex = source.indexOf('.catch(() => {');
const noticeIndex = source.indexOf("kind: 'offline-fallback'");
if (catchIndex < 0 || noticeIndex < catchIndex) {
  console.error('Cloud fallback UI audit failed: fallback notice must originate from cloud pull failure.');
  process.exit(1);
}

if (/catch\(\(\) => \{[\s\S]{0,500}setAuthError\(/.test(source)) {
  console.error('Cloud fallback UI audit failed: recoverable cloud pull failure must not eject the learner into auth error state.');
  process.exit(1);
}

console.log('Cloud fallback UI audit passed: cloud hydration failure preserves local progress and surfaces an accessible, non-blocking recovery state.');
import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/lib/cloudSync.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'cloudSync.ts',
}).outputText;

const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id === './cloudAccount') {
    return {
      isCloudConfigured: () => false,
      loadCloudSession: () => null,
      pullCloudState: async (_session, state) => ({ session: _session, state }),
      pushCloudState: async (session) => session,
    };
  }
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { sanitizeReconciledCloudActivityClock } = module.exports;
assert.equal(typeof sanitizeReconciledCloudActivityClock, 'function', 'cloud activity clock sanitizer must stay exported for executable audits');

const local = {
  xp: 120,
  nexCoins: 40,
  streak: 5,
  bestStreak: 8,
  lastActiveDate: '2026-09-06',
  dailyGoal: 20,
  dailyCompleted: 12,
  dailyGoalRewardDate: '2026-09-05',
};
const reference = new Date('2026-09-06T10:00:00+01:00');

const poisoned = {
  ...local,
  xp: 180,
  nexCoins: 70,
  streak: 999,
  lastActiveDate: '2099-01-01',
  dailyCompleted: 20,
  dailyGoalRewardDate: '2099-01-01',
};
const repaired = sanitizeReconciledCloudActivityClock(poisoned, local, reference);
assert.equal(repaired.lastActiveDate, local.lastActiveDate, 'impossible future cloud activity must not move the local streak day');
assert.equal(repaired.dailyCompleted, local.dailyCompleted, 'future cloud activity must not forge today\'s daily completion');
assert.equal(repaired.streak, local.streak, 'future cloud activity must not forge the active streak');
assert.equal(repaired.dailyGoalRewardDate, local.dailyGoalRewardDate, 'future cloud reward markers must not block a legitimate daily reward');
assert.equal(repaired.xp, poisoned.xp, 'monotonic XP reconciliation should remain intact while only day-scoped fields are repaired');
assert.equal(repaired.nexCoins, poisoned.nexCoins, 'monotonic NexCoins reconciliation should remain intact while only day-scoped fields are repaired');

const timezoneLead = {
  ...local,
  lastActiveDate: '2026-09-07',
  dailyCompleted: 4,
  streak: 6,
  dailyGoalRewardDate: '2026-09-07',
};
assert.equal(
  sanitizeReconciledCloudActivityClock(timezoneLead, local, reference),
  timezoneLead,
  'a legitimate adjacent calendar day from another timezone must stay accepted inside the 36-hour lead window',
);

const stale = {
  ...local,
  lastActiveDate: '2026-08-30',
  dailyCompleted: 20,
  streak: 2,
};
assert.equal(
  sanitizeReconciledCloudActivityClock(stale, local, reference),
  stale,
  'stale-but-valid dates are merge policy concerns and must not be misclassified as impossible clock data',
);

assert.match(source, /MAX_CLOUD_DATE_LEAD_MS\s*=\s*36\s*\*\s*60\s*\*\s*60\s*\*\s*1000/, 'the cross-timezone cloud clock tolerance must remain explicit and reviewable');
assert.match(source, /sanitizeReconciledCloudActivityClock\(reconciled\.state, snapshot\.state\)/, 'every background reconciliation must pass through the cloud activity clock boundary before upload');
assert.match(source, /pushCloudState\(currentBeforePush, safeReconciledState\)/, 'the repaired state, not the poisoned reconciliation, must be persisted back to Supabase');

console.log('Cloud activity clock audit OK: impossible future streak/daily dates fail closed without discarding legitimate monotonic XP or NexCoins reconciliation.');

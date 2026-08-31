import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/lib/localState.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'localState.ts',
}).outputText;

const fakeFile = {
  exists: true,
  create() {},
  write() {},
  textSync() { return ''; },
};
const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id === 'expo-file-system') {
    return {
      File: class { constructor() { return fakeFile; } },
      Paths: { document: '/tmp' },
    };
  }
  if (id.endsWith('/skillGraph') || id === '../learning/skillGraph') {
    return { masteryBand: () => 'practicing' };
  }
  if (id === './cloudSync') return { scheduleCloudStatePush() {} };
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { sanitizeLocalState, rewardProgress, localDateKey, touchDailyActivity } = module.exports;
assert.equal(typeof sanitizeLocalState, 'function', 'sanitizeLocalState must stay exported');
assert.equal(typeof rewardProgress, 'function', 'rewardProgress must stay exported');
assert.equal(typeof localDateKey, 'function', 'localDateKey must stay exported');
assert.equal(typeof touchDailyActivity, 'function', 'touchDailyActivity must stay exported');

const sanitized = sanitizeLocalState({
  projectProgress: {
    healthy: 67,
    oversized: 180,
    negative: -30,
    broken: Number.NaN,
  },
  installedOfflinePacks: [
    {
      id: 'html:chapter-1:standard:v3',
      courseId: 'html',
      kind: 'standard',
      chapterIds: ['intro', 'intro', 'layout'],
      estimatedMb: 12.8,
      includes: ['content', 'examples', 'content', 'unknown-capability'],
      curriculumVersion: 3,
    },
    {
      id: 'html:chapter-1:standard:v3',
      courseId: 'other',
      kind: 'full',
      chapterIds: ['ignored-duplicate'],
      estimatedMb: 999,
      includes: ['media'],
      curriculumVersion: 9,
    },
    {
      id: 'bad-kind',
      courseId: 'html',
      kind: 'ultra',
      chapterIds: ['intro'],
      estimatedMb: 5,
      includes: ['content'],
      curriculumVersion: 3,
    },
  ],
  portfolioProofs: [
    {
      projectId: ' portfolio-card ',
      title: ' Carte accessible\u0000 ',
      completedAt: '2026-08-27T03:00:00Z',
      score: 140,
      skillIds: ['html', 'html', ' css '],
      rubricIds: ['structure', 'structure'],
      evidenceSummary: '  Projet validé\u0007  ',
    },
    {
      projectId: 'missing-date',
      title: 'Invalide',
      completedAt: 'not-a-date',
      score: 90,
      skillIds: [],
      rubricIds: [],
      evidenceSummary: 'invalid',
    },
  ],
});

assert.deepEqual(sanitized.projectProgress, {
  healthy: 67,
  oversized: 100,
  negative: 0,
}, 'project progress must stay finite and bounded to 0..100');

assert.equal(sanitized.installedOfflinePacks.length, 1, 'invalid and duplicate offline packs must be dropped');
assert.deepEqual(sanitized.installedOfflinePacks[0], {
  id: 'html:chapter-1:standard:v3',
  courseId: 'html',
  kind: 'standard',
  chapterIds: ['intro', 'layout'],
  estimatedMb: 12,
  includes: ['content', 'examples'],
  curriculumVersion: 3,
});

assert.equal(sanitized.portfolioProofs.length, 1, 'portfolio proofs with invalid identity/date must be dropped');
assert.deepEqual(sanitized.portfolioProofs[0], {
  projectId: 'portfolio-card',
  title: 'Carte accessible',
  completedAt: '2026-08-27T03:00:00.000Z',
  score: 100,
  skillIds: ['html', 'css'],
  rubricIds: ['structure'],
  evidenceSummary: 'Projet validé',
});

const polluted = Object.create({ projectProgress: { bypass: 100 } });
assert.deepEqual(sanitizeLocalState(polluted).projectProgress, {}, 'prototype-inherited persisted state must fail closed');

const rewardNow = new Date(2026, 7, 27, 12, 0, 0, 0);
const rewardDay = localDateKey(rewardNow);
const rewardBase = sanitizeLocalState({
  xp: 100,
  nexCoins: 50,
  streak: 4,
  bestStreak: 7,
  lastActiveDate: rewardDay,
  dailyGoal: 20,
  dailyCompleted: 20,
  totalLearningMinutes: 200,
});

const repairedReward = rewardProgress(rewardBase, { xp: 12, nexCoins: 3, minutes: 0, now: rewardNow });
assert.equal(repairedReward.xp, 152, 'a reached daily goal without a reward marker must self-heal the +40 XP bonus');
assert.equal(repairedReward.nexCoins, 73, 'a reached daily goal without a reward marker must self-heal the +20 NexCoins bonus');
assert.equal(repairedReward.dailyGoalRewardDate, rewardDay, 'self-healed daily rewards must persist today as the claim date');

const noDuplicateReward = rewardProgress(repairedReward, { xp: 12, nexCoins: 3, minutes: 0, now: rewardNow });
assert.equal(noDuplicateReward.xp, 164, 'daily goal bonus must never be granted twice on the same local day');
assert.equal(noDuplicateReward.nexCoins, 76, 'NexCoins daily bonus must never be granted twice on the same local day');
assert.equal(noDuplicateReward.dailyGoalRewardDate, rewardDay);

const crossedReward = rewardProgress(sanitizeLocalState({
  xp: 10,
  nexCoins: 5,
  lastActiveDate: rewardDay,
  dailyGoal: 20,
  dailyCompleted: 15,
}), { xp: 12, nexCoins: 3, minutes: 5, now: rewardNow });
assert.equal(crossedReward.dailyCompleted, 20, 'normal goal crossing must still clamp progress to the daily goal');
assert.equal(crossedReward.xp, 62, 'normal goal crossing must still grant the lesson XP plus the daily XP bonus');
assert.equal(crossedReward.nexCoins, 28, 'normal goal crossing must still grant lesson NexCoins plus the daily NexCoins bonus');
assert.equal(crossedReward.dailyGoalRewardDate, rewardDay);

const impossibleFuture = new Date('2099-01-01T12:00:00.000Z');
const realDay = localDateKey(new Date());
const futureReward = rewardProgress(sanitizeLocalState({
  xp: 10,
  nexCoins: 5,
  streak: 9,
  bestStreak: 9,
  dailyGoal: 20,
  dailyCompleted: 0,
}), { xp: 12, nexCoins: 3, minutes: 5, now: impossibleFuture });
assert.equal(futureReward.lastActiveDate, realDay, 'an impossible future reward clock must fall back to the real local day');
assert.notEqual(futureReward.lastActiveDate, localDateKey(impossibleFuture), 'future reward clocks must never move the streak into an impossible day');

const futureTouch = touchDailyActivity(sanitizeLocalState({ streak: 3, bestStreak: 5 }), impossibleFuture);
assert.equal(futureTouch.lastActiveDate, realDay, 'direct daily activity touches must enforce the same clock boundary as rewards');
assert.notEqual(futureTouch.lastActiveDate, localDateKey(impossibleFuture));

assert.match(source, /MAX_PROGRESS_CLOCK_SKEW_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/, 'the progression clock skew boundary must remain explicit and reviewable');
assert.match(source, /value\.getTime\(\)\s*>\s*safeReference\.getTime\(\)\s*\+\s*MAX_PROGRESS_CLOCK_SKEW_MS/, 'future timestamps must be rejected at the shared progression clock boundary');

console.log('Local state sanitization audit OK: persisted learning state stays bounded, daily rewards stay exactly-once, and impossible future clocks cannot forge streak days.');

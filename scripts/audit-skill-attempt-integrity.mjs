import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/learning/skillGraph.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'skillGraph.ts',
}).outputText;

const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id.endsWith('/skillPrerequisites') || id === './skillPrerequisites') {
    return { prerequisiteRuleMap: () => new Map() };
  }
  return {};
};
new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);

const { recordSkillAttempt } = module.exports;
assert.equal(typeof recordSkillAttempt, 'function', 'recordSkillAttempt must stay exported');

const lesson = {
  id: 'js-array-lab',
  module: 'Arrays',
  activityKind: 'lab',
  skillIds: ['js-arrays'],
};

{
  const corrupted = {
    'js-arrays': {
      skillId: 'js-arrays',
      score: Number.NaN,
      confidence: Number.POSITIVE_INFINITY,
      band: 'mastered',
      attempts: Number.NaN,
      correctAttempts: Number.POSITIVE_INFINITY,
      consecutiveCorrect: -99,
      errorTags: null,
      evidence: null,
    },
  };
  const next = recordSkillAttempt(corrupted, lesson, true, new Date('2026-09-02T08:00:00.000Z'));
  const state = next['js-arrays'];
  assert.equal(state.score, 20, 'a corrupted score must normalize before applying the new attempt');
  assert.equal(state.attempts, 1, 'a corrupted attempt count must restart from a finite baseline');
  assert.equal(state.correctAttempts, 1, 'correct attempts must remain bounded by total attempts');
  assert.equal(state.consecutiveCorrect, 1, 'consecutive correct attempts must recover from malformed restored state');
  assert.deepEqual(state.errorTags, [], 'non-array error tags must not break attempt recording');
  assert.equal(state.evidence.length, 1, 'non-array evidence must not break attempt recording');
  assert.equal(state.lastPracticedAt, '2026-09-02T08:00:00.000Z');
  assert.ok(Number.isFinite(state.confidence), 'confidence must remain finite after recovery');
}

{
  const next = recordSkillAttempt({}, lesson, false, new Date(Number.NaN), 'array-index');
  const state = next['js-arrays'];
  assert.match(state.lastPracticedAt, /^\d{4}-\d{2}-\d{2}T/, 'an invalid caller clock must fall back to a usable runtime timestamp');
  assert.match(state.nextReviewAt, /^\d{4}-\d{2}-\d{2}T/, 'review scheduling must remain serializable after an invalid caller clock');
  assert.deepEqual(state.errorTags, ['array-index']);
}

{
  const restored = {
    'js-arrays': {
      skillId: 'js-arrays',
      score: 40,
      confidence: 44,
      band: 'learning',
      attempts: 2,
      correctAttempts: 2,
      consecutiveCorrect: 2,
      lastPracticedAt: '2026-09-04T12:00:00.000Z',
      nextReviewAt: '2026-09-07T12:00:00.000Z',
      errorTags: [],
      evidence: [],
    },
  };
  const next = recordSkillAttempt(restored, lesson, true, new Date('2026-09-04T11:00:00.000Z'));
  const state = next['js-arrays'];
  assert.equal(state.lastPracticedAt, '2026-09-04T12:00:00.001Z', 'a delayed synced attempt must not move practice time backwards');
  assert.ok(new Date(state.nextReviewAt).getTime() > new Date(state.lastPracticedAt).getTime(), 'review scheduling must advance from the monotonic attempt time');
  assert.equal(state.evidence.at(-1)?.at, state.lastPracticedAt, 'evidence time and mastery time must remain consistent');
}

{
  const restored = {
    'js-arrays': {
      skillId: 'js-arrays', score: 40, confidence: 44, band: 'learning', attempts: 2, correctAttempts: 2, consecutiveCorrect: 2,
      lastPracticedAt: '2026-09-04T12:00:00.000Z', nextReviewAt: '2026-09-07T12:00:00.000Z', errorTags: [], evidence: [],
    },
    'js-loops': {
      skillId: 'js-loops', score: 50, confidence: 50, band: 'learning', attempts: 3, correctAttempts: 2, consecutiveCorrect: 1,
      lastPracticedAt: '2026-09-04T13:30:00.000Z', nextReviewAt: '2026-09-07T13:30:00.000Z', errorTags: [], evidence: [],
    },
  };
  const multiSkillLesson = { ...lesson, id: 'js-array-loop-lab', skillIds: ['js-arrays', 'js-loops'] };
  const next = recordSkillAttempt(restored, multiSkillLesson, true, new Date('2026-09-04T12:30:00.000Z'));
  assert.equal(next['js-arrays'].lastPracticedAt, '2026-09-04T13:30:00.001Z', 'multi-skill attempts must advance past the newest restored skill timestamp');
  assert.equal(next['js-loops'].lastPracticedAt, '2026-09-04T13:30:00.001Z', 'one learning event must use one coherent timestamp across all affected skills');
}

assert.match(source, /function boundedCount\(value: unknown/, 'restored counters must pass through a bounded normalization helper');
assert.match(source, /function boundedScore\(value: unknown\)/, 'restored mastery scores must pass through a finite bounded normalization helper');
assert.match(source, /function latestPracticedTime\(map: MasteryMap, skillIds: string\[\]\)/, 'restored skill timestamps must share a latest-time boundary');
assert.match(source, /function monotonicAttemptTime\(map: MasteryMap, lesson: Lesson, candidate: Date\)/, 'attempt recording must enforce monotonic chronology');
assert.match(source, /latestMs \+ 1/, 'equal or stale attempt timestamps must advance beyond the latest stored instant');
assert.match(source, /const attemptTime = monotonicAttemptTime\(map, lesson, usableAttemptTime\(now\)\)/, 'attempt timestamps must cross both runtime-clock and monotonic-ordering boundaries before serialization');
assert.match(source, /Array\.isArray\(previous\.evidence\)/, 'restored evidence must be checked before spreading');
assert.match(source, /Array\.isArray\(previous\.errorTags\)/, 'restored error tags must be checked before spreading');

console.log('Skill attempt integrity audit OK: malformed restored mastery state, invalid clocks and delayed synced attempts cannot poison or rewind progression chronology.');

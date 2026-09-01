import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/learning/masteryEngine.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'masteryEngine.ts',
}).outputText;

const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id.endsWith('/skillGraph') || id === './skillGraph') {
    return {
      masteryBand: (score) => (score >= 85 ? 'mastered' : score >= 55 ? 'practicing' : score > 0 ? 'learning' : 'new'),
    };
  }
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { evaluateSkillGate, masterySnapshot } = module.exports;

assert.equal(typeof evaluateSkillGate, 'function', 'evaluateSkillGate must stay exported');
assert.equal(typeof masterySnapshot, 'function', 'masterySnapshot must stay exported');

const now = new Date('2026-08-23T12:00:00.000Z');
const evidence = [
  {
    lessonId: 'lab-dom-1',
    activityKind: 'lab',
    correct: true,
    scoreDelta: 20,
    at: '2026-08-23T09:00:00.000Z',
  },
  {
    lessonId: 'checkpoint-dom-2',
    activityKind: 'checkpoint',
    correct: true,
    scoreDelta: 24,
    at: '2026-08-23T10:00:00.000Z',
  },
];

const mastery = (confidence, overrides = {}) => ({
  dom: {
    skillId: 'dom',
    score: 90,
    confidence,
    band: 'mastered',
    attempts: 4,
    correctAttempts: 4,
    consecutiveCorrect: 4,
    lastPracticedAt: '2026-08-23T10:00:00.000Z',
    nextReviewAt: '2026-09-01T10:00:00.000Z',
    errorTags: [],
    evidence,
    ...overrides,
  },
});

{
  const result = evaluateSkillGate(['dom'], mastery(41), 70, now);
  assert.equal(result.passed, false, 'a high score with shallow confidence must not unlock a checkpoint gate');
  assert.deepEqual(result.weakSkills, ['dom']);
  assert.deepEqual(result.missingIndependentEvidence, []);
}

{
  const result = evaluateSkillGate(['dom'], mastery(70), 70, now);
  assert.equal(result.passed, true, 'sufficient score, confidence and distinct transfer evidence should pass');
  assert.deepEqual(result.weakSkills, []);
}

{
  const result = evaluateSkillGate(['dom'], mastery(54), 55, now);
  assert.equal(result.passed, false, 'regular lesson gates must also require confidence proportional to their score gate');
  assert.deepEqual(result.weakSkills, ['dom']);
}

{
  const result = evaluateSkillGate(['dom'], mastery(55), 55, now);
  assert.equal(result.passed, true, 'confidence equal to a lower lesson gate is sufficient when evidence is otherwise valid');
}

{
  const snapshot = masterySnapshot(
    'dom',
    mastery(90, { lastPracticedAt: '2026-09-23T12:00:00.000Z' }),
    now,
  );
  assert.equal(snapshot.effectiveScore, 0, 'far-future practice timestamps must not manufacture perfect retention');
  assert.equal(snapshot.needsReview, true, 'far-future practice timestamps should fail closed into review');
}

{
  const snapshot = masterySnapshot(
    'dom',
    mastery(90, { lastPracticedAt: '2026-08-23T12:04:00.000Z' }),
    now,
  );
  assert.equal(snapshot.effectiveScore, 90, 'small clock skew within five minutes should not punish legitimate practice');
}

{
  const snapshot = masterySnapshot('dom', mastery(90), new Date(Number.NaN));
  assert.equal(snapshot.effectiveScore, 0, 'an invalid runtime clock must fail closed instead of granting fresh retention');
}

{
  const result = evaluateSkillGate(['dom'], mastery(90, { score: Number.NaN }), 70, now);
  assert.equal(result.passed, false, 'a non-finite mastery score must fail closed instead of bypassing the gate');
  assert.deepEqual(result.missingSkills, ['dom']);
}

{
  const result = evaluateSkillGate(['dom'], mastery(Number.POSITIVE_INFINITY), 70, now);
  assert.equal(result.passed, false, 'a non-finite confidence value must fail closed instead of bypassing the gate');
  assert.deepEqual(result.weakSkills, ['dom']);
}

{
  const result = evaluateSkillGate(['dom'], mastery(90), Number.NaN, now);
  assert.equal(result.required, 100, 'a malformed gate threshold must normalize to the strictest supported requirement');
  assert.equal(result.passed, false, 'a malformed gate threshold must never fail open');
  assert.deepEqual(result.weakSkills, ['dom']);
}

assert.match(source, /function boundedPercent\(value: unknown, fallback = 0\)/, 'mastery percentages must share one bounded normalization boundary');
assert.match(source, /const normalizedRequired = boundedPercent\(required, 100\)/, 'invalid gate thresholds must fall back to the strictest requirement');

console.log('Mastery gate audit OK: score, confidence, thresholds and corrupted clocks all fail closed while valid evidence remains usable.');

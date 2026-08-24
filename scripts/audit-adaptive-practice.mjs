import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/learning/adaptivePractice.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'adaptivePractice.ts',
}).outputText;

let gatePasses = true;
let lastGateRequired = null;
const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id.endsWith('/masteryEngine') || id === './masteryEngine') {
    return {
      masterySnapshot: () => ({ effectiveScore: 0, needsReview: false, recurringErrors: [] }),
      remediationTargets: () => [],
      evaluateSkillGate: (_skillIds, _mastery, required) => {
        lastGateRequired = required;
        return {
          passed: gatePasses,
          score: gatePasses ? required : Math.max(0, required - 1),
          required,
          missingSkills: gatePasses ? [] : ['prerequisite'],
          weakSkills: [],
          missingIndependentEvidence: [],
        };
      },
    };
  }
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { buildAdaptivePool, planPracticeSession, recommendedSessionMessage } = module.exports;

assert.equal(typeof buildAdaptivePool, 'function', 'buildAdaptivePool must stay exported');
assert.equal(typeof planPracticeSession, 'function', 'planPracticeSession must stay exported');
assert.equal(typeof recommendedSessionMessage, 'function', 'recommendedSessionMessage must stay exported');

const activity = ({ courseId, lessonId, mode, minutes, skills = [], priority = 50 }) => ({
  courseId,
  lessonId,
  mode,
  priority,
  reason: `${mode}:${lessonId}`,
  estimatedMinutes: minutes,
  skillIds: skills,
});

{
  const course = {
    id: 'javascript',
    starterLessons: [
      { id: 'arrays-next', skillIds: ['arrays'], durationMin: 5, activityKind: 'learn' },
    ],
  };
  const graph = [
    { id: 'arrays', prerequisiteIds: ['variables'], prerequisiteGate: 55 },
  ];

  gatePasses = false;
  lastGateRequired = null;
  const blockedPool = buildAdaptivePool([course], graph, {}, []);
  assert.equal(blockedPool.length, 0, 'adaptive recommendations must not bypass an unmet mastery prerequisite gate');
  assert.equal(lastGateRequired, 55, 'the skill-specific prerequisite gate must be forwarded to mastery evaluation');

  gatePasses = true;
  const readyPool = buildAdaptivePool([course], graph, {}, []);
  assert.equal(readyPool.some((item) => item.lessonId === 'arrays-next'), true, 'the lesson should become recommendable once the mastery gate passes');
}

{
  const session = planPracticeSession([
    activity({ courseId: 'web', lessonId: 'repair-dom', mode: 'repair', minutes: 6, skills: ['dom'], priority: 150 }),
    activity({ courseId: 'js', lessonId: 'learn-array', mode: 'learn', minutes: 4, skills: ['array'], priority: 60 }),
  ], 10);
  assert.equal(session.activities[0]?.mode, 'repair', 'known recovery must anchor the session');
  assert.equal(session.activities.length, 2, 'new learning may follow once the pending recovery is actually covered');
  assert.equal(session.deferredRecoveryCount, 0);
}

{
  const session = planPracticeSession([
    activity({ courseId: 'web', lessonId: 'repair-css', mode: 'repair', minutes: 20, skills: ['css'], priority: 160 }),
    activity({ courseId: 'js', lessonId: 'learn-object', mode: 'learn', minutes: 4, skills: ['object'], priority: 60 }),
  ], 5);
  assert.equal(session.activities.length, 0, 'an oversized urgent recovery must not be bypassed by unrelated new content');
  assert.equal(session.blockedByRecovery, true);
  assert.match(recommendedSessionMessage(session), /réparation|révision/i);
}

{
  const session = planPracticeSession([
    activity({ courseId: 'web', lessonId: 'repair-dom', mode: 'repair', minutes: 6, skills: ['dom'], priority: 150 }),
    activity({ courseId: 'css', lessonId: 'review-grid', mode: 'review', minutes: 20, skills: ['grid'], priority: 130 }),
    activity({ courseId: 'js', lessonId: 'learn-array', mode: 'learn', minutes: 4, skills: ['array'], priority: 60 }),
  ], 10);
  assert.deepEqual(session.activities.map((item) => item.lessonId), ['repair-dom']);
  assert.equal(session.deferredRecoveryCount, 1, 'deferred recovery must be surfaced instead of silently replaced');
  assert.match(recommendedSessionMessage(session), /Il restera 1 récupération/);
}

{
  const session = planPracticeSession([
    activity({ courseId: 'html', lessonId: 'learn-html', mode: 'learn', minutes: 3, skills: ['html'], priority: 60 }),
    activity({ courseId: 'css', lessonId: 'learn-css', mode: 'learn', minutes: 3, skills: ['css'], priority: 59 }),
    activity({ courseId: 'js', lessonId: 'learn-js', mode: 'learn', minutes: 3, skills: ['js'], priority: 58 }),
  ], 10);
  assert.equal(session.activities.filter((item) => item.mode === 'learn').length, 1, 'short sessions must introduce at most one new concept');
}

{
  const session = planPracticeSession([
    activity({ courseId: 'web', lessonId: 'review-dom-a', mode: 'review', minutes: 4, skills: ['dom'], priority: 130 }),
    activity({ courseId: 'web', lessonId: 'review-dom-b', mode: 'review', minutes: 4, skills: ['dom'], priority: 120 }),
    activity({ courseId: 'css', lessonId: 'review-grid', mode: 'review', minutes: 4, skills: ['grid'], priority: 110 }),
  ], 10);
  assert.equal(session.activities.some((item) => item.lessonId === 'review-dom-a'), true);
  assert.equal(session.activities.some((item) => item.lessonId === 'review-dom-b'), false, 'duplicate recovery for the same skill should not crowd out another weakness');
  assert.equal(session.activities.some((item) => item.lessonId === 'review-grid'), true);
}

{
  const session = planPracticeSession([
    activity({ courseId: 'web', lessonId: 'repair-legacy-a', mode: 'repair', minutes: 3, skills: [], priority: 150 }),
    activity({ courseId: 'web', lessonId: 'review-legacy-b', mode: 'review', minutes: 9, skills: [], priority: 140 }),
    activity({ courseId: 'js', lessonId: 'learn-array', mode: 'learn', minutes: 3, skills: ['array'], priority: 60 }),
  ], 10);
  assert.deepEqual(session.activities.map((item) => item.lessonId), ['repair-legacy-a'], 'new learning must stay blocked while an unscoped legacy recovery is still pending');
  assert.equal(session.deferredRecoveryCount, 1, 'unscoped recovery must be counted explicitly when deferred');
  assert.match(recommendedSessionMessage(session), /Il restera 1 récupération/);
}

{
  const session = planPracticeSession([
    activity({ courseId: 'web', lessonId: 'repair-legacy-a', mode: 'repair', minutes: 3, skills: [], priority: 150 }),
    activity({ courseId: 'css', lessonId: 'review-legacy-b', mode: 'review', minutes: 3, skills: [], priority: 140 }),
    activity({ courseId: 'js', lessonId: 'learn-array', mode: 'learn', minutes: 3, skills: ['array'], priority: 60 }),
  ], 10);
  assert.deepEqual(session.activities.map((item) => item.lessonId), ['repair-legacy-a', 'review-legacy-b', 'learn-array'], 'new learning may resume only after every unscoped recovery has been covered');
  assert.equal(session.deferredRecoveryCount, 0);
}

console.log('Adaptive practice audit OK: mastery prerequisite gates, recovery priority, bounded fallback, deferred recovery visibility, unscoped recovery blocking, new-concept pacing and skill diversification are protected.');

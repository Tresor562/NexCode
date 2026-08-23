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

const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id.endsWith('/masteryEngine') || id === './masteryEngine') {
    return {
      masterySnapshot: () => ({ effectiveScore: 0, needsReview: false, recurringErrors: [] }),
      remediationTargets: () => [],
    };
  }
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { planPracticeSession, recommendedSessionMessage } = module.exports;

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

console.log('Adaptive practice audit OK: recovery priority, bounded fallback, deferred recovery visibility, new-concept pacing and skill diversification are protected.');

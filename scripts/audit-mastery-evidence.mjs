import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/learning/masteryEvidence.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'masteryEvidence.ts',
}).outputText;

const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id === './masteryEngine') {
    return {
      masterySnapshot: (_skillId, mastery) => {
        const state = mastery['skill-a'];
        return {
          effectiveScore: state?.score ?? 0,
          confidence: state?.confidence ?? 0,
          recurringErrors: [],
        };
      },
    };
  }
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { evidenceQuality } = module.exports;
assert.equal(typeof evidenceQuality, 'function', 'evidenceQuality must stay exported');

const NOW = new Date('2026-08-27T00:00:00.000Z');
const baseState = (overrides = {}) => ({
  'skill-a': {
    skillId: 'skill-a',
    score: 90,
    confidence: 90,
    band: 'mastered',
    attempts: 6,
    correctAttempts: 6,
    consecutiveCorrect: 4,
    lastPracticedAt: '2026-08-26T00:00:00.000Z',
    nextReviewAt: '2026-09-01T00:00:00.000Z',
    errorTags: [],
    evidence: [
      { lessonId: 'lab-a', activityKind: 'lab', correct: true, scoreDelta: 10, at: '2026-08-26T00:00:00.000Z' },
      { lessonId: 'project-a', activityKind: 'project', correct: true, scoreDelta: 10, at: '2026-08-26T00:00:00.000Z' },
      { lessonId: 'checkpoint-a', activityKind: 'checkpoint', correct: true, scoreDelta: 10, at: '2026-08-25T00:00:00.000Z' },
    ],
    ...overrides,
  },
});

{
  const quality = evidenceQuality('skill-a', baseState(), NOW);
  assert.equal(quality.recency, 100, 'recent valid evidence should stay fully recent');
  assert.equal(quality.transferable, true, 'project evidence should preserve transferability');
  assert.ok(Number.isFinite(quality.stability), 'stability must remain finite');
}

{
  const mastery = baseState({
    evidence: [
      { lessonId: 'project-future', activityKind: 'project', correct: true, scoreDelta: 10, at: '2026-09-15T00:00:00.000Z' },
    ],
  });
  const quality = evidenceQuality('skill-a', mastery, NOW);
  assert.equal(quality.recency, 0, 'far-future evidence must not manufacture fresh mastery');
  assert.equal(quality.transferable, false, 'far-future project evidence must not manufacture transferability');
  assert.equal(quality.diversity, 0, 'far-future evidence must not manufacture evidence diversity');
  assert.equal(quality.independence, 0, 'far-future evidence must not manufacture independent contexts');
}

{
  const mastery = baseState({
    evidence: [
      { lessonId: 'lab-valid', activityKind: 'lab', correct: true, scoreDelta: 10, at: '2026-08-26T00:00:00.000Z' },
      { lessonId: 'project-future', activityKind: 'project', correct: true, scoreDelta: 10, at: '2026-09-15T00:00:00.000Z' },
      { lessonId: 'boss-future', activityKind: 'boss', correct: true, scoreDelta: 10, at: 'invalid-date' },
    ],
  });
  const quality = evidenceQuality('skill-a', mastery, NOW);
  assert.equal(quality.diversity, 20, 'only timestamp-valid evidence may contribute to diversity');
  assert.equal(quality.independence, 25, 'only timestamp-valid independent evidence may count');
  assert.equal(quality.transferable, false, 'invalid or future transfer evidence must fail closed');
}

{
  const mastery = baseState({
    score: Number.NaN,
    confidence: Number.POSITIVE_INFINITY,
    consecutiveCorrect: Number.NaN,
  });
  const quality = evidenceQuality('skill-a', mastery, NOW);
  assert.ok(Number.isFinite(quality.stability), 'corrupted mastery values must not produce NaN stability');
  assert.equal(quality.stability, 0, 'invalid score/confidence/consecutive values should fail closed');
}

{
  const quality = evidenceQuality('skill-a', baseState(), new Date(Number.NaN));
  assert.equal(quality.recency, 0, 'an invalid runtime clock must fail closed instead of treating evidence as fresh');
  assert.equal(quality.diversity, 0, 'an invalid runtime clock must not preserve mastery diversity');
  assert.equal(quality.independence, 0, 'an invalid runtime clock must not preserve independent evidence');
  assert.equal(quality.transferable, false, 'an invalid runtime clock must not preserve transfer evidence');
}

console.log('Mastery evidence audit OK: only timestamp-valid evidence contributes to recency, diversity, independence and transferability.');

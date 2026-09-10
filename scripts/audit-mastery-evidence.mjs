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
const { evidenceQuality, masteryEvidenceGaps } = module.exports;
assert.equal(typeof evidenceQuality, 'function', 'evidenceQuality must stay exported');
assert.equal(typeof masteryEvidenceGaps, 'function', 'masteryEvidenceGaps must stay exported');

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
    evidence: [
      { lessonId: 'lab-valid', activityKind: 'lab', correct: true, scoreDelta: 10, at: '2026-08-26T00:00:00.000Z' },
      { lessonId: 'project-valid', activityKind: 'project', correct: true, scoreDelta: 10, at: '2026-08-26T00:00:00.000Z' },
      { lessonId: 'forged-kind', activityKind: 'instant-master', correct: true, scoreDelta: 99, at: '2026-08-26T00:00:00.000Z' },
    ],
  });
  const quality = evidenceQuality('skill-a', mastery, NOW);
  assert.equal(quality.diversity, 40, 'unknown restored activity kinds must not inflate evidence diversity');
  assert.equal(quality.independence, 50, 'known independent evidence should still count normally');
  assert.equal(quality.transferable, true, 'a valid project should keep legitimate transferability');
}

{
  const mastery = baseState({
    evidence: [
      { lessonId: 'same-project', activityKind: 'project', correct: true, scoreDelta: 10, at: '2026-08-26T00:00:00.000Z' },
      { lessonId: ' same-project ', activityKind: 'project', correct: true, scoreDelta: 10, at: '2026-08-26T00:00:00.000Z' },
      { lessonId: '\u0000same-project\u0007', activityKind: 'project', correct: true, scoreDelta: 10, at: '2026-08-26T00:00:00.000Z' },
    ],
  });
  const quality = evidenceQuality('skill-a', mastery, NOW);
  assert.equal(quality.independence, 25, 'whitespace and control-character variants of one context must not manufacture independent evidence');
  assert.equal(quality.transferable, true, 'a canonical valid project context should remain transferable');
}

{
  const mastery = baseState({
    evidence: [
      { lessonId: '   ', activityKind: 'project', correct: true, scoreDelta: 10, at: '2026-08-26T00:00:00.000Z' },
      { lessonId: 'x'.repeat(161), activityKind: 'boss', correct: true, scoreDelta: 10, at: '2026-08-26T00:00:00.000Z' },
    ],
  });
  const quality = evidenceQuality('skill-a', mastery, NOW);
  assert.equal(quality.diversity, 0, 'invalid context identities must fail closed for diversity');
  assert.equal(quality.independence, 0, 'invalid context identities must fail closed for independence');
  assert.equal(quality.transferable, false, 'invalid context identities must not manufacture transferability');
  assert.equal(quality.recency, 0, 'invalid context identities must not manufacture recent evidence');
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
  const quality = evidenceQuality('skill-a', baseState({ evidence: null }), NOW);
  assert.equal(quality.diversity, 0, 'non-array restored evidence must fail closed instead of crashing quality calculation');
  assert.equal(quality.independence, 0);
  assert.equal(quality.recency, 0);
  assert.equal(quality.transferable, false);
}

{
  const mastery = baseState({
    evidence: [
      null,
      'forged',
      { lessonId: 'missing-fields' },
      { lessonId: 'bad-score', activityKind: 'project', correct: true, scoreDelta: Number.NaN, at: '2026-08-26T00:00:00.000Z' },
      { lessonId: 'project-valid', activityKind: 'project', correct: true, scoreDelta: 10, at: '2026-08-26T00:00:00.000Z' },
    ],
  });
  const quality = evidenceQuality('skill-a', mastery, NOW);
  assert.equal(quality.diversity, 20, 'malformed restored entries must be discarded while legitimate evidence survives');
  assert.equal(quality.independence, 25);
  assert.equal(quality.transferable, true);
  assert.equal(quality.recency, 100);
}

{
  const quality = evidenceQuality('skill-a', baseState(), new Date(Number.NaN));
  assert.equal(quality.recency, 0, 'an invalid runtime clock must fail closed instead of treating evidence as fresh');
  assert.equal(quality.diversity, 0, 'an invalid runtime clock must not preserve mastery diversity');
  assert.equal(quality.independence, 0, 'an invalid runtime clock must not preserve independent evidence');
  assert.equal(quality.transferable, false, 'an invalid runtime clock must not preserve transfer evidence');
}

{
  const gaps = masteryEvidenceGaps([' skill-a ', 'skill-a', '', '\u0000forged', 'skill-missing'], baseState(), NOW);
  assert.deepEqual(gaps.map(({ skillId }) => skillId), ['skill-missing'], 'restored skill ids must be canonicalized and deduplicated before mastery gap ranking');
}

assert.match(source, /function usableEvidence\(value: unknown\)/, 'restored evidence quality must pass through an explicit runtime sanitation boundary');
assert.match(source, /slice\(-MAX_RESTORED_EVIDENCE\)/, 'restored evidence quality must bound the amount of cloud history processed per skill');
assert.match(source, /function canonicalSkillIds\(value: unknown\)/, 'mastery gap inputs must pass through an explicit canonical skill-id boundary');
assert.match(source, /canonicalSkillIds\(skillIds\)/, 'mastery gap ranking must consume canonicalized skill ids');

console.log('Mastery evidence audit OK: restored entries, skill ids, activity kind, timestamp and canonical context identity are all required before evidence can contribute to mastery quality.');

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

const { skillNeedsEvidence } = module.exports;
assert.equal(typeof skillNeedsEvidence, 'function', 'skillNeedsEvidence must stay exported');

const node = {
  id: 'js-arrays',
  title: 'Arrays',
  courseIds: ['javascript'],
  prerequisiteIds: [],
  prerequisiteGate: 55,
  lessonIds: [],
  evidenceLessonIds: [],
};

const NOW = new Date('2026-09-12T19:00:00.000Z');
const masteryWith = (evidence) => ({
  'js-arrays': {
    skillId: 'js-arrays',
    score: 85,
    confidence: 90,
    band: 'mastered',
    attempts: 6,
    correctAttempts: 6,
    consecutiveCorrect: 6,
    errorTags: [],
    evidence,
  },
});

{
  const mastery = masteryWith([
    { lessonId: 'lab-real', activityKind: 'lab', correct: true, scoreDelta: 20, at: '2026-09-12T18:30:00.000Z' },
    { lessonId: 'project-future', activityKind: 'project', correct: true, scoreDelta: 30, at: '2027-09-12T18:30:00.000Z' },
  ]);
  assert.equal(skillNeedsEvidence(node, mastery, NOW), true, 'far-future restored evidence must not manufacture a second progression context');
}

{
  const mastery = masteryWith([
    { lessonId: 'lab-real', activityKind: 'lab', correct: true, scoreDelta: 20, at: '2026-09-12T18:30:00.000Z' },
    { lessonId: 'project-invalid-clock', activityKind: 'project', correct: true, scoreDelta: 30, at: 'not-a-date' },
  ]);
  assert.equal(skillNeedsEvidence(node, mastery, NOW), true, 'invalid restored evidence clocks must fail closed for progression gates');
}

{
  const mastery = masteryWith([
    { lessonId: 'lab-real', activityKind: 'lab', correct: true, scoreDelta: 20, at: '2026-09-12T18:30:00.000Z' },
    { lessonId: 'project-real', activityKind: 'project', correct: true, scoreDelta: 30, at: '2026-09-12T18:45:00.000Z' },
  ]);
  assert.equal(skillNeedsEvidence(node, mastery, NOW), false, 'two legitimate independent contexts should still satisfy progression evidence');
}

{
  const mastery = masteryWith([
    { lessonId: 'lab-near-skew', activityKind: 'lab', correct: true, scoreDelta: 20, at: '2026-09-12T19:04:59.000Z' },
    { lessonId: 'project-real', activityKind: 'project', correct: true, scoreDelta: 30, at: '2026-09-12T18:45:00.000Z' },
  ]);
  assert.equal(skillNeedsEvidence(node, mastery, NOW), false, 'small device clock skew within five minutes should remain usable');
}

{
  const mastery = masteryWith([
    { lessonId: 'lab-real', activityKind: 'lab', correct: true, scoreDelta: 20, at: '2026-09-12T18:30:00.000Z' },
    { lessonId: 'project-real', activityKind: 'project', correct: true, scoreDelta: 30, at: '2026-09-12T18:45:00.000Z' },
  ]);
  assert.equal(skillNeedsEvidence(node, mastery, new Date(Number.NaN)), true, 'an invalid runtime clock must fail closed instead of preserving progression proof');
}

assert.match(source, /const MAX_FUTURE_EVIDENCE_SKEW_MS = 5 \* 60_000/, 'progression evidence must keep the same bounded future-skew tolerance as mastery evidence');
assert.match(source, /function evidenceTimeIsValid\(value: unknown, now: Date\)/, 'progression evidence needs an explicit timestamp trust boundary');
assert.match(source, /evidenceTimeIsValid\(item\.at, now\)/, 'skill evidence contexts must cross the timestamp trust boundary before counting');
assert.match(source, /skillNeedsEvidence\(node: SkillNode, mastery: MasteryMap, now = new Date\(\)\)/, 'skill evidence gates must accept a deterministic evaluation clock');

console.log('Skill evidence clock audit OK: invalid and implausibly future restored proof cannot unlock progression, while legitimate evidence and bounded device skew remain accepted.');

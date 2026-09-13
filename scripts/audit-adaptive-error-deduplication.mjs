import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/learning/adaptivePractice.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: 'adaptivePractice.ts',
}).outputText;

const snapshots = new Map();
const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id.endsWith('/masteryEngine') || id === './masteryEngine') {
    return {
      masterySnapshot: (skillId) => snapshots.get(skillId) ?? { effectiveScore: 60, needsReview: false, recurringErrors: [] },
      remediationTargets: () => [],
      evaluateSkillGate: () => ({ passed: true, score: 100, required: 55, missingSkills: [], weakSkills: [], missingIndependentEvidence: [] }),
    };
  }
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { buildAdaptivePool } = module.exports;
assert.equal(typeof buildAdaptivePool, 'function');

const recurring = { effectiveScore: 60, needsReview: false, recurringErrors: ['shared-misconception'] };
snapshots.set('skill-a', recurring);
snapshots.set('skill-b', recurring);

const course = {
  id: 'web',
  starterLessons: [{ id: 'multi-skill', skillIds: ['skill-a', 'skill-b'], durationMin: 6, activityKind: 'practice' }],
};
const [activity] = buildAdaptivePool([course], [], {}, ['multi-skill']);

assert.equal(activity?.mode, 'repair', 'a repeated misconception must still trigger targeted repair');
assert.equal(activity?.priority, 88, 'the same misconception mirrored across multiple skill snapshots must count once, not inflate repair priority');

snapshots.set('skill-b', { ...recurring, recurringErrors: ['shared-misconception', 'second-misconception'] });
const [twoErrors] = buildAdaptivePool([course], [], {}, ['multi-skill']);
assert.equal(twoErrors?.priority, 96, 'distinct misconceptions across a multi-skill lesson must each contribute once');

console.log('Adaptive error deduplication audit OK: mirrored multi-skill misconceptions do not inflate repair priority, while distinct misconceptions remain visible.');

import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/learning/pedagogy.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: 'pedagogy.ts',
}).outputText;

const exports = {};
const module = { exports };
new Function('require', 'exports', 'module', compiled)(() => ({}), exports, module);

const { beginnerCourseDepthPolicy, estimatedConceptCapacity } = module.exports;
assert.equal(typeof estimatedConceptCapacity, 'function', 'estimatedConceptCapacity must stay exported');
assert.equal(estimatedConceptCapacity(beginnerCourseDepthPolicy), 50, 'the default premium learning policy must preserve its 50-concept capacity');

const policy = (targetActivitiesPerCourse, minOccurrences) => ({
  targetActivitiesPerCourse,
  preferredChapterCount: { min: 1, max: 1 },
  preferredActivitiesPerChapter: { min: 1, max: 1 },
  phases: minOccurrences.map((value) => ({ kind: 'practice', purpose: 'audit', minOccurrences: value })),
  rules: [],
});

assert.equal(estimatedConceptCapacity(policy(Number.NaN, [1])), 0, 'NaN target counts must fail closed instead of leaking NaN');
assert.equal(estimatedConceptCapacity(policy(Number.POSITIVE_INFINITY, [1])), 0, 'infinite target counts must fail closed');
assert.equal(estimatedConceptCapacity(policy(500, [])), 0, 'a policy without learning phases must not divide by zero');
assert.equal(estimatedConceptCapacity(policy(500, [0, -3, Number.NaN])), 0, 'non-positive or non-finite phase occurrence counts must not create fake capacity');
assert.equal(estimatedConceptCapacity(policy(500.9, [2.9, 3.2])), 100, 'fractional telemetry/config values must be normalized to whole authored activities');

console.log('Pedagogy capacity audit OK: malformed course-depth policies fail closed and valid policies keep deterministic whole-activity capacity.');

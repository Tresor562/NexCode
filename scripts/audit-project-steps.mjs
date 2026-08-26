import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/learning/projectEngine.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'projectEngine.ts',
}).outputText;

const exports = {};
const module = { exports };
new Function('require', 'exports', 'module', compiled)(() => ({}), exports, module);
const { nextProjectStep } = module.exports;
assert.equal(typeof nextProjectStep, 'function', 'nextProjectStep must stay exported');

const project = {
  id: 'three-step-project',
  title: 'Projet 3 étapes',
  description: 'Audit du rythme de progression.',
  track: 'web',
  tech: 'HTML/CSS/JS',
  estimatedMinutes: 30,
  skills: [],
  steps: ['Structure', 'Style', 'Interaction'],
};

assert.deepEqual(
  nextProjectStep(project, 33),
  { completedSteps: 1, nextStep: 'Style', complete: false },
  '33% persisted progress must restore to 1/3 completed steps',
);
assert.deepEqual(
  nextProjectStep(project, 67),
  { completedSteps: 2, nextStep: 'Interaction', complete: false },
  '67% persisted progress must restore to 2/3 completed steps',
);
assert.equal(nextProjectStep(project, 100).completedSteps, 3, '100% must restore all steps as complete');
assert.equal(nextProjectStep(project, 100).complete, true, '100% must mark the project complete');
assert.equal(nextProjectStep(project, Number.NaN).completedSteps, 0, 'NaN progress must fail safely to zero steps');
assert.equal(nextProjectStep(project, -50).completedSteps, 0, 'negative progress must be clamped to zero');
assert.equal(nextProjectStep(project, 999).completedSteps, 3, 'progress above 100 must be clamped to the final step');
assert.equal(nextProjectStep(project, 999).complete, true, 'clamped over-100 progress must remain complete');

console.log('Project step audit OK: rounded persisted progress restores exact guided-project steps and invalid values fail safely.');

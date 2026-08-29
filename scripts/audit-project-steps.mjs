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
assert.deepEqual(
  nextProjectStep(project, 99.9),
  { completedSteps: 2, nextStep: 'Interaction', complete: false },
  'near-complete progress must not infer the final step before the project is truly complete',
);
assert.deepEqual(
  nextProjectStep(project, 100),
  { completedSteps: 3, nextStep: undefined, complete: true },
  '100% must restore all steps and expose no remaining next step',
);
assert.equal(nextProjectStep(project, Number.NaN).completedSteps, 0, 'NaN progress must fail safely to zero steps');
assert.equal(nextProjectStep(project, -50).completedSteps, 0, 'negative progress must be clamped to zero');
assert.equal(nextProjectStep(project, 999).completedSteps, 3, 'progress above 100 must be clamped to the final step');
assert.equal(nextProjectStep(project, 999).complete, true, 'clamped over-100 progress must remain complete');
assert.equal(nextProjectStep(project, 999).nextStep, undefined, 'completed projects must not expose a stale next step');

const emptyProject = { ...project, id: 'empty-project', steps: [] };
assert.deepEqual(
  nextProjectStep(emptyProject, 0),
  { completedSteps: 0, nextStep: undefined, complete: false },
  'empty projects must fail safely without indexing a phantom step',
);

console.log('Project step audit OK: persisted progress restores coherent guided-project steps, near-complete snapshots cannot infer completion, and invalid values fail safely.');

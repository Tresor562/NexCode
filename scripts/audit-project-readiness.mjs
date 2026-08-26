import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/learning/projectPortfolioEngine.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'projectPortfolioEngine.ts',
}).outputText;

const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id.endsWith('/projectEngine') || id === './projectEngine') {
    return {
      defaultProjectRubric: () => [],
      reviewProject: () => ({ passed: false, score: 0 }),
    };
  }
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { projectReadinessAgainstGraph } = module.exports;
assert.equal(typeof projectReadinessAgainstGraph, 'function', 'projectReadinessAgainstGraph must stay exported');

const project = {
  id: 'web-card',
  title: 'Carte Web',
  description: 'Construire une carte accessible.',
  track: 'web',
  tech: 'HTML/CSS',
  estimatedMinutes: 30,
  steps: ['Structure', 'Style'],
  skills: ['HTML structure'],
};
const graph = [{ id: 'html-structure', title: 'HTML structure' }];
const state = (score, confidence) => ({
  'html-structure': {
    skillId: 'html-structure',
    score,
    confidence,
    band: 'practicing',
    attempts: 3,
    correctAttempts: 2,
    consecutiveCorrect: 1,
    lastPracticedAt: '2026-08-26T08:00:00.000Z',
    nextReviewAt: '2026-08-27T08:00:00.000Z',
    errorTags: [],
    evidence: [],
  },
});

{
  const result = projectReadinessAgainstGraph(project, graph, state(Number.NaN, 90), 55);
  assert.equal(result.ready, false, 'NaN score must fail closed instead of bypassing the weak-skill gate');
  assert.deepEqual(result.weakSkillIds, ['html-structure']);
  assert.equal(result.score, 23, 'readiness summary must clamp invalid score before blending confidence');
}

{
  const result = projectReadinessAgainstGraph(project, graph, state(90, Number.NaN), 55);
  assert.equal(result.ready, false, 'NaN confidence must fail closed');
  assert.deepEqual(result.uncertainSkillIds, ['html-structure']);
  assert.equal(result.score, 68, 'readiness summary must clamp invalid confidence before blending');
}

{
  const result = projectReadinessAgainstGraph(project, graph, state(180, 140), 55);
  assert.equal(result.ready, true, 'out-of-range persisted mastery should be bounded, not treated as impossible data');
  assert.equal(result.score, 100, 'readiness score must never exceed 100');
}

{
  const result = projectReadinessAgainstGraph(project, graph, state(-20, -5), 55);
  assert.equal(result.ready, false, 'negative mastery values must be bounded to zero');
  assert.equal(result.score, 0, 'readiness score must never fall below zero');
}

console.log('Project readiness audit OK: corrupted mastery values are bounded and fail closed consistently.');

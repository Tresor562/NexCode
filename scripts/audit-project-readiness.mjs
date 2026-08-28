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
const { projectReadinessAgainstGraph, resolveProjectSkills } = module.exports;
assert.equal(typeof projectReadinessAgainstGraph, 'function', 'projectReadinessAgainstGraph must stay exported');
assert.equal(typeof resolveProjectSkills, 'function', 'resolveProjectSkills must stay exported');

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

{
  const result = projectReadinessAgainstGraph(project, graph, state(10, 90), Number.NaN);
  assert.equal(result.ready, false, 'an invalid readiness gate must fall back to the product default instead of silently becoming permissive');
  assert.deepEqual(result.weakSkillIds, ['html-structure']);
}

{
  const result = projectReadinessAgainstGraph(project, graph, state(10, 90), -20);
  assert.equal(result.ready, true, 'a finite readiness gate below zero should be bounded to zero rather than producing contradictory comparisons');
}

{
  const result = projectReadinessAgainstGraph(project, graph, state(100, 100), 180);
  assert.equal(result.ready, true, 'a finite readiness gate above 100 should be bounded to the maximum valid percentage');
}

{
  const partiallyMappedProject = {
    ...project,
    skills: ['HTML structure', 'Mystery deployment skill'],
  };
  const result = projectReadinessAgainstGraph(partiallyMappedProject, graph, state(100, 100), 55);
  assert.equal(result.ready, false, 'an unmapped prerequisite must keep the project not ready');
  assert.deepEqual(result.unresolvedSkillLabels, ['Mystery deployment skill']);
  assert.equal(result.score, 50, 'unmapped prerequisite labels must lower the readiness percentage instead of showing a misleading 100%');
}

{
  const duplicateProject = {
    ...project,
    skills: [' HTML structure ', 'html-structure', 'HTML   structure', '', '   '],
  };
  const resolved = resolveProjectSkills(duplicateProject, graph);
  assert.deepEqual(resolved.map((item) => item.requested), ['HTML structure'], 'equivalent project prerequisites must collapse to one canonical identity');
  const result = projectReadinessAgainstGraph(duplicateProject, graph, state(100, 100), 55);
  assert.equal(result.score, 100, 'duplicated prerequisite labels must not distort readiness weighting');
  assert.deepEqual(result.skillIds, ['html-structure']);
}

console.log('Project readiness audit OK: mastery values and readiness gates are bounded, unresolved skills lower readiness honestly, and duplicate prerequisite labels cannot distort project readiness.');

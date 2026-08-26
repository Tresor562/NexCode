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
const { projectReadiness } = module.exports;
assert.equal(typeof projectReadiness, 'function', 'projectReadiness must stay exported');

const project = {
  id: 'legacy-web-project',
  title: 'Legacy Web Project',
  description: 'Readiness safety fixture',
  track: 'web',
  tech: 'HTML/CSS',
  estimatedMinutes: 30,
  steps: ['Structure'],
  skills: ['html', 'css'],
};

const masteryState = (htmlScore, cssScore) => ({
  html: { skillId: 'html', score: htmlScore },
  css: { skillId: 'css', score: cssScore },
});

{
  const result = projectReadiness(project, masteryState(Number.NaN, 80), 55);
  assert.equal(result.ready, false, 'NaN mastery must fail closed');
  assert.deepEqual(result.weakSkills, ['html']);
  assert.equal(result.score, 40, 'invalid mastery must be clamped before averaging');
}

{
  const result = projectReadiness(project, masteryState(-20, 180), 55);
  assert.equal(result.ready, false, 'negative mastery must stay weak');
  assert.deepEqual(result.weakSkills, ['html']);
  assert.equal(result.score, 50, 'out-of-range mastery must stay within 0..100 before averaging');
}

{
  const result = projectReadiness(project, masteryState(60, 60), Number.NaN);
  assert.equal(result.ready, true, 'invalid gate should normalize instead of poisoning readiness');
  assert.equal(result.score, 60);
}

{
  const result = projectReadiness(project, { html: { skillId: 'html', score: 90 } }, 55);
  assert.equal(result.ready, false, 'missing mastery must still block readiness');
  assert.deepEqual(result.missingSkills, ['css']);
  assert.equal(result.score, 45, 'missing mastery contributes zero to the readiness summary');
}

console.log('Project engine readiness audit OK: invalid mastery and gate values are bounded fail-safe.');

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
  assert.equal(result.ready, true, 'invalid gate should use the default gate when mastery is strong enough');
  assert.equal(result.score, 60);
}

{
  const result = projectReadiness(project, masteryState(10, 10), Number.NaN);
  assert.equal(result.ready, false, 'invalid gate must not collapse to zero and unlock weak projects');
  assert.deepEqual(result.weakSkills, ['html', 'css']);
  assert.equal(result.score, 10);
}

{
  const result = projectReadiness(project, masteryState(10, 10), -25);
  assert.equal(result.ready, false, 'negative gates must fall back to the product default');
  assert.deepEqual(result.weakSkills, ['html', 'css']);
}

{
  const result = projectReadiness(project, masteryState(60, 60), 140);
  assert.equal(result.ready, true, 'gates above 100 must fall back to the product default');
  assert.deepEqual(result.weakSkills, []);
}

{
  const result = projectReadiness(project, masteryState(0, 0), 0);
  assert.equal(result.ready, true, 'an explicit zero gate remains a valid caller choice');
  assert.deepEqual(result.weakSkills, []);
}

{
  const result = projectReadiness(project, { html: { skillId: 'html', score: 90 } }, 55);
  assert.equal(result.ready, false, 'missing mastery must still block readiness');
  assert.deepEqual(result.missingSkills, ['css']);
  assert.equal(result.score, 45, 'missing mastery contributes zero to the readiness summary');
}

{
  const noisyProject = {
    ...project,
    skills: [' html ', 'css', 'html', '', '   ', 'css'],
  };
  const result = projectReadiness(noisyProject, masteryState(80, 60), 55);
  assert.equal(result.ready, true, 'whitespace and duplicate prerequisite labels must not create fake readiness gaps');
  assert.deepEqual(result.missingSkills, []);
  assert.deepEqual(result.weakSkills, []);
  assert.equal(result.score, 70, 'duplicate prerequisite labels must not bias the readiness average');
}

{
  const duplicatedWeakProject = {
    ...project,
    skills: ['html', 'html', 'css'],
  };
  const result = projectReadiness(duplicatedWeakProject, masteryState(10, 90), 55);
  assert.equal(result.ready, false);
  assert.deepEqual(result.weakSkills, ['html'], 'a weak prerequisite should be reported once even if content data repeats it');
  assert.equal(result.score, 50, 'repeated weak skills must not overweight the readiness score');
}

console.log('Project engine readiness audit OK: mastery, gates and prerequisite identities stay canonical and bounded.');

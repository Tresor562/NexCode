import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/workspaceSafety.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'workspace-safety-mission-isolation-audit.ts',
}).outputText;

const exports = {};
const module = { exports };
new Function('exports', 'module', 'require', compiled)(exports, module, () => ({}));
const { restoreWorkspaceDraft } = module.exports;

assert.equal(typeof restoreWorkspaceDraft, 'function', 'Lab mission isolation must stay executable');

const fallbackFiles = {
  'index.html': '<main>Trusted starter</main>',
  'script.js': 'console.log("starter")',
};
const options = {
  expectedMissionId: 'project:new-mission',
  expectedLanguage: 'Web',
  fallbackFiles,
};

for (const missionId of ['', undefined, 'project:old-mission']) {
  const result = restoreWorkspaceDraft({
    ...options,
    stored: {
      missionId,
      language: 'Web',
      files: { 'index.html': '<main>Stale foreign code</main>' },
      activeFile: 'index.html',
      updatedAt: new Date().toISOString(),
      passedCriteria: ['foreign-proof'],
      lastValidatedAt: new Date().toISOString(),
    },
  });

  assert.equal(result.repaired, true, 'Missing or foreign mission identity must force a fresh Lab workspace');
  assert.deepEqual(result.draft.files, fallbackFiles, 'Foreign mission code must never cross the mission boundary');
  assert.equal(result.draft.missionId, options.expectedMissionId, 'Fresh workspace must bind to the requested mission');
  assert.equal(result.draft.lastValidatedAt, undefined, 'Foreign validation timestamps must not cross mission boundaries');
  assert.equal(result.draft.passedCriteria, undefined, 'Foreign validation criteria must not cross mission boundaries');
}

const firstFresh = restoreWorkspaceDraft(options).draft;
assert.notEqual(firstFresh.files, fallbackFiles, 'Fresh Lab state must own its file map instead of aliasing trusted starter data');
firstFresh.files['index.html'] = '<main>Edited learner copy</main>';
assert.equal(fallbackFiles['index.html'], '<main>Trusted starter</main>', 'Editing a restored draft must never mutate canonical starter files');

const secondFresh = restoreWorkspaceDraft(options).draft;
assert.equal(secondFresh.files['index.html'], '<main>Trusted starter</main>', 'Later sessions must still receive pristine starter files');

console.log('Lab mission isolation audit OK: foreign/missing mission drafts fail closed and starter files remain immutable across sessions.');

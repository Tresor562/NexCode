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
  fileName: 'workspace-validation-freshness-audit.ts',
}).outputText;

const exports = {};
const module = { exports };
new Function('exports', 'module', 'require', compiled)(exports, module, () => ({}));
const { restoreWorkspaceDraft } = module.exports;

const options = {
  expectedMissionId: 'project:demo',
  expectedLanguage: 'Web',
  fallbackFiles: { 'index.html': '<main>Fallback</main>' },
};

const clean = {
  missionId: 'project:demo',
  language: 'Web',
  files: { 'index.html': '<main>NexCode</main>' },
  activeFile: 'index.html',
  updatedAt: '2026-09-05T18:00:00.000Z',
  lastValidatedAt: '2026-09-05T18:00:00.000Z',
  passedCriteria: ['preview'],
};

{
  const result = restoreWorkspaceDraft({ ...options, stored: clean });
  assert.equal(result.repaired, false, 'Validation stamped with the saved workspace must remain valid');
  assert.deepEqual(result.draft.passedCriteria, ['preview']);
}

{
  const result = restoreWorkspaceDraft({
    ...options,
    stored: {
      ...clean,
      updatedAt: '2026-09-05T18:04:00.000Z',
      lastValidatedAt: '2026-09-05T18:00:00.000Z',
    },
  });
  assert.equal(result.repaired, true, 'A workspace edited after validation must be repaired on restore');
  assert.equal(result.draft.lastValidatedAt, undefined, 'Stale validation timestamps must be cleared');
  assert.deepEqual(result.draft.passedCriteria, [], 'Stale criteria must never survive sync/restoration');
}

console.log('Workspace validation freshness audit OK: synced Lab criteria cannot outlive later edits.');

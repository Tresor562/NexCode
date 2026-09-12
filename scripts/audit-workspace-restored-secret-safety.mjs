import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/lib/workspaceSafety.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'workspace-restored-secret-safety-audit.ts',
}).outputText;

const exports = {};
const module = { exports };
new Function('exports', 'module', 'require', compiled)(exports, module, () => ({}));
const { restoreWorkspaceDraft, containsLikelyWorkspaceSecret } = module.exports;

assert.equal(typeof restoreWorkspaceDraft, 'function');
assert.equal(typeof containsLikelyWorkspaceSecret, 'function');
assert.match(
  source,
  /containsLikelyWorkspaceSecret\(rawContent\)/,
  'Persisted or cloud-restored Lab files must pass through the same content-secret guard as fresh imports and validation.',
);

const options = {
  expectedMissionId: 'project:secret-restore',
  expectedLanguage: 'Web',
  fallbackFiles: { 'index.html': '<main>Fallback</main>' },
};
const base = {
  missionId: 'project:secret-restore',
  language: 'Web',
  activeFile: 'index.html',
  updatedAt: new Date().toISOString(),
};

{
  const result = restoreWorkspaceDraft({
    ...options,
    stored: {
      ...base,
      files: {
        'index.html': '<main>Safe</main>',
        'src/config.js': 'export const token = "ghp_123456789012345678901234567890";',
      },
      activeFile: 'src/config.js',
    },
  });
  assert.equal(result.repaired, true, 'A restored workspace containing a pasted service token must be repaired.');
  assert.deepEqual(result.draft.files, { 'index.html': '<main>Safe</main>' }, 'Safe files must survive while secret-bearing files are removed.');
  assert.equal(result.draft.activeFile, 'index.html', 'The active file must move to a surviving safe file when the restored active file contains a secret.');
  assert.deepEqual(result.draft.passedCriteria, [], 'Repairing secret-bearing content must invalidate stale validation evidence.');
}

{
  const result = restoreWorkspaceDraft({
    ...options,
    stored: {
      ...base,
      files: {
        'src/config.js': 'const stripe = "sk_live_12345678901234567890";',
      },
      activeFile: 'src/config.js',
    },
  });
  assert.equal(result.repaired, true);
  assert.deepEqual(result.draft.files, options.fallbackFiles, 'A restored workspace made only of secret-bearing files must fail closed to trusted starter files.');
}

console.log('Restored workspace secret safety audit OK: persisted and synced Lab drafts cannot reintroduce obvious service credentials.');

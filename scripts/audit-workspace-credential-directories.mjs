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
  fileName: 'workspace-safety-credential-audit.ts',
}).outputText;

const exports = {};
const module = { exports };
new Function('exports', 'module', 'require', compiled)(exports, module, () => ({}));
const { isSensitiveWorkspaceFilename, restoreWorkspaceDraft } = module.exports;

assert.equal(isSensitiveWorkspaceFilename('.kube/config'), true, 'Kubernetes credential directories must stay blocked');
assert.equal(isSensitiveWorkspaceFilename('backup/.KUBE/config'), true, 'Credential directory detection must be case-insensitive');
assert.equal(isSensitiveWorkspaceFilename('.docker/config.json'), true, 'Docker auth directories must stay blocked');
assert.equal(isSensitiveWorkspaceFilename('archive/.Docker/config.json'), true, 'Nested Docker auth directories must stay blocked');
assert.equal(isSensitiveWorkspaceFilename('src/kube/client.ts'), false, 'Normal learner source paths containing kube as a word must remain allowed');
assert.equal(isSensitiveWorkspaceFilename('src/docker/client.ts'), false, 'Normal learner source paths containing docker as a word must remain allowed');

const stored = {
  missionId: 'project:credentials',
  language: 'Web',
  files: {
    'src/app.js': 'console.log("safe learner work")',
    '.kube/config': 'apiVersion: v1',
    '.docker/config.json': '{"auths":{"registry.example":{"auth":"opaque"}}}',
  },
  activeFile: '.docker/config.json',
  updatedAt: new Date().toISOString(),
};
const result = restoreWorkspaceDraft({
  stored,
  expectedMissionId: 'project:credentials',
  expectedLanguage: 'Web',
  fallbackFiles: { 'index.html': '<main>Fallback</main>' },
});

assert.equal(result.repaired, true, 'Restoration must repair workspaces that contain credential directories');
assert.deepEqual(result.draft.files, { 'src/app.js': 'console.log("safe learner work")' }, 'Safe learner work must survive while credential directories are removed');
assert.equal(result.draft.activeFile, 'src/app.js', 'Active-file recovery must land on a surviving learner file');
assert.deepEqual(result.draft.passedCriteria, [], 'Security repair must invalidate stale validation evidence');

console.log('Workspace credential directory audit OK: Kubernetes and Docker auth directories cannot enter restored Lab projects.');

import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/lib/workspaceSafety.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const labEngineSource = fs.readFileSync(new URL('../src/learning/labEngine.ts', import.meta.url), 'utf8');
const workspaceImportSource = fs.readFileSync(new URL('../src/lib/workspaceImport.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'workspace-safety-audit.ts',
}).outputText;

const exports = {};
const module = { exports };
new Function('exports', 'module', 'require', compiled)(exports, module, () => ({}));
const { restoreWorkspaceDraft, isSensitiveWorkspaceFilename, canonicalWorkspacePath, workspaceCollisionKey } = module.exports;

assert.equal(typeof restoreWorkspaceDraft, 'function', 'Workspace restoration must stay executable');
assert.equal(typeof canonicalWorkspacePath, 'function', 'Canonical workspace path identity must stay reusable outside restoration');
assert.equal(typeof workspaceCollisionKey, 'function', 'Collision identity must stay reusable outside restoration');
assert.equal(isSensitiveWorkspaceFilename('nested/.env.production'), true, 'Nested environment files must stay blocked');
assert.equal(isSensitiveWorkspaceFilename('.env.example'), false, 'Safe environment examples must stay allowed');
assert.equal(canonicalWorkspacePath('src\\cafe\u0301.js'), 'src/café.js', 'Workspace paths must canonicalize slashes and Unicode before identity checks');
assert.equal(workspaceCollisionKey('src/App.js'), workspaceCollisionKey('src/app.js'), 'Workspace identity must remain case-insensitive for cross-filesystem safety');
assert.equal(canonicalWorkspacePath('src/CON.txt'), null, 'Windows device names must be rejected before a workspace can be synced or exported');
assert.equal(canonicalWorkspacePath('src/aux'), null, 'Reserved device basenames must be rejected even without an extension');
assert.equal(canonicalWorkspacePath('src/report. '), null, 'Trailing dots or spaces must not create cross-filesystem aliases');
assert.equal(canonicalWorkspacePath('src/file:name.js'), null, 'Windows-invalid filename characters must be rejected for portable projects');
assert.equal(canonicalWorkspacePath('src/component?.js'), null, 'Wildcard-like filename characters must not survive canonicalization');
assert.match(labEngineSource, /import\s+\{[^}]*restoreWorkspaceDraft[^}]*\}\s+from\s+['"]\.\.\/lib\/workspaceSafety['"]/, 'Lab engine must restore through the shared workspace safety boundary');
assert.match(labEngineSource, /restoreWorkspaceDraft\s*\(\s*\{[\s\S]*stored,[\s\S]*expectedMissionId:\s*mission\.id,[\s\S]*expectedLanguage:\s*mission\.language,[\s\S]*fallbackFiles:\s*starterFiles/, 'Lab restoration must bind shared safety to the current mission, language and trusted starter files');
assert.match(labEngineSource, /Object\.keys\(files\)\.some\(isSensitiveWorkspaceFilename\)/, 'Lab secret checks must share the canonical sensitive-filename policy');
assert.doesNotMatch(labEngineSource, /function\s+isSensitiveLabFilename\s*\(/, 'Lab engine must not drift back to a duplicate sensitive-filename policy');
assert.match(workspaceImportSource, /import\s+\{[^}]*canonicalWorkspacePath[^}]*workspaceCollisionKey[^}]*\}\s+from\s+['"]\.\/workspaceSafety['"]/, 'Phone imports must share the same canonical path identity as restored workspaces');
assert.match(workspaceImportSource, /function occupiedWorkspaceKeys\([\s\S]*canonicalWorkspacePath\(rawPath\)[\s\S]*workspaceCollisionKey\(canonical\)/, 'Existing Lab files must be indexed by canonical collision identity before imports');
assert.match(workspaceImportSource, /while \(occupied\.has\(workspaceCollisionKey\(`\$\{folder\}\$\{stem\} \(\$\{counter\}\)\$\{ext\}`\)\)\)/, 'Import renaming must test generated paths through the cross-filesystem collision key');
assert.match(workspaceImportSource, /occupied\.add\(workspaceCollisionKey\(resolved\.path\)\)/g, 'Every imported file must reserve its canonical collision identity immediately');

const base = {
  missionId: 'project:demo',
  language: 'Web',
  files: { 'index.html': '<main>NexCode</main>' },
  activeFile: 'index.html',
  updatedAt: '2026-08-25T05:00:00.000Z',
  lastValidatedAt: '2026-08-25T05:01:00.000Z',
  passedCriteria: ['preview'],
};
const options = {
  expectedMissionId: 'project:demo',
  expectedLanguage: 'Web',
  fallbackFiles: { 'index.html': '<main>Fallback</main>' },
};

{
  const result = restoreWorkspaceDraft({ ...options, stored: base });
  assert.equal(result.repaired, false, 'A clean workspace must not be rewritten');
  assert.equal(result.draft.updatedAt, base.updatedAt, 'A clean workspace must preserve its timestamp');
  assert.deepEqual(result.draft.passedCriteria, ['preview'], 'A clean workspace must preserve valid criteria');
}

{
  const result = restoreWorkspaceDraft({
    ...options,
    stored: {
      ...base,
      files: { 'src\\index.js': 'console.log("safe")' },
      activeFile: 'src\\index.js',
    },
  });
  assert.equal(result.repaired, true, 'Windows-style paths must be canonicalized');
  assert.deepEqual(Object.keys(result.draft.files), ['src/index.js'], 'Restored paths must use one canonical slash form');
  assert.equal(result.draft.activeFile, 'src/index.js', 'The active file must follow canonical path repair');
  assert.deepEqual(result.draft.passedCriteria, [], 'Any repaired workspace must invalidate stale validation');
}

{
  const result = restoreWorkspaceDraft({
    ...options,
    stored: {
      ...base,
      files: {
        'src\\index.js': 'first',
        'src/index.js': 'second',
      },
      activeFile: 'src/index.js',
    },
  });
  assert.equal(result.repaired, true, 'Canonical path collisions must be treated as a repair');
  assert.deepEqual(result.draft.files, { 'src/index.js': 'first' }, 'A canonical collision must never overwrite the first restored file');
}

{
  const result = restoreWorkspaceDraft({
    ...options,
    stored: {
      ...base,
      files: {
        'src/App.js': 'first',
        'src/app.js': 'second',
      },
      activeFile: 'src/app.js',
    },
  });
  assert.equal(result.repaired, true, 'Case-only path collisions must be repaired for cross-filesystem safety');
  assert.deepEqual(result.draft.files, { 'src/App.js': 'first' }, 'Case-insensitive collisions must preserve the first restored file');
  assert.equal(result.draft.activeFile, 'src/App.js', 'Active file lookup must follow the collision-safe identity');
}

{
  const decomposed = 'src/cafe\u0301.js';
  const composed = 'src/café.js';
  const result = restoreWorkspaceDraft({
    ...options,
    stored: {
      ...base,
      files: {
        [decomposed]: 'first',
        [composed]: 'second',
      },
      activeFile: decomposed,
    },
  });
  assert.equal(result.repaired, true, 'Unicode-equivalent paths must collapse to one canonical identity');
  assert.deepEqual(result.draft.files, { [composed]: 'first' }, 'NFC-equivalent collisions must never overwrite the first restored file');
  assert.equal(result.draft.activeFile, composed, 'Active file must follow Unicode path canonicalization');
}

{
  const result = restoreWorkspaceDraft({
    ...options,
    stored: {
      ...base,
      files: {
        'index.html': '<main>Safe</main>',
        'CON.txt': 'reserved',
        'src/trailing.': 'alias',
      },
      activeFile: 'CON.txt',
    },
  });
  assert.equal(result.repaired, true, 'Non-portable filenames must be removed from restored workspaces');
  assert.deepEqual(result.draft.files, { 'index.html': '<main>Safe</main>' }, 'Portable files must survive while device names and trailing-dot aliases are removed');
  assert.equal(result.draft.activeFile, 'index.html', 'Active file must fall back to a surviving portable file');
  assert.deepEqual(result.draft.passedCriteria, [], 'Portable-path repair must invalidate stale validation evidence');
}

{
  const result = restoreWorkspaceDraft({
    ...options,
    stored: {
      ...base,
      files: {
        'index.html': '<main>Safe</main>',
        'binary.txt': 'abc\0def',
        'config/.env.local': 'SECRET=1',
      },
      activeFile: 'binary.txt',
    },
  });
  assert.equal(result.repaired, true, 'Binary-looking and sensitive files must be removed from restored workspaces');
  assert.deepEqual(result.draft.files, { 'index.html': '<main>Safe</main>' });
  assert.equal(result.draft.activeFile, 'index.html', 'Active file must fall back to a surviving safe file');
}

{
  const result = restoreWorkspaceDraft({
    ...options,
    stored: {
      ...base,
      files: { 'binary.txt': '\0' },
      activeFile: 'binary.txt',
    },
  });
  assert.equal(result.repaired, true);
  assert.deepEqual(result.draft.files, options.fallbackFiles, 'An unusable workspace must fail closed to the trusted starter files');
}

{
  const result = restoreWorkspaceDraft({
    ...options,
    stored: {
      ...base,
      lastValidatedAt: undefined,
      passedCriteria: ['preview'],
    },
  });
  assert.equal(result.repaired, true, 'Passed criteria without a validation timestamp must not survive restoration');
  assert.equal(result.draft.lastValidatedAt, undefined);
  assert.deepEqual(result.draft.passedCriteria, [], 'Unverifiable restored criteria must be cleared instead of shown as earned');
}

{
  const result = restoreWorkspaceDraft({
    ...options,
    stored: {
      ...base,
      lastValidatedAt: 'not-a-date',
      passedCriteria: ['preview'],
    },
  });
  assert.equal(result.repaired, true, 'Malformed validation timestamps must invalidate restored proof metadata');
  assert.deepEqual(result.draft.passedCriteria, []);
}

{
  const result = restoreWorkspaceDraft({
    ...options,
    stored: {
      ...base,
      passedCriteria: ['preview', '', 42],
    },
  });
  assert.equal(result.repaired, true, 'Malformed criteria arrays from persisted or synced state must fail closed');
  assert.equal(result.draft.lastValidatedAt, undefined);
  assert.deepEqual(result.draft.passedCriteria, []);
}

console.log('Workspace safety audit OK: shared Lab restoration/import identity, slash/case/Unicode/portable-path collision handling, sensitive/binary filtering, and validation-proof invalidation are protected.');

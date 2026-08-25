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
  fileName: 'workspace-safety-audit.ts',
}).outputText;

const exports = {};
const module = { exports };
new Function('exports', 'module', 'require', compiled)(exports, module, () => ({}));
const { restoreWorkspaceDraft, isSensitiveWorkspaceFilename } = module.exports;

assert.equal(typeof restoreWorkspaceDraft, 'function', 'Workspace restoration must stay executable');
assert.equal(isSensitiveWorkspaceFilename('nested/.env.production'), true, 'Nested environment files must stay blocked');
assert.equal(isSensitiveWorkspaceFilename('.env.example'), false, 'Safe environment examples must stay allowed');

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

console.log('Workspace safety audit OK: slash, case and Unicode path identity, collision handling, sensitive/binary filtering and validation invalidation are protected.');

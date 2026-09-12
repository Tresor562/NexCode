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
  fileName: 'workspace-validation-criteria-integrity.ts',
}).outputText;

const exports = {};
const module = { exports };
new Function('exports', 'module', 'require', compiled)(exports, module, () => ({}));
const { restoreWorkspaceDraft } = module.exports;

const now = new Date().toISOString();
const base = {
  missionId: 'lab:criteria',
  language: 'JavaScript',
  files: { 'main.js': 'const answer = 42;' },
  activeFile: 'main.js',
  updatedAt: now,
  lastValidatedAt: now,
  passedCriteria: ['Structure cohérente', 'Travail suffisamment complet'],
};
const options = {
  expectedMissionId: base.missionId,
  expectedLanguage: base.language,
  fallbackFiles: { 'main.js': 'const starter = true;' },
};

{
  const result = restoreWorkspaceDraft({ ...options, stored: base });
  assert.equal(result.repaired, false, 'Clean validation criteria must survive restoration.');
  assert.deepEqual(result.draft.passedCriteria, base.passedCriteria);
}

for (const passedCriteria of [
  ['Structure cohérente', 'Structure cohérente'],
  ['Structure cohérente', ' Structure cohérente'],
  ['Structure cohérente', 'Travail\ncomplet'],
  ['café', 'cafe\u0301'],
]) {
  const result = restoreWorkspaceDraft({ ...options, stored: { ...base, passedCriteria } });
  assert.equal(result.repaired, true, `Forged validation criteria must be rejected: ${JSON.stringify(passedCriteria)}`);
  assert.equal(result.draft.lastValidatedAt, undefined, 'Rejected validation evidence must lose its validation timestamp.');
  assert.deepEqual(result.draft.passedCriteria, [], 'Rejected validation evidence must not inflate Lab progress.');
}

assert.match(source, /const identities = new Set<string>\(\)/, 'Validation metadata must deduplicate criterion identities.');
assert.match(source, /normalized !== criterion/, 'Whitespace aliases must not survive validation restoration.');
assert.match(source, /normalized\.normalize\('NFC'\)/, 'Unicode-equivalent criterion identities must deduplicate canonically.');

console.log('Workspace validation criteria integrity audit passed.');

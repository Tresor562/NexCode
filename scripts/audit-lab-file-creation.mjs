import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/learning/labEngine.ts', import.meta.url), 'utf8');

assert.match(source, /canonicalWorkspacePath/, 'Lab file creation must canonicalize portable workspace paths');
assert.match(source, /workspaceCollisionKey/, 'Lab file creation must share cross-filesystem collision identity');
assert.match(source, /const MAX_MUTABLE_LAB_FILES = 300;/, 'Lab manual file creation must share the persisted 300-file workspace ceiling');
assert.match(source, /export function addLabFile\([\s\S]*Object\.keys\(draft\.files\)\.length >= MAX_MUTABLE_LAB_FILES[\s\S]*canonicalWorkspacePath\(filename\)[\s\S]*isSensitiveWorkspaceFilename\(safe\)[\s\S]*Object\.keys\(draft\.files\)\.some\([\s\S]*workspaceCollisionKey\(existing\) === collisionKey[\s\S]*files: \{ \.\.\.draft\.files, \[safe\]: '' \}/, 'New Lab files must respect persistence capacity, support canonical nested paths, reject sensitive names and prevent case/Unicode collisions');
assert.doesNotMatch(source, /filename\.trim\(\)\.replace\(\/\[\^a-zA-Z0-9\._-\]\//, 'Lab file creation must not flatten folders through the legacy sanitizer');

console.log('Lab file creation audit OK: persistence capacity and portable nested paths fail closed.');

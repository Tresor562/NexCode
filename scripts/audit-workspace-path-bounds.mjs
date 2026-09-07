import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/lib/workspaceSafety.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const importSource = fs.readFileSync(new URL('../src/lib/workspaceImport.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: 'workspaceSafety.ts',
}).outputText;

const exports = {};
const module = { exports };
new Function('exports', 'module', compiled)(exports, module);
const { canonicalWorkspacePath } = module.exports;

assert.equal(typeof canonicalWorkspacePath, 'function', 'canonicalWorkspacePath must stay exported');
assert.equal(canonicalWorkspacePath('src/components/App.tsx'), 'src/components/App.tsx', 'normal nested project paths must stay valid');
assert.equal(canonicalWorkspacePath('src\\components\\App.tsx'), 'src/components/App.tsx', 'portable normalization must preserve Windows imports');
assert.equal(canonicalWorkspacePath('src/comp\u202Egnp.tsx'), null, 'bidirectional override controls must never survive workspace path canonicalization');
assert.equal(canonicalWorkspacePath('src/zero\u200Bwidth.js'), null, 'zero-width format controls must never create visually spoofed workspace filenames');
assert.equal(canonicalWorkspacePath('src/word\u2060joiner.js'), null, 'invisible word-joiner controls must be rejected from workspace paths');
assert.equal(canonicalWorkspacePath('src/café.js'), 'src/café.js', 'normal visible Unicode filenames must stay supported');
assert.equal(canonicalWorkspacePath(`${'a'.repeat(121)}.js`), null, 'oversized path segments must be rejected');
assert.equal(canonicalWorkspacePath(`${'a'.repeat(119)}.js`), null, 'segment bounds must include the extension in the limit');
assert.equal(canonicalWorkspacePath(`${'a'.repeat(116)}.js`)?.endsWith('.js'), true, 'useful long filenames below the bound must remain supported');
assert.equal(canonicalWorkspacePath(`${'folder/'.repeat(13)}main.js`), null, 'excessively deep workspaces must be rejected');
assert.equal(canonicalWorkspacePath(`${'a/'.repeat(11)}main.js`)?.endsWith('main.js'), true, 'practical nested workspaces below the depth bound must remain supported');
assert.equal(canonicalWorkspacePath(`${'folder/'.repeat(11)}${'x'.repeat(180)}.js`), null, 'oversized total paths must be rejected even when depth is acceptable');
assert.equal(canonicalWorkspacePath('src/aux/config.js'), null, 'Windows-reserved segments must stay rejected');
assert.equal(canonicalWorkspacePath('src/name. /file.js'), null, 'segments ending in a dot or space must stay rejected');

assert.match(source, /UNSAFE_INVISIBLE_PATH_CHARS\s*=\s*\/\[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u206F\\uFEFF\]\//, 'workspace path policy must explicitly reject invisible and bidirectional formatting controls');
assert.match(source, /MAX_WORKSPACE_PATH_CHARS\s*=\s*240/, 'workspace path cap must remain explicit');
assert.match(source, /MAX_WORKSPACE_SEGMENT_CHARS\s*=\s*120/, 'workspace segment cap must remain explicit');
assert.match(source, /MAX_WORKSPACE_DEPTH\s*=\s*12/, 'workspace depth cap must remain explicit');
assert.match(importSource, /MAX_COLLISION_RENAMES\s*=\s*10_000/, 'collision rename search must stay bounded');
assert.match(importSource, /candidate\s*=\s*canonicalWorkspacePath\(`\$\{folder\}\$\{candidateStem\}\$\{suffix\}\$\{ext\}`\)/, 'collision-renamed imports must pass through the canonical path policy');
assert.match(importSource, /while\s*\(!candidate\s*&&\s*candidateStem\.length\s*>\s*1\)/, 'boundary-length filenames must trim their stem before being accepted');
assert.doesNotMatch(importSource, /return\s*\{\s*path:\s*`\$\{folder\}\$\{stem\}\s*\(\$\{counter\}\)\$\{ext\}`/, 'collision renames must never bypass canonical validation');
assert.match(importSource, /function safeDirectoryEntries\(directory: Directory\)/, 'folder imports must isolate provider read failures behind a safe directory-list boundary');
assert.match(importSource, /try\s*\{\s*return directory\.list\(\);\s*\}\s*catch\s*\{[\s\S]*?return null;/, 'unreadable provider subtrees must not reject the whole folder import');
assert.match(importSource, /const entries = safeDirectoryEntries\(directory\);\s*if \(!entries\) \{\s*skipped \+= 1;\s*return;/, 'failed subtrees must be counted and skipped while preserving already imported files');
assert.doesNotMatch(importSource, /const entries = directory\.list\(\);/, 'recursive folder walking must never call the provider directly without recovery');

console.log('Workspace path bounds audit OK: portable project paths reject invisible spoofing controls while collision-renamed imports and partial provider failures stay bounded, canonical and recoverable.');

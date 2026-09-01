import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/lib/workspaceSafety.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
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
assert.equal(canonicalWorkspacePath(`${'a'.repeat(121)}.js`), null, 'oversized path segments must be rejected');
assert.equal(canonicalWorkspacePath(`${'a'.repeat(119)}.js`), null, 'segment bounds must include the extension in the limit');
assert.equal(canonicalWorkspacePath(`${'a'.repeat(116)}.js`)?.endsWith('.js'), true, 'useful long filenames below the bound must remain supported');
assert.equal(canonicalWorkspacePath(`${'folder/'.repeat(13)}main.js`), null, 'excessively deep workspaces must be rejected');
assert.equal(canonicalWorkspacePath(`${'a/'.repeat(11)}main.js`)?.endsWith('main.js'), true, 'practical nested workspaces below the depth bound must remain supported');
assert.equal(canonicalWorkspacePath(`${'folder/'.repeat(11)}${'x'.repeat(180)}.js`), null, 'oversized total paths must be rejected even when depth is acceptable');
assert.equal(canonicalWorkspacePath('src/aux/config.js'), null, 'Windows-reserved segments must stay rejected');
assert.equal(canonicalWorkspacePath('src/name. /file.js'), null, 'segments ending in a dot or space must stay rejected');

assert.match(source, /MAX_WORKSPACE_PATH_CHARS\s*=\s*240/, 'workspace path cap must remain explicit');
assert.match(source, /MAX_WORKSPACE_SEGMENT_CHARS\s*=\s*120/, 'workspace segment cap must remain explicit');
assert.match(source, /MAX_WORKSPACE_DEPTH\s*=\s*12/, 'workspace depth cap must remain explicit');

console.log('Workspace path bounds audit OK: portable project paths are normalized and pathological names/depths are rejected before storage or rendering.');

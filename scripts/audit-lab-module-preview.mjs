import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/learning/labSession.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  fileName: 'labSession.ts',
}).outputText;

const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id.endsWith('/labEngine') || id === './labEngine') return { openLabWorkspace: () => ({}), validateLabDraft: () => ({ passed: false, feedback: '' }) };
  if (id.endsWith('/workspaceSafety') || id === '../lib/workspaceSafety') return { workspaceCollisionKey: (path) => path.normalize('NFC').toLocaleLowerCase('en-US') };
  return {};
};
new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);

const { webPreviewDocument } = module.exports;
const draft = {
  missionId: 'module-preview-audit',
  activeFile: 'index.html',
  language: 'HTML/CSS',
  updatedAt: new Date(0).toISOString(),
  files: {
    'index.html': '<html><body><script type="module" src="scripts/app.js"></script></body></html>',
    'scripts/app.js': 'import { sum } from "./math.js"; import("./lazy.js").then(({ value }) => console.log(sum(value, 2)));',
    'scripts/math.js': 'export const sum = (a, b) => a + b;',
    'scripts/lazy.js': 'export const value = 40;',
  },
};

const output = webPreviewDocument(draft);
assert.match(output, /<script data-nexcode-source="scripts\/app\.js" type="module">/, 'entry module must remain a module script');
assert.doesNotMatch(output, /from "\.\/math\.js"/, 'static local module imports must not remain as dead workspace-relative URLs');
assert.doesNotMatch(output, /import\("\.\/lazy\.js"\)/, 'dynamic local module imports must not remain as dead workspace-relative URLs');
assert.match(output, /data:text\/javascript;charset=utf-8,/, 'local module dependencies must be embedded as offline data URLs');
assert.match(decodeURIComponent(output), /export const sum = \(a, b\) => a \+ b;/, 'embedded static dependency must preserve source code');
assert.match(decodeURIComponent(output), /export const value = 40;/, 'embedded dynamic dependency must preserve source code');

console.log('Lab module preview audit passed: static and dynamic local JavaScript dependencies stay executable offline.');

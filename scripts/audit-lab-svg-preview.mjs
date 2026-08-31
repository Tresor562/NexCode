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
  if (id.endsWith('/labEngine') || id === './labEngine') {
    return { openLabWorkspace: () => ({}), validateLabDraft: () => ({ passed: false, feedback: '' }) };
  }
  if (id.endsWith('/workspaceSafety') || id === '../lib/workspaceSafety') {
    return { workspaceCollisionKey: (path) => path.normalize('NFC').toLocaleLowerCase('en-US') };
  }
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { webPreviewDocument } = module.exports;

const draft = (files) => ({
  missionId: 'svg-preview-audit',
  files,
  activeFile: 'index.html',
  language: 'html',
  updatedAt: new Date(0).toISOString(),
});

{
  const output = webPreviewDocument(draft({
    'index.html': '<html><body><img class="brand" src="./assets/logo.svg?v=2" alt="NexCode"></body></html>',
    'assets/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
  }));
  assert.match(output, /src="data:image\/svg\+xml;charset=utf-8,/i, 'local SVG images must be converted to CSP-compatible data URIs');
  assert.doesNotMatch(output, /src="\.\/assets\/logo\.svg\?v=2"/i, 'inlined SVG images must not leave a dead local URL');
  assert.match(output, /class="brand"/, 'inlining must preserve image attributes');
  assert.match(output, /alt="NexCode"/, 'inlining must preserve accessibility text');
}

{
  const output = webPreviewDocument(draft({
    'index.html': '<html><body><img src="ASSETS/CAFÉ.SVG"></body></html>',
    'assets/Cafe\u0301.svg': '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1H0z"/></svg>',
  }));
  assert.match(output, /data:image\/svg\+xml;charset=utf-8,/i, 'SVG resolution must follow portable case and Unicode workspace rules');
}

{
  const output = webPreviewDocument(draft({
    'index.html': '<html><body><img src="https://example.com/logo.svg"><img src="../secret.svg"></body></html>',
    'https://example.com/logo.svg': '<svg></svg>',
    'secret.svg': '<svg></svg>',
  }));
  assert.match(output, /src="https:\/\/example\.com\/logo\.svg"/, 'external SVG URLs must never be treated as workspace files');
  assert.match(output, /src="\.\.\/secret\.svg"/, 'SVG traversal above the workspace root must stay unresolved');
  assert.doesNotMatch(output, /data:image\/svg\+xml;charset=utf-8,/i, 'unsafe SVG references must not be inlined');
}

console.log('Lab SVG preview audit OK: local portable SVG assets render offline while external and traversal references remain blocked.');

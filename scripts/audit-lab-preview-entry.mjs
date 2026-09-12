import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/learning/labSession.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'labSession.ts',
}).outputText;

const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id.endsWith('/labEngine') || id === './labEngine') {
    return {
      openLabWorkspace: () => ({}),
      validateLabDraft: () => ({ passed: false, feedback: '' }),
    };
  }
  if (id.endsWith('/workspaceSafety') || id === '../lib/workspaceSafety') {
    return {
      workspaceCollisionKey: (value) => value.normalize('NFC').toLocaleLowerCase('en-US'),
    };
  }
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { webPreviewDocument } = module.exports;
assert.equal(typeof webPreviewDocument, 'function', 'webPreviewDocument must stay exported');

const baseDraft = {
  missionId: 'preview-entry-audit',
  language: 'JavaScript',
  updatedAt: new Date(0).toISOString(),
};

const jsOnly = webPreviewDocument({
  ...baseDraft,
  files: {
    'main.js': 'const answer = 42;',
    'README.md': '# JavaScript mission',
  },
  activeFile: 'main.js',
});
assert.equal(jsOnly, undefined, 'A workspace without HTML must not render a misleading blank Web preview.');

const nestedHtml = webPreviewDocument({
  ...baseDraft,
  files: {
    'src/main.js': 'document.body.dataset.ready = "yes";',
    'site/index.html': '<main>NexCode</main>',
  },
  activeFile: 'src/main.js',
});
assert.match(nestedHtml, /<main>NexCode<\/main>/, 'A nested HTML entry must still activate the Web preview even when a non-HTML file is active.');

const emptyHtml = webPreviewDocument({
  ...baseDraft,
  files: {
    'index.html': '   ',
    'main.js': 'console.log("ready")',
  },
  activeFile: 'main.js',
});
assert.match(emptyHtml, /<main><\/main>/, 'An existing but empty HTML entry must keep the stable preview scaffold.');

assert.match(source, /const entryPath = previewEntryPath\(draft\);\s*if \(!entryPath\) return undefined;/, 'The preview must explicitly fail closed when no HTML entry exists.');

console.log('Lab preview entry audit OK: non-HTML workspaces use the native empty state while real HTML entries, including nested entries, still render.');

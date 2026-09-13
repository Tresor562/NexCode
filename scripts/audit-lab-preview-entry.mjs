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

const activePage = webPreviewDocument({
  ...baseDraft,
  files: {
    'index.html': '<main>Home</main>',
    'pages/profile.html': '<main>Profile</main>',
    'pages/styles.css': 'main { color: rebeccapurple; }',
    'pages/script.js': 'document.body.dataset.page = "profile";',
  },
  activeFile: 'pages/profile.html',
});
assert.match(activePage, /<main>Profile<\/main>/, 'The active HTML page must take priority over a root index in a multi-page Lab.');
assert.doesNotMatch(activePage, /<main>Home<\/main>/, 'The root index must not mask an explicitly selected HTML page.');
assert.match(activePage, /data-nexcode-source="pages\/styles\.css"/, 'An active nested page must keep its directory-scoped fallback stylesheet.');
assert.match(activePage, /data-nexcode-source="pages\/script\.js"/, 'An active nested page must keep its directory-scoped fallback script.');

const rootFallback = webPreviewDocument({
  ...baseDraft,
  files: {
    'index.html': '<main>Home fallback</main>',
    'pages/profile.html': '<main>Profile hidden</main>',
    'main.js': 'console.log("editing")',
  },
  activeFile: 'main.js',
});
assert.match(rootFallback, /<main>Home fallback<\/main>/, 'The root index must remain the stable fallback while a non-HTML file is active.');
assert.doesNotMatch(rootFallback, /Profile hidden/, 'A non-HTML active file must not select an unrelated nested page over the root entry.');

const emptyHtml = webPreviewDocument({
  ...baseDraft,
  files: {
    'index.html': '   ',
    'main.js': 'console.log("ready")',
  },
  activeFile: 'main.js',
});
assert.match(emptyHtml, /<main><\/main>/, 'An existing but empty HTML entry must keep the stable preview scaffold.');

assert.match(source, /const activeEntry =[\s\S]*?if \(activeEntry\) return activeEntry;[\s\S]*?const rootEntry = resolvePreviewWorkspaceFile\(draft, 'index\.html'\);/, 'An explicitly active HTML page must be considered before the root fallback.');
assert.match(source, /const entryPath = previewEntryPath\(draft\);\s*if \(!entryPath\) return undefined;/, 'The preview must explicitly fail closed when no HTML entry exists.');

console.log('Lab preview entry audit OK: non-HTML workspaces stay empty, active multi-page HTML entries win explicitly, root index remains the non-HTML fallback, and nested HTML entries still render.');

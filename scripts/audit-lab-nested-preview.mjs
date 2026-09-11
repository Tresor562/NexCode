import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/learning/labSession.ts', import.meta.url), 'utf8');
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
      workspaceCollisionKey: (path) => path.normalize('NFC').toLocaleLowerCase('en-US'),
    };
  }
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { webPreviewDocument } = module.exports;
assert.equal(typeof webPreviewDocument, 'function', 'webPreviewDocument must stay exported');

function draft(files, activeFile) {
  return {
    missionId: 'nested-preview-audit',
    files,
    activeFile,
    language: 'html',
    updatedAt: new Date(0).toISOString(),
  };
}

{
  const output = webPreviewDocument(draft({
    'portfolio/index.html': '<html><head><link rel="stylesheet" href="./styles.css"></head><body><main>Nested app</main><img src="./assets/mark.svg"><script src="./script.js"></script></body></html>',
    'portfolio/styles.css': 'main { display: grid; }',
    'portfolio/script.js': 'document.body.dataset.nested = "ready";',
    'portfolio/assets/mark.svg': '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="5"/></svg>',
  }, 'portfolio/index.html'));

  assert.match(output, /<main>Nested app<\/main>/, 'active nested HTML must become the preview entry when root index.html is absent');
  assert.match(output, /data-nexcode-source="portfolio\/styles\.css"/, 'nested HTML stylesheet references must resolve relative to the entry file');
  assert.match(output, /data-nexcode-source="portfolio\/script\.js"/, 'nested HTML script references must resolve relative to the entry file');
  assert.match(output, /data:image\/svg\+xml/, 'nested HTML SVG references must resolve relative to the entry file');
  assert.match(output, /dataset\.nested = "ready"/, 'nested project JavaScript must remain executable in the offline preview');
}

{
  const output = webPreviewDocument(draft({
    'portfolio/index.html': '<main>Fallback bundle</main>',
    'portfolio/styles.css': 'main { gap: 8px; }',
    'portfolio/script.js': 'document.body.dataset.fallbackNested = "yes";',
  }, 'portfolio/script.js'));

  assert.match(output, /<main>Fallback bundle<\/main>/, 'a nested index.html must be discovered even when a non-HTML file is active');
  assert.match(output, /data-nexcode-source="portfolio\/styles\.css"/, 'fallback styles.css must be resolved next to the nested entry');
  assert.match(output, /data-nexcode-source="portfolio\/script\.js"/, 'fallback script.js must be resolved next to the nested entry');
}

{
  const output = webPreviewDocument(draft({
    'index.html': '<main>Root wins</main>',
    'portfolio/index.html': '<main>Nested should not override root</main>',
  }, 'portfolio/index.html'));

  assert.match(output, /<main>Root wins<\/main>/, 'root index.html must remain the canonical preview entry when present');
  assert.doesNotMatch(output, /Nested should not override root/, 'nested active HTML must not unexpectedly replace an explicit root app entry');
}

console.log('Nested Lab preview audit OK: imported folder entries, relative CSS/JS/SVG assets and sibling fallbacks stay functional.');

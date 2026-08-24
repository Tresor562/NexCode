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
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { webPreviewDocument } = module.exports;

assert.equal(typeof webPreviewDocument, 'function', 'webPreviewDocument must stay exported');

const draft = (files) => ({
  missionId: 'preview-audit',
  files,
  activeFile: 'index.html',
  language: 'html',
  updatedAt: new Date(0).toISOString(),
});

function assertPreviewPolicy(output) {
  assert.match(output, /name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/i, 'preview must include a mobile viewport');
  assert.match(output, /http-equiv="Content-Security-Policy"/i, 'preview must include a CSP');
  assert.match(output, /default-src 'none'/, 'preview CSP must deny resources by default');
  assert.match(output, /connect-src 'none'/, 'preview CSP must block network connections by default');
  assert.match(output, /frame-src 'none'/, 'preview CSP must block embedded frames by default');
  assert.match(output, /form-action 'none'/, 'preview CSP must block form submissions by default');
}

{
  const output = webPreviewDocument(draft({
    'index.html': '<!doctype html><html><head><title>NexCode</title><script src="https://example.com/external.js"></script></head><body><main>App</main></body></html>',
    'styles.css': 'main { color: tomato; }',
    'script.js': 'document.body.dataset.ready = "yes";',
  }));
  assertPreviewPolicy(output);
  assert.ok(output.indexOf('Content-Security-Policy') < output.indexOf('https://example.com/external.js'), 'CSP must be injected before user head scripts can execute');
  assert.ok(output.indexOf('<style>') < output.indexOf('</head>'), 'styles must be injected inside head when a head exists');
  assert.ok(output.indexOf('<script>') < output.indexOf('</body>'), 'Lab script must be injected inside body when a body exists');
  assert.ok(output.indexOf('</head>') < output.indexOf('<body>'), 'full-document structure must be preserved');
}

{
  const output = webPreviewDocument(draft({
    'index.html': '<html><body><main>No head</main></body></html>',
    'styles.css': 'main { display: grid; }',
    'script.js': 'console.log("preview")',
  }));
  assertPreviewPolicy(output);
  assert.match(output, /<html>\s*<head>/i, 'full documents without a head must receive one');
  assert.ok(output.indexOf('</head>') < output.indexOf('<body>'), 'generated head must stay before body');
}

{
  const output = webPreviewDocument(draft({
    'index.html': '<main>Fragment</main>',
    'styles.css': 'main { display: grid; }',
    'script.js': 'console.log("preview")',
  }));
  assertPreviewPolicy(output);
  assert.ok(output.startsWith('<!doctype html>'), 'HTML fragments must be wrapped in a stable full document');
  assert.match(output, /<body>\s*<main>Fragment<\/main>/i, 'fragment markup must stay inside body');
  assert.match(output, /<head>[\s\S]*<style>/i, 'fragment styles must be injected in generated head');
}

{
  const output = webPreviewDocument(draft({
    'index.html': '<html><body><main>Safe</main></body></html>',
    'styles.css': 'main::after { content: "</style><aside>escape</aside>"; }',
    'script.js': 'const marker = "</script><p>escape</p>";',
  }));
  assert.ok(output.includes('<\\/style><aside>escape</aside>'), 'embedded closing style tags must be neutralized');
  assert.ok(output.includes('<\\/script><p>escape</p>'), 'embedded closing script tags must be neutralized');
  assert.equal((output.match(/<script>/g) ?? []).length, 1, 'user code must not create extra executable script blocks through a closing tag');
}

{
  const output = webPreviewDocument(draft({ 'index.html': '   ', 'styles.css': '', 'script.js': '' }));
  assertPreviewPolicy(output);
  assert.match(output, /<body>\s*<main><\/main>/i, 'empty HTML must fall back to a stable preview scaffold');
}

console.log('Lab preview audit OK: mobile viewport, offline CSP sandbox, document structure, inline closing tags and empty fallback are protected.');

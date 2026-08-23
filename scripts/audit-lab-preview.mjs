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

{
  const output = webPreviewDocument(draft({
    'index.html': '<!doctype html><html><head><title>NexCode</title></head><body><main>App</main></body></html>',
    'styles.css': 'main { color: tomato; }',
    'script.js': 'document.body.dataset.ready = "yes";',
  }));
  assert.ok(output.indexOf('<style>') < output.indexOf('</head>'), 'styles must be injected inside head when a head exists');
  assert.ok(output.indexOf('<script>') < output.indexOf('</body>'), 'script must be injected inside body when a body exists');
  assert.ok(output.indexOf('</head>') < output.indexOf('<body>'), 'full-document structure must be preserved');
}

{
  const output = webPreviewDocument(draft({
    'index.html': '<main>Fragment</main>',
    'styles.css': 'main { display: grid; }',
    'script.js': 'console.log("preview")',
  }));
  assert.match(output, /<main>Fragment<\/main>\n<style>/, 'HTML fragments must keep their markup before injected styles');
  assert.match(output, /<\/style>\n<script>/, 'HTML fragments must still receive both style and script tags');
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
  assert.ok(output.startsWith('<main></main>'), 'empty HTML must fall back to a stable preview scaffold');
}

console.log('Lab preview audit OK: full documents, fragments, safe inline closing tags and empty HTML fallback are protected.');

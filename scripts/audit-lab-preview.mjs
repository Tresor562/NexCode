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
const { startLabSession, webPreviewDocument } = module.exports;

assert.equal(typeof startLabSession, 'function', 'startLabSession must stay exported');
assert.equal(typeof webPreviewDocument, 'function', 'webPreviewDocument must stay exported');

const baseLesson = (activityKind) => ({
  id: `audit-${activityKind ?? 'learn'}`,
  module: 'Audit',
  title: 'Lab routing audit',
  durationMin: 5,
  concept: '',
  example: '',
  question: '',
  choices: [],
  correctIndex: 0,
  explanation: '',
  activityKind,
});

{
  const now = new Date('2026-08-28T08:00:00.000Z');
  const cases = [
    ['learn', 'lesson'],
    ['lab', 'lesson'],
    ['practice', 'practice'],
    ['review', 'practice'],
    ['checkpoint', 'checkpoint'],
    ['boss', 'checkpoint'],
    ['project', 'project'],
  ];

  for (const [activityKind, expectedSource] of cases) {
    const session = startLabSession('course-audit', baseLesson(activityKind), undefined, now);
    assert.equal(session.returnTarget.source, expectedSource, `${activityKind} Lab sessions must preserve their learning return context`);
    assert.equal(session.returnTarget.courseId, 'course-audit', 'Lab return target must preserve the course');
    assert.equal(session.returnTarget.lessonId, `audit-${activityKind}`, 'Lab return target must preserve the lesson');
  }
}

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
  assert.ok(output.indexOf('<style') < output.indexOf('</head>'), 'styles must be injected inside head when a head exists');
  assert.ok(output.indexOf('<script data-nexcode-source="script.js">') < output.indexOf('</body>'), 'Lab script must be injected inside body when a body exists');
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
  assert.match(output, /<head>[\s\S]*<style/i, 'fragment styles must be injected in generated head');
}

{
  const output = webPreviewDocument(draft({
    'index.html': '<html><body><main>Safe</main></body></html>',
    'styles.css': 'main::after { content: "</style><aside>escape</aside>"; }',
    'script.js': 'const marker = "</script><p>escape</p>";',
  }));
  assert.ok(output.includes('<\\/style><aside>escape</aside>'), 'embedded closing style tags must be neutralized');
  assert.ok(output.includes('<\\/script><p>escape</p>'), 'embedded closing script tags must be neutralized');
  assert.equal((output.match(/<script data-nexcode-source=/g) ?? []).length, 1, 'user code must not create extra executable script blocks through a closing tag');
}

{
  const output = webPreviewDocument(draft({
    'index.html': '<html><head><link rel="stylesheet" href="./styles/base.css?v=3"><link rel="stylesheet" href="styles/theme.css"></head><body><main>Multi</main><script src="./scripts/state.js"></script><script src="scripts/app.js#boot"></script></body></html>',
    'styles/base.css': 'main { display: grid; }',
    'styles/theme.css': 'main { gap: 12px; }',
    'scripts/state.js': 'window.stateReady = true;',
    'scripts/app.js': 'document.body.dataset.booted = "yes";',
  }));
  assertPreviewPolicy(output);
  assert.match(output, /<style data-nexcode-source="styles\/base\.css">main \{ display: grid; \}<\/style>/, 'referenced nested CSS must be inlined from the workspace');
  assert.match(output, /<style data-nexcode-source="styles\/theme\.css">main \{ gap: 12px; \}<\/style>/, 'multiple local stylesheets must stay active');
  assert.match(output, /<script data-nexcode-source="scripts\/state\.js">window\.stateReady = true;<\/script>/, 'referenced nested JavaScript must be inlined from the workspace');
  assert.match(output, /<script data-nexcode-source="scripts\/app\.js">document\.body\.dataset\.booted = "yes";<\/script>/, 'multiple local scripts must stay active');
  assert.doesNotMatch(output, /<link[^>]+styles\/base\.css/i, 'inlined local stylesheets must not leave dead CSP-blocked link tags');
  assert.doesNotMatch(output, /<script[^>]+src="\.\/scripts\/state\.js"/i, 'inlined local scripts must not leave dead CSP-blocked src tags');
}

{
  const output = webPreviewDocument(draft({
    'index.html': '<html><head><link rel="stylesheet" media="(min-width: 720px)" href="styles/wide.css"></head><body><script type="module" src="scripts/app.js"></script><script type="application/json" src="scripts/config.js"></script></body></html>',
    'styles/wide.css': 'main { max-width: 70rem; }',
    'scripts/app.js': 'document.body.dataset.module = "yes";',
    'scripts/config.js': '{"theme":"dark"}',
  }));
  assert.match(output, /<style data-nexcode-source="styles\/wide\.css" media="\(min-width: 720px\)">/, 'local stylesheet media conditions must survive inlining');
  assert.match(output, /<script data-nexcode-source="scripts\/app\.js" type="module">/, 'local module scripts must preserve module execution semantics');
  assert.match(output, /<script data-nexcode-source="scripts\/config\.js" type="application\/json">/, 'non-executable script MIME types must not become executable when inlined');
}

{
  const output = webPreviewDocument(draft({
    'index.html': '<html><head><link rel="stylesheet" href="https://cdn.example.com/theme.css"></head><body><script src="https://cdn.example.com/app.js"></script></body></html>',
    'https://cdn.example.com/theme.css': 'body { color: red; }',
    'https://cdn.example.com/app.js': 'alert(1)',
  }));
  assert.match(output, /href="https:\/\/cdn\.example\.com\/theme\.css"/, 'external stylesheets must never be treated as workspace files');
  assert.match(output, /src="https:\/\/cdn\.example\.com\/app\.js"/, 'external scripts must never be treated as workspace files');
}

{
  const output = webPreviewDocument(draft({
    'index.html': '<html><body><script src="../secret.js"></script></body></html>',
    'secret.js': 'document.body.dataset.leaked = "yes";',
  }));
  assert.match(output, /src="\.\.\/secret\.js"/, 'preview asset resolution must not traverse above the workspace root');
  assert.doesNotMatch(output, /data-nexcode-source="secret\.js"/, 'traversal references must never be inlined');
}

{
  const output = webPreviewDocument(draft({ 'index.html': '   ', 'styles.css': '', 'script.js': '' }));
  assertPreviewPolicy(output);
  assert.match(output, /<body>\s*<main><\/main>/i, 'empty HTML must fall back to a stable preview scaffold');
}

console.log('Lab audit OK: return routing, mobile viewport, offline CSP sandbox, multi-file local assets, asset semantics, document structure, inline closing tags and empty fallback are protected.');

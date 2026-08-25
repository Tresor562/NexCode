import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/ui/ProjectWorkspaceScreen.tsx', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');

const helperStart = source.indexOf('function escapeInlineStyle');
const helperEnd = source.indexOf('function runtimeMessage');
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'Project preview helper block must stay discoverable');

const previewHelpers = `${source.slice(helperStart, helperEnd)}\nexport { buildPreview };`;
const compiled = ts.transpileModule(previewHelpers, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'project-preview-audit.ts',
}).outputText;

const exports = {};
const module = { exports };
new Function('exports', 'module', compiled)(exports, module);
const { buildPreview } = module.exports;
assert.equal(typeof buildPreview, 'function', 'Project preview builder must stay testable');

function assertPreviewPolicy(output) {
  assert.match(output, /name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover"/i, 'Project preview must include a mobile viewport');
  assert.match(output, /http-equiv="Content-Security-Policy"/i, 'Project preview must include a CSP');
  assert.match(output, /default-src 'none'/, 'Project preview CSP must deny resources by default');
  assert.match(output, /connect-src 'none'/, 'Project preview CSP must block network connections');
  assert.match(output, /frame-src 'none'/, 'Project preview CSP must block frames');
  assert.match(output, /form-action 'none'/, 'Project preview CSP must block form submissions');
  assert.match(output, /base-uri 'none'/, 'Project preview CSP must block base URL rewrites');
}

{
  const output = buildPreview({
    'index.html': '<!doctype html><html><head><title>Project</title><script src="https://example.com/external.js"></script></head><body><main>App</main></body></html>',
    'style.css': 'main { color: tomato; }',
    'script.js': 'document.body.dataset.ready = "yes";',
  });
  assertPreviewPolicy(output);
  assert.ok(output.indexOf('Content-Security-Policy') < output.indexOf('https://example.com/external.js'), 'CSP must be injected before user head scripts');
  assert.ok(output.indexOf('<style>') < output.indexOf('</head>'), 'Project styles must be injected inside head');
  assert.ok(output.indexOf('<script>') < output.indexOf('</body>'), 'Project script must be injected inside body');
}

{
  const output = buildPreview({
    'index.html': '<main>Fragment</main>',
    'style.css': 'main { display: grid; }',
    'script.js': 'console.log("project")',
  });
  assertPreviewPolicy(output);
  assert.ok(output.startsWith('<!doctype html>'), 'Project HTML fragments must be wrapped in a stable document');
  assert.match(output, /<body>\s*<main>Fragment<\/main>/i, 'Project fragments must stay inside body');
}

{
  const output = buildPreview({
    'index.html': '<html><body><main>Safe</main></body></html>',
    'style.css': 'main::after { content: "</style><aside>escape</aside>"; }',
    'script.js': 'const marker = "</script><p>escape</p>";',
  });
  assert.ok(output.includes('<\\/style><aside>escape</aside>'), 'Embedded closing style tags must be neutralized');
  assert.ok(output.includes('<\\/script><p>escape</p>'), 'Embedded closing script tags must be neutralized');
  assert.equal((output.match(/<script>/g) ?? []).length, 1, 'User code must not create extra executable script blocks');
}

{
  const output = buildPreview({ 'index.html': '   ', 'style.css': '', 'script.js': '' });
  assertPreviewPolicy(output);
  assert.match(output, /<body>\s*<main><\/main>/i, 'Empty project HTML must use a stable fallback scaffold');
}

assert.match(source, /originWhitelist=\{\['about:blank'\]\}/, 'Project WebView must only whitelist the local about:blank origin');
assert.match(source, /baseUrl:\s*'about:blank'/, 'Project WebView must render from a local about:blank base URL');
assert.match(source, /domStorageEnabled=\{false\}/, 'Project WebView DOM storage must stay disabled');
assert.match(source, /setSupportMultipleWindows=\{false\}/, 'Project WebView multiple windows must stay disabled');
assert.match(source, /request\.url === 'about:blank' \|\| request\.url\.startsWith\('data:'\)/, 'Project WebView navigation must stay local/data-only');

console.log('Project preview audit OK: offline CSP, local-only WebView, document structure, inline closing tags and empty fallback are protected.');

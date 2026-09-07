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
      workspaceCollisionKey: (path) => path.normalize('NFC').toLocaleLowerCase('en-US'),
    };
  }
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { webPreviewDocument } = module.exports;
assert.equal(typeof webPreviewDocument, 'function', 'Lab module preview audit requires webPreviewDocument');

const draft = {
  missionId: 'module-preview-audit',
  language: 'JavaScript',
  activeFile: 'index.html',
  updatedAt: new Date(0).toISOString(),
  files: {
    'index.html': '<html><body><main id="app"></main><script type="module" src="scripts/app.js"></script></body></html>',
    'scripts/app.js': "import { message } from './lib/message';\nimport './setup.js';\nimport('https://cdn.example.com/remote.js');\ndocument.querySelector('#app').textContent = message;",
    'scripts/setup.js': "document.body.dataset.ready = 'yes';",
    'scripts/lib/message.js': "import { format } from './format.mjs';\nexport const message = format('NexCode');",
    'scripts/lib/format.mjs': "export const format = (value) => `Hello ${value}`;",
  },
};

const output = webPreviewDocument(draft);
assert.match(output, /script-src 'unsafe-inline' data:/, 'sandbox CSP must explicitly allow only the generated data: module dependencies in addition to inline entry code');
assert.match(output, /<script data-nexcode-source="scripts\/app\.js" type="module">/, 'module entry must stay an ES module after workspace inlining');
assert.doesNotMatch(output, /from '\.\/lib\/message'/, 'local static module imports must not be left relative to about:blank');
assert.doesNotMatch(output, /import '\.\/setup\.js'/, 'local side-effect imports must not be left relative to about:blank');
assert.match(output, /data:text\/javascript;charset=utf-8,/, 'local module dependencies must be embedded into the offline preview document');
assert.match(output, /https:\/\/cdn\.example\.com\/remote\.js/, 'external module references must never be mistaken for workspace files');

const entryMatch = output.match(/<script data-nexcode-source="scripts\/app\.js" type="module">([\s\S]*?)<\\\/script>/);
assert.ok(entryMatch?.[1], 'module entry source must remain inspectable in the generated preview');
const entrySource = entryMatch[1];
const dependencyMatch = entrySource.match(/data:text\/javascript;charset=utf-8,([^'"\s]+)/);
assert.ok(dependencyMatch?.[1], 'entry module must point at an embedded local dependency');
const dependencySource = decodeURIComponent(dependencyMatch[1]);
assert.match(dependencySource, /data:text\/javascript;charset=utf-8,/, 'nested local imports must also be rewritten recursively instead of breaking one level below the entry module');
assert.doesNotMatch(dependencySource, /from '\.\/format\.mjs'/, 'nested module dependencies must not retain dead relative paths');

assert.match(source, /resolvePreviewModuleFile/, 'module resolution must stay centralized and reviewable');
assert.match(source, /rewriteLocalModuleImports/, 'local module graph rewriting must remain explicit');
assert.match(source, /branch\.has\(key\)/, 'recursive module inlining must retain cycle protection');

console.log('Lab module preview audit OK: local ES module imports, extensionless JS resolution, nested dependencies, cycle protection and offline CSP semantics are protected.');

import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/learning/labBehavioralTests.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'labBehavioralTests.ts',
}).outputText;

const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id.endsWith('/workspaceSafety') || id === '../lib/workspaceSafety') {
    return {
      containsLikelyWorkspaceSecret: () => false,
      workspaceCollisionKey: (path) => path.normalize('NFC').toLocaleLowerCase('en-US'),
    };
  }
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { defaultBehavioralTests } = module.exports;
assert.equal(typeof defaultBehavioralTests, 'function', 'defaultBehavioralTests must stay exported');
assert.match(source, /function hasCssRule\(draft: LabDraft\)/, 'HTML/CSS behavioral validation must inspect the full workspace');

const mission = {
  id: 'web-architecture',
  title: 'Premium web architecture',
  instructions: 'Build a polished responsive card.',
  language: 'HTML/CSS',
  starterCode: '',
  starterFiles: {
    'index.html': '<main><h1>Starter</h1></main>',
    'styles.css': 'main { color: black; }',
  },
  successCriteria: ['Modification réelle'],
};

function cssCheck(draft) {
  const check = defaultBehavioralTests(mission).find((test) => test.id === 'css-rule');
  assert.ok(check, 'HTML/CSS missions must keep the css-rule behavioral check');
  return check.run(draft);
}

const baseDraft = {
  missionId: mission.id,
  language: mission.language,
  activeFile: 'index.html',
  updatedAt: new Date(0).toISOString(),
};

assert.equal(cssCheck({
  ...baseDraft,
  files: {
    'index.html': '<main class="card">Premium</main>',
    'css/app.css': '.card { display: grid; gap: 12px; padding: 24px; }',
  },
}), true, 'nested CSS files must satisfy the CSS architecture check');

assert.equal(cssCheck({
  ...baseDraft,
  files: {
    'INDEX.HTML': '<style>.card { display:grid; gap: 12px; }</style><main class="card">Premium</main>',
  },
}), true, 'inline style blocks must satisfy the CSS architecture check');

assert.equal(cssCheck({
  ...baseDraft,
  files: {
    'index.html': '<main class="card">No styles yet</main>',
    'notes.txt': '.card looks nice but this is not a stylesheet rule file',
  },
}), false, 'CSS-looking text in unrelated files must not satisfy the CSS architecture check');

console.log('Lab CSS architecture audit OK: nested stylesheets and inline style blocks validate without hard-coding styles.css, while unrelated text does not pass.');

import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/learning/labBehavioralTests.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');

assert.match(
  source,
  /function hasCssRule\(draft: LabDraft\): boolean/,
  'HTML/CSS behavioral validation must keep a dedicated CSS evidence boundary',
);
assert.match(
  source,
  /id: 'css-rule'[\s\S]*run: hasCssRule/,
  'the HTML/CSS css-rule behavioral check must stay wired to the scoped validator',
);
assert.match(
  source,
  /const entry = resolveHtmlEntryRecord\(draft\);[\s\S]*?normalizeRelativeWorkspacePath\(href, entry\.filename\)[\s\S]*?normalizeRelativeWorkspacePath\('styles\.css', entry\.filename\)/,
  'CSS evidence must stay scoped to the resolved HTML entry and its local assets',
);

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
      workspaceCollisionKey: (filename) => filename.normalize('NFC').replace(/\\/g, '/').toLocaleLowerCase('en-US'),
    };
  }
  return {};
};
new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { defaultBehavioralTests } = module.exports;
assert.equal(typeof defaultBehavioralTests, 'function', 'defaultBehavioralTests must remain executable');

const mission = {
  id: 'css-architecture',
  title: 'CSS architecture',
  instructions: 'Build a polished web page.',
  language: 'HTML/CSS',
  starterCode: '',
  starterFiles: {},
  successCriteria: [],
};
const cssRuleTest = defaultBehavioralTests(mission).find((test) => test.id === 'css-rule');
assert.ok(cssRuleTest, 'HTML/CSS missions must keep the css-rule behavioral test');

assert.equal(cssRuleTest.run({
  missionId: mission.id,
  language: mission.language,
  files: {
    'pages/profile.html': '<link rel="stylesheet" href="../css/app.css"><main class="card">Premium</main>',
    'css/app.css': '.card { display: grid; gap: 12px; padding: 24px; }',
  },
  activeFile: 'pages/profile.html',
  updatedAt: new Date(0).toISOString(),
}), true, 'a stylesheet explicitly linked by the active HTML page must satisfy CSS validation');

assert.equal(cssRuleTest.run({
  missionId: mission.id,
  language: mission.language,
  files: {
    'INDEX.HTML': '<style>.card { display:grid; gap: 12px; }</style><main class="card">Premium</main>',
  },
  activeFile: 'INDEX.HTML',
  updatedAt: new Date(0).toISOString(),
}), true, 'inline style blocks in the active page must satisfy CSS validation');

assert.equal(cssRuleTest.run({
  missionId: mission.id,
  language: mission.language,
  files: {
    'portfolio/index.html': '<main class="card">Premium</main>',
    'portfolio/styles.css': '.card { display: grid; gap: 12px; padding: 24px; }',
  },
  activeFile: 'portfolio/app.js',
  updatedAt: new Date(0).toISOString(),
}), true, 'styles.css beside the resolved HTML entry must remain the stable local fallback');

assert.equal(cssRuleTest.run({
  missionId: mission.id,
  language: mission.language,
  files: {
    'index.html': '<main class="card">No styles yet</main>',
    'other/app.css': '.card { display: grid; }',
    'notes.txt': '.card { color: red; }',
  },
  activeFile: 'index.html',
  updatedAt: new Date(0).toISOString(),
}), false, 'CSS in unrelated workspace files must not satisfy validation for the active page');

assert.equal(cssRuleTest.run({
  missionId: mission.id,
  language: mission.language,
  files: {
    'index.html': '<link rel="stylesheet" href="https://example.com/app.css"><main>Premium</main>',
    'other/styles.css': '.card { color: lime; }',
  },
  activeFile: 'index.html',
  updatedAt: new Date(0).toISOString(),
}), false, 'external stylesheets and unrelated local CSS must not count as learner-authored evidence');

console.log('Lab CSS architecture audit OK: CSS evidence follows the active/resolved HTML page, supports linked, inline and colocated styles, and rejects unrelated workspace CSS.');

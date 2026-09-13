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
      workspaceCollisionKey: (filename) => filename.normalize('NFC').replace(/\\/g, '/').toLocaleLowerCase('en-US'),
    };
  }
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { defaultBehavioralTests } = module.exports;
assert.equal(typeof defaultBehavioralTests, 'function', 'defaultBehavioralTests must stay exported');

const mission = {
  id: 'nested-web-project',
  title: 'Nested web project',
  instructions: 'Build a polished landing page.',
  language: 'HTML/CSS',
  starterCode: '',
  starterFiles: {},
  successCriteria: [],
};

const behavioralTests = defaultBehavioralTests(mission);
const htmlStructureTest = behavioralTests.find((test) => test.id === 'html-structure');
const cssRuleTest = behavioralTests.find((test) => test.id === 'css-rule');
assert.ok(htmlStructureTest, 'HTML/CSS missions must keep an html-structure behavioral test');
assert.ok(cssRuleTest, 'HTML/CSS missions must keep a css-rule behavioral test');

const nestedDraft = {
  missionId: mission.id,
  language: mission.language,
  files: {
    'portfolio/index.html': '<main><h1>NexCode portfolio</h1></main>',
    'portfolio/styles.css': 'main { display: grid; gap: 16px; }',
  },
  activeFile: 'portfolio/styles.css',
  updatedAt: new Date(0).toISOString(),
};
assert.equal(htmlStructureTest.run(nestedDraft), true, 'nested index.html must validate even when another file is active');
assert.equal(cssRuleTest.run(nestedDraft), true, 'nested index.html must use styles.css from its own folder as the fallback stylesheet');

const activeHtmlDraft = {
  ...nestedDraft,
  files: {
    'demo/page.html': '<section><p>Interactive demo</p></section>',
    'demo/styles.css': 'section { padding: 24px; }',
  },
  activeFile: 'demo/page.html',
};
assert.equal(htmlStructureTest.run(activeHtmlDraft), true, 'an active HTML document must validate when no index.html exists');
assert.equal(cssRuleTest.run(activeHtmlDraft), true, 'an active HTML document must use its colocated styles.css fallback');

const activePreviewPriorityDraft = {
  ...nestedDraft,
  files: {
    'portfolio/index.html': 'not html structure',
    'portfolio/styles.css': 'main { color: red; }',
    'demo/page.html': '<article><h2>Active learner preview</h2></article>',
    'demo/styles.css': 'article { display: grid; gap: 12px; }',
  },
  activeFile: 'demo/page.html',
};
assert.equal(
  htmlStructureTest.run(activePreviewPriorityDraft),
  true,
  'behavioral validation must follow the active HTML preview before an unrelated nested index.html',
);
assert.equal(cssRuleTest.run(activePreviewPriorityDraft), true, 'CSS validation must follow the active HTML page assets');

const unrelatedCssDraft = {
  ...nestedDraft,
  files: {
    'index.html': '<main><h1>Active site</h1></main>',
    'other/styles.css': 'main { color: lime; }',
  },
  activeFile: 'index.html',
};
assert.equal(
  cssRuleTest.run(unrelatedCssDraft),
  false,
  'an unrelated stylesheet elsewhere in the workspace must not satisfy CSS validation for the active page',
);

const linkedCssDraft = {
  ...nestedDraft,
  files: {
    'pages/profile.html': '<link rel="stylesheet" href="../shared/profile.css?theme=dark#v1"><main><h1>Profile</h1></main>',
    'shared/profile.css': 'main { max-width: 48rem; margin: auto; }',
    'styles.css': '',
  },
  activeFile: 'pages/profile.html',
};
assert.equal(cssRuleTest.run(linkedCssDraft), true, 'a local stylesheet linked relative to the active HTML page must satisfy CSS validation');

const externalCssDraft = {
  ...linkedCssDraft,
  files: {
    'pages/profile.html': '<link rel="stylesheet" href="https://example.com/profile.css"><main><h1>Profile</h1></main>',
    'other/styles.css': 'main { color: lime; }',
  },
};
assert.equal(cssRuleTest.run(externalCssDraft), false, 'external or unrelated CSS must not be counted as local learner evidence');

const inlineCssDraft = {
  ...linkedCssDraft,
  files: {
    'pages/profile.html': '<style>main { padding: 2rem; }</style><main><h1>Profile</h1></main>',
  },
};
assert.equal(cssRuleTest.run(inlineCssDraft), true, 'inline CSS in the active page must remain valid learner evidence');

const activeOverRootDraft = {
  ...nestedDraft,
  files: {
    'index.html': '<main>Root fallback is valid</main>',
    'demo/index.html': 'not html structure',
    'styles.css': 'main { min-height: 100vh; }',
  },
  activeFile: 'demo/index.html',
};
assert.equal(
  htmlStructureTest.run(activeOverRootDraft),
  false,
  'behavioral validation must evaluate the explicitly active HTML page even when a valid root index exists',
);

const nonHtmlRootFallbackDraft = {
  ...activeOverRootDraft,
  activeFile: 'styles.css',
};
assert.equal(
  htmlStructureTest.run(nonHtmlRootFallbackDraft),
  true,
  'root index.html must remain the stable behavioral fallback while the learner edits a non-HTML file',
);
assert.equal(cssRuleTest.run(nonHtmlRootFallbackDraft), true, 'root styles.css must remain the stable CSS fallback with a non-HTML active file');

assert.match(
  source,
  /const activeKey =[\s\S]*?if \(activeHtml\) return \{ filename: activeHtml\[0\], content: activeHtml\[1\] \?\? '' \};[\s\S]*?const rootIndex = entries\.find/,
  'behavioral HTML entry resolution must keep active-page priority aligned with the preview engine',
);
assert.match(
  source,
  /const entry = resolveHtmlEntryRecord\(draft\);[\s\S]*?normalizeRelativeWorkspacePath\(href, entry\.filename\)[\s\S]*?normalizeRelativeWorkspacePath\('styles\.css', entry\.filename\)/,
  'CSS validation must remain scoped to the resolved HTML entry and its local asset paths',
);

console.log('Lab nested behavioral entry audit OK: HTML and CSS validation follow the active page, local linked/fallback assets stay scoped, and unrelated styles cannot satisfy the mission.');

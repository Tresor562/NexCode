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

const htmlStructureTest = defaultBehavioralTests(mission).find((test) => test.id === 'html-structure');
assert.ok(htmlStructureTest, 'HTML/CSS missions must keep an html-structure behavioral test');

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

const activeHtmlDraft = {
  ...nestedDraft,
  files: {
    'demo/page.html': '<section><p>Interactive demo</p></section>',
    'demo/styles.css': 'section { padding: 24px; }',
  },
  activeFile: 'demo/page.html',
};
assert.equal(htmlStructureTest.run(activeHtmlDraft), true, 'an active HTML document must validate when no index.html exists');

const rootPreferredDraft = {
  ...nestedDraft,
  files: {
    'index.html': '<main></main>',
    'demo/index.html': 'not html structure',
    'styles.css': 'main { min-height: 100vh; }',
  },
  activeFile: 'demo/index.html',
};
assert.equal(htmlStructureTest.run(rootPreferredDraft), true, 'root index.html must remain the preferred behavioral entry');

console.log('Lab nested behavioral entry audit OK: behavioral validation follows real multi-file Web project entry points without depending on the active editor tab.');

import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/learning/labEngine.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'labEngine.ts',
}).outputText;

const exports = {};
const module = { exports };
const requireStub = (id) => {
  if (id.endsWith('/workspaceSafety') || id === '../lib/workspaceSafety') {
    return {
      canonicalWorkspacePath: (path) => path,
      isSensitiveWorkspaceFilename: () => false,
      restoreWorkspaceDraft: ({ stored }) => ({ draft: stored }),
      workspaceCollisionKey: (path) => path.normalize('NFC').toLocaleLowerCase('en-US'),
    };
  }
  return {};
};

new Function('require', 'exports', 'module', compiled)(requireStub, exports, module);
const { validateLabDraft } = module.exports;
assert.equal(typeof validateLabDraft, 'function', 'validateLabDraft must stay exported');

const criteria = ['Modification réelle', 'Structure valide', 'Aucun secret réel', 'Travail complet'];

{
  const mission = {
    id: 'portable-html',
    title: 'Portable HTML validation',
    instructions: 'Build a card.',
    language: 'HTML/CSS',
    starterCode: '',
    starterFiles: {
      'index.html': '<main><h1>Starter</h1></main>',
      'styles.css': 'main { color: black; }',
    },
    successCriteria: criteria,
  };
  const draft = {
    missionId: mission.id,
    language: mission.language,
    files: {
      'INDEX.HTML': '<main><h1>Premium card</h1><p>Portable workspace</p></main>',
      'Styles.CSS': 'main { display: grid; gap: 12px; padding: 24px; }',
    },
    activeFile: 'INDEX.HTML',
    updatedAt: new Date(0).toISOString(),
  };

  const result = validateLabDraft(mission, draft);
  assert.equal(result.checks.find((check) => check.id === 'structure')?.passed, true, 'HTML/CSS structure validation must resolve case-equivalent entry files');
  assert.equal(result.checks.find((check) => check.id === 'complete')?.passed, true, 'HTML/CSS completeness must accept portable extension casing');
  assert.equal(result.passed, true, 'a valid portable HTML/CSS workspace must be fully accepted');
}

{
  const mission = {
    id: 'portable-node',
    title: 'Portable Node validation',
    instructions: 'Build an API.',
    language: 'Node/API',
    starterCode: '',
    starterFiles: { 'server.js': 'const starter = true;' },
    successCriteria: criteria,
  };
  const draft = {
    missionId: mission.id,
    language: mission.language,
    files: {
      'SERVER.TS': 'const http = require("http");\nhttp.createServer((req, res) => res.end("ok")).listen(3000);',
    },
    activeFile: 'SERVER.TS',
    updatedAt: new Date(0).toISOString(),
  };

  const result = validateLabDraft(mission, draft);
  assert.equal(result.checks.find((check) => check.id === 'complete')?.passed, true, 'Node/Bot completeness must accept uppercase .JS/.TS extensions');
  assert.equal(result.passed, true, 'a valid portable Node workspace must be fully accepted');
}

console.log('Lab portable validation audit OK: validation now follows the same case/Unicode path policy as the workspace and preview.');

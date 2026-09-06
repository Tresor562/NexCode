import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const behavioralSource = fs.readFileSync(new URL('../src/learning/labBehavioralTests.ts', import.meta.url), 'utf8');
const safetySource = fs.readFileSync(new URL('../src/lib/workspaceSafety.ts', import.meta.url), 'utf8');

function transpile(source, fileName) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName,
  }).outputText;
}

function executeCommonJs(compiled, requireImpl = () => ({})) {
  const exports = {};
  const module = { exports };
  new Function('require', 'exports', 'module', compiled)(requireImpl, exports, module);
  return module.exports;
}

const safetyExports = executeCommonJs(transpile(safetySource, 'workspaceSafety.ts'));
assert.equal(
  typeof safetyExports.containsLikelyWorkspaceSecret,
  'function',
  'The starter-delta audit must execute with the real shared workspace secret guard',
);

const behavioralExports = executeCommonJs(
  transpile(behavioralSource, 'labBehavioralTests.ts'),
  (specifier) => specifier === '../lib/workspaceSafety' ? safetyExports : {},
);
const { runBehavioralSuite } = behavioralExports;

assert.equal(typeof runBehavioralSuite, 'function', 'runBehavioralSuite must stay exported');
assert.match(behavioralSource, /normalize\('NFC'\)\.toLocaleLowerCase\('en-US'\)/, 'starter delta paths must use portable case/Unicode identity');
assert.match(behavioralSource, /resolvePortableDraftFile\(draft, 'index\.html'\)/, 'HTML checks must resolve portable workspace paths');
assert.match(behavioralSource, /resolvePortableDraftFile\(draft, 'styles\.css'\)/, 'CSS checks must resolve portable workspace paths');
assert.match(behavioralSource, /stored === undefined\) return false/, 'missing starter files must fail learning evidence');
assert.match(behavioralSource, /function meaningfulEvidenceSource\(content: string, filename: string\)/, 'Lab evidence must stay syntax-aware per file');
assert.match(behavioralSource, /supportsHashComments/, 'hash comments must stay syntax-gated');
assert.match(behavioralSource, /supportsSqlComments/, 'SQL comments must stay syntax-gated');

const mission = {
  id: 'html-card-lab',
  title: 'Carte profil',
  instructions: 'Personnalise réellement le composant de départ.',
  language: 'HTML/CSS',
  starterFiles: {
    'index.html': '<main>\n  <h1>NexCode Lab</h1>\n</main>\n',
    'styles.css': 'body {\n  font-family: sans-serif;\n}\n',
    'script.js': '',
  },
  successCriteria: [],
};

function draft(files) {
  return {
    missionId: mission.id,
    language: mission.language,
    files,
    activeFile: 'index.html',
    updatedAt: '2026-09-06T06:00:00.000Z',
  };
}

const unchanged = runBehavioralSuite(mission, draft({ ...mission.starterFiles }));
assert.equal(unchanged.passed, false, 'untouched starter workspaces must never pass');
assert.equal(unchanged.hiddenPassed, 0, 'untouched starters must fail the hidden delta proof');

const caseOnlyRename = runBehavioralSuite(mission, draft({
  'INDEX.HTML': mission.starterFiles['index.html'],
  'Styles.CSS': mission.starterFiles['styles.css'],
  'SCRIPT.JS': mission.starterFiles['script.js'],
}));
assert.equal(caseOnlyRename.visible.every((check) => check.passed), true, 'portable case-only paths must still satisfy visible checks');
assert.equal(caseOnlyRename.hiddenPassed, 0, 'case-only renames must not masquerade as learner work');

const commentOnly = runBehavioralSuite(mission, draft({
  ...mission.starterFiles,
  'index.html': `${mission.starterFiles['index.html']}<!-- terminé -->`,
  'styles.css': `${mission.starterFiles['styles.css']}\n/* joli */`,
  'script.js': '// done',
}));
assert.equal(commentOnly.hiddenPassed, 0, 'comment-only filler must not earn Lab progress');
assert.equal(commentOnly.passed, false, 'comment-only filler must not pass the Lab suite');

const cssIdSelector = runBehavioralSuite(mission, draft({
  ...mission.starterFiles,
  'styles.css': `${mission.starterFiles['styles.css']}\n#hero {\n  color: tomato;\n}`,
}));
assert.equal(cssIdSelector.hiddenPassed, 1, 'a real CSS ID selector must count as substantive work');
assert.equal(cssIdSelector.passed, true, 'valid CSS work should pass the behavioral suite');

const missingStarter = runBehavioralSuite(mission, draft({
  'index.html': '<main><h1>Mon portfolio</h1></main>',
  'script.js': '',
}));
assert.equal(missingStarter.hiddenPassed, 0, 'deleting a canonical starter file must not count as evidence');
assert.equal(missingStarter.passed, false, 'workspaces missing starter files must fail');

const edited = runBehavioralSuite(mission, draft({
  ...mission.starterFiles,
  'index.html': '<main>\n  <h1>Mon portfolio</h1>\n</main>\n',
}));
assert.equal(edited.hiddenPassed, 1, 'a substantive starter edit must satisfy hidden delta proof');
assert.equal(edited.passed, true, 'a valid substantive edit should pass');

const secretDraft = draft({
  ...mission.starterFiles,
  'script.js': 'const api_key = "ghp_123456789012345678901234567890";',
});
assert.equal(runBehavioralSuite(mission, secretDraft).passed, false, 'the executable audit harness must preserve the shared secret gate');

const jsMission = {
  id: 'js-lab',
  title: 'Compteur',
  instructions: 'Modifie le comportement.',
  language: 'JavaScript',
  starterCode: 'const count = 0;',
  successCriteria: [],
};
const jsUnchanged = runBehavioralSuite(jsMission, {
  missionId: jsMission.id,
  language: jsMission.language,
  files: { 'main.js': 'const count = 0;' },
  activeFile: 'main.js',
  updatedAt: '2026-09-06T06:00:00.000Z',
});
assert.equal(jsUnchanged.hiddenPassed, 0, 'starterCode-only missions must reject unchanged submissions');

console.log('Lab starter delta audit OK: real shared safety dependencies execute while filler, path aliases and unchanged starters remain blocked.');

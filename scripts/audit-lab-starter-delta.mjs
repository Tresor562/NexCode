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
new Function('require', 'exports', 'module', compiled)(() => ({}), exports, module);
const { runBehavioralSuite } = module.exports;
assert.equal(typeof runBehavioralSuite, 'function', 'runBehavioralSuite must stay exported');
assert.match(source, /normalize\('NFC'\)\.toLocaleLowerCase\('en-US'\)/, 'starter delta paths must use the portable case/Unicode identity policy');
assert.match(source, /resolvePortableDraftFile\(draft, 'index\.html'\)/, 'HTML behavioral checks must resolve portable workspace paths');
assert.match(source, /resolvePortableDraftFile\(draft, 'styles\.css'\)/, 'CSS behavioral checks must resolve portable workspace paths');
assert.match(source, /stored === undefined\) return false/, 'missing starter files must fail Lab learning evidence');
assert.match(
  source,
  /normalizeSource\(starterContent\)\.trim\(\)\.length > 0\s*&&\s*normalizeSource\(stored\.content\)\.trim\(\)\.length === 0\) return false/,
  'emptying non-empty starter files must fail Lab learning evidence',
);
assert.match(source, /function meaningfulEvidenceSource\(content: string, filename: string\)/, 'Lab evidence must be syntax-aware per workspace file');
assert.match(source, /supportsHashComments/, 'Lab evidence must gate hash comments by file syntax');
assert.match(source, /supportsSqlComments/, 'Lab evidence must gate SQL comments by file syntax');
assert.match(source, /replace\(\/<!--\[\\s\\S\]\*\?-->\/g, ''\)/, 'HTML-only comments must not earn Lab progress');
assert.match(source, /replace\(\/\\\/\\\*\[\\s\\S\]\*\?\\\*\\\/\/g, ''\)/, 'block comments must not earn Lab progress');

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
    updatedAt: '2026-08-30T12:00:00.000Z',
  };
}

const unchanged = runBehavioralSuite(mission, draft({ ...mission.starterFiles }));
assert.equal(unchanged.passed, false, 'an untouched starter workspace must never pass the Lab suite');
assert.equal(unchanged.hiddenTotal, 1, 'starter-change proof must stay hidden from the learner');
assert.equal(unchanged.hiddenPassed, 0, 'an untouched starter workspace must fail the hidden delta check');

const caseOnlyRename = runBehavioralSuite(mission, draft({
  'INDEX.HTML': mission.starterFiles['index.html'],
  'Styles.CSS': mission.starterFiles['styles.css'],
  'SCRIPT.JS': mission.starterFiles['script.js'],
}));
assert.equal(caseOnlyRename.hiddenPassed, 0, 'portable case-only starter renames must not masquerade as learner work');
assert.equal(caseOnlyRename.visible.every((check) => check.passed), true, 'portable case-only names must still satisfy visible HTML/CSS structure checks');
assert.equal(caseOnlyRename.passed, false, 'case-only renames must fail only because no substantive starter delta exists');

const newlineOnly = runBehavioralSuite(mission, draft({
  ...mission.starterFiles,
  'index.html': '<main>\r\n  <h1>NexCode Lab</h1>\r\n</main>\r\n\r\n',
}));
assert.equal(newlineOnly.hiddenPassed, 0, 'line-ending or trailing-whitespace churn must not count as real work');

const commentOnly = runBehavioralSuite(mission, draft({
  ...mission.starterFiles,
  'index.html': `${mission.starterFiles['index.html']}<!-- terminé -->`,
  'styles.css': `${mission.starterFiles['styles.css']}\n/* joli */`,
  'script.js': '// done',
}));
assert.equal(commentOnly.hiddenPassed, 0, 'comment-only edits must not satisfy the hidden Lab progress check');
assert.equal(commentOnly.passed, false, 'comment-only filler must not pass the Lab suite');

const cssIdSelector = runBehavioralSuite(mission, draft({
  ...mission.starterFiles,
  'styles.css': `${mission.starterFiles['styles.css']}\n#hero {\n  color: tomato;\n}`,
}));
assert.equal(cssIdSelector.hiddenPassed, 1, 'a CSS ID selector must count as real Lab work, not a hash comment');
assert.equal(cssIdSelector.passed, true, 'valid CSS ID-selector work should pass the Lab behavioral suite');

const commentOnlyAddedFile = runBehavioralSuite(mission, draft({
  ...mission.starterFiles,
  'notes.js': '// beaucoup de texte pour contourner une validation de longueur uniquement',
}));
assert.equal(commentOnlyAddedFile.hiddenPassed, 0, 'a comment-only learner-created file must not count as substantive work');

const missingStarter = runBehavioralSuite(mission, draft({
  'index.html': '<main><h1>Mon portfolio</h1></main>',
  'script.js': '',
}));
assert.equal(missingStarter.hiddenPassed, 0, 'deleting a canonical starter file must never count as learning evidence');
assert.equal(missingStarter.passed, false, 'a workspace with a deleted starter file must fail the Lab suite');

const emptiedStarter = runBehavioralSuite(mission, draft({
  ...mission.starterFiles,
  'index.html': '<main><h1>Mon portfolio</h1></main>',
  'styles.css': '   \n\t',
}));
assert.equal(emptiedStarter.hiddenPassed, 0, 'emptying required starter content must never count as a meaningful edit');
assert.equal(emptiedStarter.passed, false, 'a workspace with emptied required starter content must fail the Lab suite');

const edited = runBehavioralSuite(mission, draft({
  ...mission.starterFiles,
  'index.html': '<main>\n  <h1>Mon portfolio</h1>\n</main>\n',
}));
assert.equal(edited.hiddenPassed, 1, 'a substantive edit to a starter file must satisfy the hidden delta check');
assert.equal(edited.passed, true, 'a valid substantive HTML edit should pass the behavioral suite');

const addedFile = runBehavioralSuite(mission, draft({
  ...mission.starterFiles,
  'notes.md': 'Décisions de conception : hiérarchie, contraste et contenu personnalisé.',
}));
assert.equal(addedFile.hiddenPassed, 1, 'a substantive learner-created file must count as a real workspace change');

const pythonMission = {
  id: 'python-lab',
  title: 'Variable Python',
  instructions: 'Modifie le comportement.',
  language: 'Python',
  starterCode: 'value = 1',
  successCriteria: [],
};
const pythonHashComment = runBehavioralSuite(pythonMission, {
  missionId: pythonMission.id,
  language: pythonMission.language,
  files: { 'main.py': 'value = 1\n# ceci reste seulement un commentaire très long' },
  activeFile: 'main.py',
  updatedAt: '2026-08-30T12:00:00.000Z',
});
assert.equal(pythonHashComment.hiddenPassed, 0, 'Python hash comments must still be ignored as filler');

const singleFileMission = {
  id: 'js-lab',
  title: 'Compteur',
  instructions: 'Modifie le comportement.',
  language: 'JavaScript',
  starterCode: 'const count = 0;',
  successCriteria: [],
};
const singleUnchanged = runBehavioralSuite(singleFileMission, {
  missionId: singleFileMission.id,
  language: singleFileMission.language,
  files: { 'main.js': 'const count = 0;' },
  activeFile: 'main.js',
  updatedAt: '2026-08-30T12:00:00.000Z',
});
assert.equal(singleUnchanged.hiddenPassed, 0, 'starterCode-only missions must also reject unchanged submissions');

const singleCommentOnly = runBehavioralSuite(singleFileMission, {
  missionId: singleFileMission.id,
  language: singleFileMission.language,
  files: { 'main.js': 'const count = 0;\n// changed' },
  activeFile: 'main.js',
  updatedAt: '2026-08-30T12:00:00.000Z',
});
assert.equal(singleCommentOnly.hiddenPassed, 0, 'starterCode-only missions must reject comment-only changes too');

console.log('Lab starter delta audit OK: syntax-aware evidence ignores filler without discarding real CSS selectors.');
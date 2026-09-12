import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/learning/labBehavioralTests.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');

assert.match(
  source,
  /function hasCssRule\(draft: LabDraft\): boolean/,
  'HTML/CSS behavioral validation must inspect the full workspace',
);
assert.match(
  source,
  /id: 'css-rule'[\s\S]*run: hasCssRule/,
  'the HTML/CSS css-rule behavioral check must stay wired to the workspace-wide validator',
);

const functionMatch = source.match(
  /function hasCssRule\(draft: LabDraft\): boolean \{[\s\S]*?\n\}\n\nfunction starterFilenameFor/,
);
assert.ok(functionMatch, 'hasCssRule implementation must remain auditable');
const functionSource = functionMatch[0].replace(/\n\nfunction starterFilenameFor$/, '');
const harnessSource = `
type LabDraft = { files: Record<string, string> };
${functionSource}
export { hasCssRule };
`;
const compiled = ts.transpileModule(harnessSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: 'lab-css-architecture-harness.ts',
}).outputText;

const exports = {};
const module = { exports };
new Function('exports', 'module', compiled)(exports, module);
const { hasCssRule } = module.exports;
assert.equal(typeof hasCssRule, 'function', 'hasCssRule must remain executable');

assert.equal(hasCssRule({
  files: {
    'index.html': '<main class="card">Premium</main>',
    'css/app.css': '.card { display: grid; gap: 12px; padding: 24px; }',
  },
}), true, 'nested CSS files must satisfy the CSS architecture check');

assert.equal(hasCssRule({
  files: {
    'INDEX.HTML': '<style>.card { display:grid; gap: 12px; }</style><main class="card">Premium</main>',
  },
}), true, 'inline style blocks must satisfy the CSS architecture check');

assert.equal(hasCssRule({
  files: {
    'index.html': '<main class="card">No styles yet</main>',
    'notes.txt': '.card looks nice but this is not a stylesheet rule file',
  },
}), false, 'CSS-looking text in unrelated files must not satisfy the CSS architecture check');

assert.equal(hasCssRule({
  files: {
    'index.html': '<style>/* explanatory text only */</style><main>Premium</main>',
    'README.md': '.card { not a stylesheet file }',
  },
}), false, 'non-style files must not accidentally satisfy the CSS architecture check');

console.log('Lab CSS architecture audit OK: nested stylesheets and inline style blocks validate without hard-coding styles.css, while unrelated files do not pass.');

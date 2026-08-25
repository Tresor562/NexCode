import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourceUrl = new URL('../src/lib/practice.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: 'practice.ts',
}).outputText;

const exports = {};
const module = { exports };
new Function('exports', 'module', compiled)(exports, module);
const { checkPractice } = module.exports;

assert.equal(typeof checkPractice, 'function', 'checkPractice must stay exported');

const passes = (language, code) => checkPractice(language, code).startsWith('✓');

assert.equal(passes('HTML/CSS', '<main>Hello</main><style>main { color: red; }</style>'), true, 'real HTML + CSS should pass');
assert.equal(passes('HTML/CSS', '<button style="color: red">Go</button>'), true, 'inline CSS should pass');
assert.equal(passes('HTML/CSS', '<!-- <main style="color:red">fake</main> -->'), false, 'HTML comments must not satisfy practice checks');
assert.equal(passes('HTML/CSS', '<main>Hello</main><script>const fake = { color: "red" };</script>'), false, 'JavaScript object syntax must not be mistaken for CSS');

assert.equal(passes('JavaScript', 'const total = 2 + 2;\nconsole.log(total);'), true, 'real JavaScript declaration + output should pass');
assert.equal(passes('JavaScript', '// const total = 4; console.log(total);'), false, 'comment-only JavaScript must fail');
assert.equal(passes('JavaScript', '/* let total = 4; console.log(total); */'), false, 'block-comment JavaScript must fail');

assert.equal(passes('Python', 'def total():\n    return 4'), true, 'Python function + indented return should pass');
assert.equal(passes('Python', 'async def total():\n    return 4'), true, 'async Python functions should pass');
assert.equal(passes('Python', '# def total():\n#     return 4'), false, 'comment-only Python must fail');

assert.equal(passes('SQL', 'SELECT id FROM users;'), true, 'basic SELECT should pass');
assert.equal(passes('SQL', 'WITH active AS (SELECT id FROM users) SELECT id FROM active;'), true, 'CTE SELECT queries should pass');
assert.equal(passes('SQL', '-- SELECT id FROM users;'), false, 'comment-only SQL must fail');
assert.equal(passes('SQL', '/* SELECT id FROM users; */'), false, 'block-comment SQL must fail');

assert.match(checkPractice('JavaScript', '   '), /Écris une réponse/i, 'blank practice should keep explicit feedback');

console.log('Practice checks audit OK: comment-only answers rejected and real HTML/CSS, JS, Python and SQL structures accepted.');

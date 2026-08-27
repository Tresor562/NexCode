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
assert.equal(passes('HTML/CSS', '<main>Hello</main><style>:root { --accent: #7c3aed; }</style>'), true, 'CSS custom properties should count as real declarations');
assert.equal(passes('HTML/CSS', '<!-- <main style="color:red">fake</main> -->'), false, 'HTML comments must not satisfy practice checks');
assert.equal(passes('HTML/CSS', '<main>Hello</main><script>const fake = { color: "red" };</script>'), false, 'JavaScript object syntax must not be mistaken for CSS');
assert.equal(passes('HTML/CSS', '<main>Hello</main><style>/* main { color: red; } */</style>'), false, 'comment-only CSS blocks must not satisfy practice checks');
assert.equal(passes('HTML/CSS', '<main style="/* color: red; */">Hello</main>'), false, 'comment-only inline CSS must not satisfy practice checks');
assert.equal(passes('HTML/CSS', '<script>const fake = "<main>Hello</main>";</script><style>main { color: red; }</style>'), false, 'markup that only exists inside script text must not satisfy practice checks');

assert.equal(passes('JavaScript', 'const total = 2 + 2;\nconsole.log(total);'), true, 'real JavaScript declaration + output should pass');
assert.equal(passes('JavaScript', 'const first = 2;\nconst second = 3;\nconsole.log(first + second);'), true, 'console output may use declared values inside an expression');
assert.equal(passes('JavaScript', 'const $total = 4;\nconsole.log($total);'), true, 'valid dollar-prefixed identifiers should be recognised');
assert.equal(passes('JavaScript', '// const total = 4; console.log(total);'), false, 'comment-only JavaScript must fail');
assert.equal(passes('JavaScript', '/* let total = 4; console.log(total); */'), false, 'block-comment JavaScript must fail');
assert.equal(passes('JavaScript', 'const note = "console.log(total)";'), false, 'console.log text inside a string must not satisfy the output check');
assert.equal(passes('JavaScript', 'const total = 4;\nconsole.log("hello");'), false, 'output unrelated to the declared value must not validate the practice');
assert.equal(passes('JavaScript', 'const total = 4;\nconsole.log(4);'), false, 'printing only a literal must not stand in for using the declared value');
assert.equal(passes('JavaScript', 'const total = 4;\nconsole.log(totalValue);'), false, 'a longer unrelated identifier must not be mistaken for the declared value');
assert.equal(passes('JavaScript', 'const url = "https://example.com/path";\nconsole.log(url);'), true, 'URL strings must not be mistaken for line comments');
assert.equal(passes('JavaScript', 'const sample = `console.log(fake)`;'), false, 'template text must not count as executable console output');

assert.equal(passes('Python', 'def total():\n    return 4'), true, 'Python function + indented return should pass');
assert.equal(passes('Python', 'async def total():\n    return 4'), true, 'async Python functions should pass');
assert.equal(passes('Python', 'def total():\n    if True:\n        return 4'), true, 'returns nested in normal control flow should count for the function');
assert.equal(passes('Python', '# def total():\n#     return 4'), false, 'comment-only Python must fail');
assert.equal(passes('Python', 'def total():\n    """return 4"""\n    pass'), false, 'return text inside a docstring must not satisfy the function check');
assert.equal(passes('Python', 'note = "def total():\\n    return 4"'), false, 'Python code embedded only in a string must fail');
assert.equal(passes('Python', 'def total():\n    pass\n\nif True:\n    return_value = 4'), false, 'a return-like statement outside the function body must not satisfy the function check');
assert.equal(passes('Python', 'def outer():\n    def inner():\n        return 4\n    pass'), false, 'a return that belongs only to a nested function must not validate the outer function');
assert.equal(passes('Python', 'class Result:\n    def value(self):\n        return 4'), true, 'methods with a return should still count as valid function practice');

assert.equal(passes('SQL', 'SELECT id FROM users;'), true, 'basic SELECT should pass');
assert.equal(passes('SQL', 'WITH active AS (SELECT id FROM users) SELECT id FROM active;'), true, 'CTE SELECT queries should pass');
assert.equal(passes('SQL', '-- SELECT id FROM users;'), false, 'comment-only SQL must fail');
assert.equal(passes('SQL', '/* SELECT id FROM users; */'), false, 'block-comment SQL must fail');
assert.equal(passes('SQL', "SELECT 'FROM users' AS example;"), false, 'FROM text inside a SQL string literal must not satisfy the table check');
assert.equal(passes('SQL', "SELECT 'it''s safe' AS label FROM users;"), true, 'escaped SQL string literals must not break real FROM detection');

assert.match(checkPractice('JavaScript', '   '), /Écris une réponse/i, 'blank practice should keep explicit feedback');

console.log('Practice checks audit OK: fake code, unrelated JavaScript output, comment-only CSS, scripted markup and out-of-scope Python returns are rejected while real HTML/CSS, JS, Python and SQL structures remain accepted.');

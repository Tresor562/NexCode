import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/learning/labEngine.ts', import.meta.url), 'utf8');

function assertContains(fragment, message) {
  if (!source.includes(fragment)) throw new Error(message);
}

assertContains('function sourceWithoutComments(content: string, filename: string)', 'Lab validation must centralize comment stripping before evaluating learning evidence.');
assertContains(".replace(/<!--[\\s\\S]*?-->/g, '')", 'HTML comments must not count as Lab structure evidence.');
assertContains(".replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')", 'Block comments must not count as Lab structure evidence.');
assertContains("if (/^\\s*\\/\\/(?:\\s|$)/.test(line)) return false;", 'Line comments must not count as Lab structure evidence.');
assertContains("if (supportsHashComments && /^\\s*#(?:\\s|$)/.test(line)) return false;", 'Hash comments must not count as Python-style Lab structure evidence.');
assertContains("if (supportsSqlComments && /^\\s*--(?:\\s|$)/.test(line)) return false;", 'SQL comments must not count as Lab structure evidence.');
assertContains('const evidenceFiles = structureEvidenceFiles(files);', 'Language structure validation must operate on comment-stripped evidence files.');
assertContains("const joined = Object.values(evidenceFiles).join('\\n');", 'Language structure validation must not fall back to raw workspace source.');

const structureStart = source.indexOf("function languageStructureCheck(language: LabMission['language'], files: Record<string, string>)");
const completenessStart = source.indexOf('function completenessCheck', structureStart);
if (structureStart < 0 || completenessStart < 0) throw new Error('Unable to locate the Lab structure validation boundary.');
const structureBody = source.slice(structureStart, completenessStart);
if (structureBody.includes("Object.values(files).join('\\n')")) {
  throw new Error('Raw commented workspace source must not be used by Lab structure validation.');
}

console.log('Lab comment-evidence audit passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';

const sourceUrl = new URL('../src/learning/projectPortfolioEngine.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');

assert.match(
  source,
  /const declaredSkills = canonicalProjectSkills\(project\.skills\);/,
  'Portfolio proof creation must derive its skill requirement from canonical project declarations.',
);
assert.match(
  source,
  /const skillIds = \[\.\.\.new Set\(resolveProjectSkills\(project, graph\)\.flatMap\(\(item\) => item\.skillIds\)\)\];/,
  'Portfolio proof creation must resolve actual graph skill ids before persistence.',
);
assert.match(
  source,
  /if \(declaredSkills\.length > 0 && skillIds\.length === 0\) return undefined;/,
  'A project that declares skills must fail closed when none can be resolved into evidence.',
);

const proofBuilder = source.match(/export function buildPortfolioProof\([\s\S]*?\n\}/)?.[0] ?? '';
assert.ok(proofBuilder, 'Could not isolate buildPortfolioProof.');
const resolutionIndex = proofBuilder.indexOf('const skillIds =');
const skillGateIndex = proofBuilder.indexOf('if (declaredSkills.length > 0 && skillIds.length === 0) return undefined;');
const returnIndex = proofBuilder.indexOf('return {');
assert.ok(resolutionIndex >= 0 && skillGateIndex > resolutionIndex && returnIndex > skillGateIndex, 'Skill evidence must be resolved and gated before a portfolio proof object can be returned.');

console.log('Portfolio skill proof audit passed.');

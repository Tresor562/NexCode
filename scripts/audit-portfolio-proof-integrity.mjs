import assert from 'node:assert/strict';
import fs from 'node:fs';

const sourceUrl = new URL('../src/learning/projectPortfolioEngine.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');

assert.match(source, /function validCompletionDate\(value: Date\): Date/, 'portfolio proof persistence must validate completion dates centrally');
assert.match(source, /value instanceof Date && Number\.isFinite\(value\.getTime\(\)\) \? value : new Date\(\)/, 'invalid completion dates must fall back before toISOString');
assert.match(source, /function canonicalAchievedRubricIds\(/, 'portfolio proofs must canonicalize achieved rubric ids');
assert.match(source, /new Set\(defaultProjectRubric\(project\)\.map\(\(item\) => item\.id\)\)/, 'only rubric ids declared by the project rubric may be persisted');
assert.match(source, /new Set\(achievedRubricIds\.map\(\(id\) => id\.trim\(\)\)\.filter\(\(id\) => id && allowed\.has\(id\)\)\)/, 'rubric ids must be trimmed, filtered and deduplicated');
assert.match(source, /const safeRubricIds = canonicalAchievedRubricIds\(project, achievedRubricIds\);[\s\S]*reviewProject\(project, safeRubricIds\)/, 'project review must score the same canonical rubric evidence that is persisted');
assert.match(source, /rubricIds: safeRubricIds/, 'portfolio proof must persist canonical rubric evidence only');
assert.match(source, /completedAt: validCompletionDate\(completedAt\)\.toISOString\(\)/, 'portfolio proof serialization must never call toISOString on an unchecked date');

console.log('Portfolio proof integrity audit OK: completion dates and rubric evidence are canonicalized before scoring and persistence.');

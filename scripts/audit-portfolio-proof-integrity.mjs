import assert from 'node:assert/strict';
import fs from 'node:fs';

const sourceUrl = new URL('../src/learning/projectPortfolioEngine.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');

assert.match(source, /const MAX_COMPLETION_CLOCK_SKEW_MS = 5 \* 60 \* 1000;/, 'portfolio proof creation must bound tolerated device clock skew');
assert.match(source, /function validCompletionDate\(value: Date, now = new Date\(\)\): Date/, 'portfolio proof persistence must validate completion dates centrally');
assert.match(source, /const safeNow = now instanceof Date && Number\.isFinite\(now\.getTime\(\)\) \? now : new Date\(\);/, 'portfolio proof date validation must itself use a valid reference clock');
assert.match(source, /if \(!\(value instanceof Date\) \|\| !Number\.isFinite\(value\.getTime\(\)\)\) return safeNow;/, 'invalid completion dates must fall back before toISOString');
assert.match(source, /value\.getTime\(\) <= safeNow\.getTime\(\) \+ MAX_COMPLETION_CLOCK_SKEW_MS \? value : safeNow/, 'future-dated portfolio evidence beyond tolerated clock skew must never be persisted');
assert.match(source, /function canonicalAchievedRubricIds\(/, 'portfolio proofs must canonicalize achieved rubric ids');
assert.match(source, /new Set\(defaultProjectRubric\(project\)\.map\(\(item\) => item\.id\)\)/, 'only rubric ids declared by the project rubric may be persisted');
assert.match(source, /new Set\(achievedRubricIds\.map\(\(id\) => id\.trim\(\)\)\.filter\(\(id\) => id && allowed\.has\(id\)\)\)/, 'rubric ids must be trimmed, filtered and deduplicated');
assert.match(source, /const safeRubricIds = canonicalAchievedRubricIds\(project, achievedRubricIds\);[\s\S]*reviewProject\(project, safeRubricIds\)/, 'project review must score the same canonical rubric evidence that is persisted');
assert.match(source, /rubricIds: safeRubricIds/, 'portfolio proof must persist canonical rubric evidence only');
assert.match(source, /completedAt: validCompletionDate\(completedAt\)\.toISOString\(\)/, 'portfolio proof serialization must never call toISOString on an unchecked date');
assert.match(source, /function canonicalProofSkillIds\(skillIds: string\[\]\): string\[\]/, 'portfolio coverage must canonicalize restored skill ids before counting evidence');
assert.match(source, /const skillId = raw\.trim\(\);[\s\S]*const identity = normalize\(skillId\);[\s\S]*if \(!identity \|\| seen\.has\(identity\)\) continue;/, 'restored portfolio skill ids must be trimmed, empty-filtered and deduplicated by normalized identity');
assert.match(source, /for \(const skillId of canonicalProofSkillIds\(proof\.skillIds\)\)/, 'each project proof must contribute at most one coverage unit per canonical skill');
assert.doesNotMatch(source, /for \(const proof of proofs\) for \(const skillId of proof\.skillIds\)/, 'raw restored skill arrays must never be counted directly');

console.log('Portfolio proof integrity audit OK: completion timestamps, rubric evidence, and per-project skill coverage are canonicalized before persistence or counting.');

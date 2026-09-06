import assert from 'node:assert/strict';
import fs from 'node:fs';

const sourceUrl = new URL('../src/learning/projectPortfolioEngine.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const progressSourceUrl = new URL('../src/learning/projectProgressEngine.ts', import.meta.url);
const progressSource = fs.readFileSync(progressSourceUrl, 'utf8');

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
assert.match(source, /const projectsBySkillIdentity = new Map<string, Set<string>>\(\);/, 'portfolio coverage must track distinct project identities per normalized skill identity');
assert.match(source, /const skillIdByIdentity = new Map<string, string>\(\);/, 'portfolio coverage must preserve a stable display skill id while deduplicating normalized identities');
assert.match(source, /const projectId = typeof proof\.projectId === 'string' \? normalize\(proof\.projectId\) : '';/, 'restored project ids must be canonicalized before coverage counting');
assert.match(source, /if \(!projectId\) continue;/, 'invalid restored project ids must not contribute portfolio coverage');
assert.match(source, /for \(const skillId of canonicalProofSkillIds\(proof\.skillIds\)\)/, 'each proof must contribute only canonical skill ids');
assert.match(source, /const skillIdentity = normalize\(skillId\);/, 'skill identities from separate sync proofs must be normalized before aggregation');
assert.match(source, /if \(!skillIdByIdentity\.has\(skillIdentity\)\) skillIdByIdentity\.set\(skillIdentity, skillId\);/, 'the first canonical skill id must remain available for UI display');
assert.match(source, /projects\.add\(projectId\);/, 'duplicate restored proofs for one project must collapse to one project contribution per skill');
assert.match(source, /projectCount: projectIds\.size/, 'portfolio coverage must be the number of distinct projects, not the number of proof rows');
assert.doesNotMatch(source, /projectsBySkill\.get\(skillId\)/, 'raw skill-id spelling must not split coverage after cross-device sync');
assert.doesNotMatch(source, /covered\.set\(skillId, \(covered\.get\(skillId\) \?\? 0\) \+ 1\)/, 'raw proof-row counting must not inflate skill coverage after sync duplication');

assert.match(progressSource, /function canonicalizePortfolioProof\(proof: PortfolioProof, project: GuidedProject\): PortfolioProof/, 'reward persistence must canonicalize validated portfolio proofs before storing them');
assert.match(progressSource, /projectId: project\.id/, 'stored portfolio proof identity must use the canonical registered project id');
assert.match(progressSource, /title: project\.title\.trim\(\)/, 'stored portfolio proof title must come from canonical product data');
assert.match(progressSource, /completedAt: new Date\(completedAt\)\.toISOString\(\)/, 'stored portfolio completion timestamps must be normalized before later version comparisons');
assert.match(progressSource, /evidenceSummary: proof\.evidenceSummary\.trim\(\)/, 'stored portfolio evidence summaries must not retain harmless identity-breaking whitespace');
assert.match(progressSource, /const canonicalProof = canonicalizePortfolioProof\(proof, project\);/, 'the reward path must canonicalize proof payloads immediately after validation');
assert.match(progressSource, /findIndex\(\(item\) => item\.projectId\.trim\(\) === project\.id\)/, 'legacy or cloud-restored proofs with surrounding whitespace must still be detected as existing rewards');
assert.match(progressSource, /index === existingIndex \? canonicalProof : item/, 'proof updates must replace legacy payloads with canonical data');
assert.match(progressSource, /portfolioProofs: \[\.\.\.rewarded\.portfolioProofs, canonicalProof\]/, 'first-time portfolio rewards must persist only canonical proof identity');
assert.doesNotMatch(progressSource, /portfolioProofs: \[\.\.\.rewarded\.portfolioProofs, proof\]/, 'raw validated proof payloads must never be appended to the reward ledger');

console.log('Portfolio proof integrity audit OK: completion timestamps, rubric evidence, normalized skill/project identity, reward deduplication, and distinct-project coverage are canonicalized before persistence or counting.');

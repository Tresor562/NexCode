import fs from 'node:fs';

const enginePath = new URL('../src/learning/projectProgressEngine.ts', import.meta.url);
const source = fs.readFileSync(enginePath, 'utf8');

function expect(pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

expect(/import \{ guidedProjects \} from '\.\.\/data\/projects';/, 'Project rewards must resolve projects from canonical product data.');
expect(/function canonicalProject\(projectId:\s*unknown\):\s*GuidedProject \| undefined/, 'Project reward boundaries need a canonical project resolver.');
expect(/guidedProjects\.find\(\(project\)\s*=>\s*project\.id\s*===\s*id\)/, 'Canonical project lookup must be keyed by registered project id.');
expect(/const registeredProject = canonicalProject\(project\?\.id\);[\s\S]*if \(!registeredProject\) return state;/, 'Unknown or forged project objects must fail closed before progress mutation.');
expect(/completedProjectSteps\(registeredProject, previousProgress\)/, 'Previous rewarded steps must use the canonical project definition.');
expect(/completedProjectSteps\(registeredProject, nextProgress\)/, 'New rewarded steps must use the canonical project definition.');
expect(/Math\.floor\(\(safePercent\(progress\) \/ 100\) \* total\)/, 'Project milestones must reward only fully crossed step boundaries.');
expect(/Math\.max\(previousProgress,\s*safePercent\(requestedProgress\)\)/, 'Project progress must remain monotonic.');
expect(/newlyCompletedSteps\s*=\s*Math\.max\(0,\s*nextSteps\s*-\s*previousSteps\)/, 'Project rewards must be derived from newly completed construction steps.');
expect(/PROJECT_STEP_REWARD\.xp\s*\*\s*newlyCompletedSteps/, 'XP must scale with newly crossed project steps, not button presses.');
expect(/PROJECT_STEP_REWARD\.nexCoins\s*\*\s*newlyCompletedSteps/, 'NexCoins must scale with newly crossed project steps.');
expect(/const PORTFOLIO_PASS_SCORE\s*=\s*70/, 'Portfolio rewards must preserve the project review passing threshold.');
expect(/const MAX_FUTURE_PROOF_SKEW_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/, 'Project reward timestamps need a small bounded clock-skew tolerance.');
expect(/function validRewardTime\(value:\s*Date,\s*systemNow\s*=\s*new Date\(\)\):\s*Date/, 'Project rewards must sanitize their canonical reward clock against the actual system clock.');
expect(/value\.getTime\(\)\s*<=\s*trustedSystemNow\.getTime\(\)\s*\+\s*MAX_FUTURE_PROOF_SKEW_MS[\s\S]*\?\s*value[\s\S]*:\s*trustedSystemNow/, 'A caller-supplied future clock must not expand project reward or portfolio proof windows.');
expect(/if \(newlyCompletedSteps === 0\) return progressed;\s*const rewardTime = validRewardTime\(now\);\s*return rewardProgress\(progressed, \{[\s\S]*?now:\s*rewardTime,[\s\S]*?\}\);/, 'Project step XP, NexCoins and streak accounting must use the trusted reward clock.');
expect(/function isRewardablePortfolioProof\(proof:\s*PortfolioProof,\s*project:\s*GuidedProject,\s*now:\s*Date\):\s*boolean/, 'Portfolio rewards must validate evidence against its canonical project.');
expect(/defaultProjectRubric\(project\)\.map\(\(item\)\s*=>\s*item\.id\)/, 'Portfolio rubric ids must come from the canonical project rubric.');
expect(/const review = reviewProject\(project, rubricIds\);/, 'Portfolio score must be recomputed from canonical review logic.');
expect(/projectId\s*===\s*project\.id/, 'Portfolio evidence must be bound to the canonical project id.');
expect(/title\s*===\s*project\.title\.trim\(\)/, 'Portfolio evidence title must match canonical project metadata.');
expect(/review\.passed/, 'Portfolio evidence must pass canonical review rules.');
expect(/proof\.score\s*===\s*review\.score/, 'Client supplied portfolio score must match canonical review score.');
expect(/rubricIds\.every\(\(id\)\s*=>\s*allowedRubricIds\.has\(id\)\)/, 'Unknown rubric ids must not enter the portfolio reward path.');
expect(/proof\.score\s*>=\s*PORTFOLIO_PASS_SCORE/, 'A failing portfolio score must never receive a completion reward.');
expect(/proof\.score\s*<=\s*100/, 'Portfolio proof scores must stay within the valid percentage range.');
expect(/Date\.parse\(proof\.completedAt\)/, 'Portfolio proof completion dates must be runtime validated.');
expect(/completedAt\s*<=\s*now\.getTime\(\)\s*\+\s*MAX_FUTURE_PROOF_SKEW_MS/, 'Future-dated portfolio evidence must not mint rewards outside the bounded clock-skew window.');
expect(/rubricIds\.length\s*>\s*0/, 'Portfolio proof rewards require rubric evidence.');
expect(/uniqueRubricIds\.size\s*===\s*rubricIds\.length/, 'Duplicate rubric evidence must not pass proof validation.');
expect(/const project = canonicalProject\(proof\?\.projectId\);[\s\S]*if \(!project \|\| !isRewardablePortfolioProof\(proof, project, rewardTime\)\) return state;/, 'Unknown projects and malformed canonical evidence must be rejected before persistence or reward.');
expect(/findIndex\(\(item\)\s*=>\s*item\.projectId\s*===\s*project\.id\)/, 'Portfolio proofs must detect an existing canonical project proof before rewarding.');
expect(/if \(existingIndex\s*>=\s*0\)[\s\S]*?portfolioProofs:\s*state\.portfolioProofs\.map/, 'Existing portfolio proofs must be replaceable without granting another reward.');
expect(/index\s*===\s*existingIndex\s*\?\s*proof\s*:\s*item/, 'A proof update must replace only the matching project evidence.');
expect(/safePercent\(state\.projectProgress\[project\.id\]\)\s*<\s*100/, 'A first portfolio reward must require canonical 100% project completion evidence.');
expect(/const rewarded = rewardProgress\(state, \{ \.\.\.PORTFOLIO_PROOF_REWARD, now: rewardTime \}\);/, 'Only a first valid proof for a completed canonical project may enter the reward path.');
expect(/portfolioProofs:\s*\[\.\.\.rewarded\.portfolioProofs,\s*proof\]/, 'A first valid portfolio proof must be persisted after rewarding.');

const completedStepsBody = source.match(/function completedProjectSteps\([\s\S]*?\n\}/)?.[0] ?? '';
if (!completedStepsBody) {
  throw new Error('Could not isolate completedProjectSteps reward math.');
}
if (/Math\.round\(\(safePercent\(progress\)/.test(completedStepsBody)) {
  throw new Error('Project milestone accounting must never round partial steps up into rewards.');
}

if (/completedProjectSteps\(project,/.test(source)) {
  throw new Error('Reward math must never trust the caller supplied project shape once canonical lookup exists.');
}
if (/requestedProgress\s*>\s*\(state\.projectProgress/.test(source)) {
  throw new Error('Do not reward raw progress increases without monotonic step accounting.');
}

const progressRewardSection = source.match(/if \(newlyCompletedSteps === 0\) return progressed;([\s\S]*?)\n\}/)?.[1] ?? '';
if (!progressRewardSection) {
  throw new Error('Could not isolate project step reward boundary.');
}
if (/\bnow,/.test(progressRewardSection)) {
  throw new Error('Project step rewards must never pass the caller clock directly into rewardProgress.');
}

const existingProofBranch = source.match(/if \(existingIndex\s*>=\s*0\)\s*\{([\s\S]*?)\n\s*\}\n\n\s*\/\/ A passing rubric/)?.[1];
if (!existingProofBranch) {
  throw new Error('Could not isolate the existing-proof update branch from the first-proof completion gate.');
}
if (/rewardProgress\s*\(/.test(existingProofBranch)) {
  throw new Error('Updating an existing portfolio proof must never mint XP or NexCoins.');
}

const canonicalGateIndex = source.indexOf('const project = canonicalProject(proof?.projectId);');
const validationGateIndex = source.indexOf('if (!project || !isRewardablePortfolioProof(proof, project, rewardTime)) return state;');
const completionGateIndex = source.indexOf('if (safePercent(state.projectProgress[project.id]) < 100) return state;');
const firstRewardIndex = source.indexOf('const rewarded = rewardProgress(state, { ...PORTFOLIO_PROOF_REWARD, now: rewardTime });');
if (canonicalGateIndex < 0 || validationGateIndex < 0 || completionGateIndex < 0 || firstRewardIndex < 0 || canonicalGateIndex > validationGateIndex || validationGateIndex > completionGateIndex || completionGateIndex > firstRewardIndex) {
  throw new Error('Canonical lookup, evidence validation and project completion must all execute before the one-time reward path.');
}

console.log('Project progression reward audit passed.');

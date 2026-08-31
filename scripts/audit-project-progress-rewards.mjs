import fs from 'node:fs';

const enginePath = new URL('../src/learning/projectProgressEngine.ts', import.meta.url);
const source = fs.readFileSync(enginePath, 'utf8');

function expect(pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

expect(/Math\.max\(previousProgress,\s*safePercent\(requestedProgress\)\)/, 'Project progress must remain monotonic.');
expect(/newlyCompletedSteps\s*=\s*Math\.max\(0,\s*nextSteps\s*-\s*previousSteps\)/, 'Project rewards must be derived from newly completed construction steps.');
expect(/PROJECT_STEP_REWARD\.xp\s*\*\s*newlyCompletedSteps/, 'XP must scale with newly crossed project steps, not button presses.');
expect(/PROJECT_STEP_REWARD\.nexCoins\s*\*\s*newlyCompletedSteps/, 'NexCoins must scale with newly crossed project steps.');
expect(/const PORTFOLIO_PASS_SCORE\s*=\s*70/, 'Portfolio rewards must preserve the project review passing threshold.');
expect(/const MAX_FUTURE_PROOF_SKEW_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/, 'Portfolio evidence timestamps need a small bounded clock-skew tolerance.');
expect(/function validRewardTime\(value:\s*Date\):\s*Date/, 'Portfolio rewards must sanitize their canonical reward clock.');
expect(/function isRewardablePortfolioProof\(proof:\s*PortfolioProof,\s*now:\s*Date\):\s*boolean/, 'Portfolio rewards must validate proof structure and timing at the canonical progression boundary.');
expect(/proof\.score\s*>=\s*PORTFOLIO_PASS_SCORE/, 'A failing portfolio score must never receive a completion reward.');
expect(/proof\.score\s*<=\s*100/, 'Portfolio proof scores must stay within the valid percentage range.');
expect(/Date\.parse\(proof\.completedAt\)/, 'Portfolio proof completion dates must be runtime validated.');
expect(/completedAt\s*<=\s*now\.getTime\(\)\s*\+\s*MAX_FUTURE_PROOF_SKEW_MS/, 'Future-dated portfolio evidence must not mint rewards outside the bounded clock-skew window.');
expect(/rubricIds\.length\s*>\s*0/, 'Portfolio proof rewards require rubric evidence.');
expect(/uniqueRubricIds\.size\s*===\s*rubricIds\.length/, 'Duplicate rubric evidence must not pass proof validation.');
expect(/const rewardTime = validRewardTime\(now\);[\s\S]*if \(!isRewardablePortfolioProof\(proof, rewardTime\)\) return state;/, 'Malformed or future-dated portfolio evidence must be rejected before persistence or reward.');
expect(/findIndex\(\(item\)\s*=>\s*item\.projectId\s*===\s*proof\.projectId\)/, 'Portfolio proofs must detect an existing project proof before rewarding.');
expect(/if \(existingIndex\s*>=\s*0\)[\s\S]*?portfolioProofs:\s*state\.portfolioProofs\.map/, 'Existing portfolio proofs must be replaceable without granting another reward.');
expect(/index\s*===\s*existingIndex\s*\?\s*proof\s*:\s*item/, 'A proof update must replace only the matching project evidence.');
expect(/safePercent\(state\.projectProgress\[proof\.projectId\]\)\s*<\s*100/, 'A first portfolio reward must require canonical 100% project completion evidence.');
expect(/const rewarded = rewardProgress\(state, \{ \.\.\.PORTFOLIO_PROOF_REWARD, now: rewardTime \}\);/, 'Only a first valid proof for a completed project may enter the reward path.');
expect(/portfolioProofs:\s*\[\.\.\.rewarded\.portfolioProofs,\s*proof\]/, 'A first valid portfolio proof must be persisted after rewarding.');

if (/requestedProgress\s*>\s*\(state\.projectProgress/.test(source)) {
  throw new Error('Do not reward raw progress increases without monotonic step accounting.');
}

const existingProofBranch = source.match(/if \(existingIndex\s*>=\s*0\)\s*\{([\s\S]*?)\n\s*\}\n\n\s*\/\/ A passing rubric/)?.[1];
if (!existingProofBranch) {
  throw new Error('Could not isolate the existing-proof update branch from the first-proof completion gate.');
}
if (/rewardProgress\s*\(/.test(existingProofBranch)) {
  throw new Error('Updating an existing portfolio proof must never mint XP or NexCoins.');
}

const validationGateIndex = source.indexOf('if (!isRewardablePortfolioProof(proof, rewardTime)) return state;');
const completionGateIndex = source.indexOf('if (safePercent(state.projectProgress[proof.projectId]) < 100) return state;');
const firstRewardIndex = source.indexOf('const rewarded = rewardProgress(state, { ...PORTFOLIO_PROOF_REWARD, now: rewardTime });');
if (validationGateIndex < 0 || completionGateIndex < 0 || firstRewardIndex < 0 || validationGateIndex > completionGateIndex || completionGateIndex > firstRewardIndex) {
  throw new Error('Portfolio validation and project-completion evidence must both execute before the one-time reward path.');
}

console.log('Project progression reward audit passed.');

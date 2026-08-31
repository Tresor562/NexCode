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
expect(/findIndex\(\(item\)\s*=>\s*item\.projectId\s*===\s*proof\.projectId\)/, 'Portfolio proofs must detect an existing project proof before rewarding.');
expect(/if \(existingIndex\s*>=\s*0\)[\s\S]*?portfolioProofs:\s*state\.portfolioProofs\.map/, 'Existing portfolio proofs must be replaceable without granting another reward.');
expect(/index\s*===\s*existingIndex\s*\?\s*proof\s*:\s*item/, 'A proof update must replace only the matching project evidence.');
expect(/const rewarded = rewardProgress\(state, \{ \.\.\.PORTFOLIO_PROOF_REWARD, now \}\);/, 'Only a first portfolio proof may enter the reward path.');
expect(/portfolioProofs:\s*\[\.\.\.rewarded\.portfolioProofs,\s*proof\]/, 'A first valid portfolio proof must be persisted after rewarding.');

if (/requestedProgress\s*>\s*\(state\.projectProgress/.test(source)) {
  throw new Error('Do not reward raw progress increases without monotonic step accounting.');
}

const existingProofBranch = source.match(/if \(existingIndex\s*>=\s*0\)\s*\{([\s\S]*?)\n\s*\}\n\n\s*const rewarded = rewardProgress/)?.[1];
if (!existingProofBranch) {
  throw new Error('Could not isolate the existing-proof update branch from the first-proof reward branch.');
}
if (/rewardProgress\s*\(/.test(existingProofBranch)) {
  throw new Error('Updating an existing portfolio proof must never mint XP or NexCoins.');
}

console.log('Project progression reward audit passed.');

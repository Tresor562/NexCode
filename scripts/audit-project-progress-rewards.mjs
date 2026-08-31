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
expect(/portfolioProofs\.some\(\(item\)\s*=>\s*item\.projectId\s*===\s*proof\.projectId\)/, 'Portfolio proof rewards must be idempotent per project.');
expect(/if \(state\.portfolioProofs\.some[\s\S]*?\)\) return state;/, 'Duplicate portfolio proofs must return without granting a reward.');
expect(/portfolioProofs:\s*\[\.\.\.rewarded\.portfolioProofs,\s*proof\]/, 'A first valid portfolio proof must be persisted after rewarding.');

if (/requestedProgress\s*>\s*\(state\.projectProgress/.test(source)) {
  throw new Error('Do not reward raw progress increases without monotonic step accounting.');
}

console.log('Project progression reward audit passed.');

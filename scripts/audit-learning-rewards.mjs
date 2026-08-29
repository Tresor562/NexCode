import fs from 'node:fs';
import assert from 'node:assert/strict';

const sourceUrl = new URL('../src/learning/sessionEngine.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const localStateUrl = new URL('../src/lib/localState.ts', import.meta.url);
const localStateSource = fs.readFileSync(localStateUrl, 'utf8');

assert.match(source, /Readonly<Record<ActivityKind, Readonly<Omit<LearningCompletionReward, 'minutes'>>>>/, 'reward definitions must be exhaustively typed by ActivityKind');
assert.match(source, /learn: \{ xp: 12, nexCoins: 2 \}/, 'learn reward must remain intentionally modest');
assert.match(source, /practice: \{ xp: 14, nexCoins: 3 \}/, 'practice reward must exceed passive learning');
assert.match(source, /lab: \{ xp: 25, nexCoins: 5 \}/, 'lab reward must recognize applied work');
assert.match(source, /checkpoint: \{ xp: 30, nexCoins: 6 \}/, 'checkpoint reward must recognize mastery evidence');
assert.match(source, /project: \{ xp: 40, nexCoins: 8 \}/, 'project reward must recognize authentic production');
assert.match(source, /boss: \{ xp: 45, nexCoins: 9 \}/, 'boss reward must remain the highest completion reward');
assert.match(source, /if \(!Number\.isFinite\(durationMin\)\) return 1;/, 'invalid lesson duration must never poison progress totals');
assert.match(source, /Math\.max\(1, Math\.min\(15, Math\.round\(durationMin\)\)\)/, 'credited learning minutes must remain bounded');
assert.match(source, /if \(!Number\.isInteger\(selectedIndex\)\) return null;/, 'non-integer lesson answer indices must be treated as no-answer');
assert.match(source, /selectedIndex as number\) < 0 \|\| \(selectedIndex as number\) >= lesson\.choices\.length/, 'out-of-range lesson answer indices must be rejected before mastery evidence is recorded');
assert.match(source, /const answerIndex = normalizeSelectedIndex\(lesson, selectedIndex\);/, 'lesson answer recording must normalize the UI selection first');
assert.match(source, /const correct = answerIndex !== null && answerIndex === lesson\.correctIndex;/, 'only a valid normalized choice may be considered correct');
assert.match(source, /inferErrorTag\(lesson, answerIndex\)/, 'error evidence must use the normalized answer index');
assert.match(source, /if \(state\.completedLessons\.includes\(lesson\.id\)\) return state;/, 'lesson completion rewards must be idempotent');
assert.match(source, /rewardProgress\(state, \{ \.\.\.reward, now \}\)/, 'learning completion must pass through the shared streak/daily-goal reward engine');
assert.match(source, /completedLessons: \[\.\.\.rewarded\.completedLessons, lesson\.id\]/, 'rewarded lessons must be persisted as completed atomically with the reward state');

assert.match(localStateSource, /requestedNow instanceof Date && Number\.isFinite\(requestedNow\.getTime\(\)\)/, 'invalid reward timestamps must fall back before streak dates are computed');
assert.match(localStateSource, /const minutes = finiteNumber\(reward\.minutes, 0, 0, 240\);/, 'reward minutes must reject NaN or Infinity and remain bounded per activity');
assert.match(localStateSource, /const xp = finiteInteger\(reward\.xp, 0, 0, 1_000_000\);/, 'XP rewards must be finite non-negative integers with a corruption ceiling');
assert.match(localStateSource, /const nexCoins = finiteInteger\(reward\.nexCoins, 0, 0, 1_000_000\);/, 'NexCoin rewards must be finite non-negative integers with a corruption ceiling');
assert.match(localStateSource, /xp: active\.xp \+ xp \+ \(shouldGrantGoalBonus \? 40 : 0\)/, 'progression totals must use normalized XP rather than raw reward input');
assert.match(localStateSource, /nexCoins: active\.nexCoins \+ nexCoins \+ \(shouldGrantGoalBonus \? 20 : 0\)/, 'wallet totals must use normalized NexCoins rather than raw reward input');
assert.doesNotMatch(localStateSource, /Math\.max\(0, reward\.(?:xp|nexCoins|minutes) \?\? 0\)/, 'raw Math.max sanitization must not reintroduce NaN poisoning');

console.log('Learning rewards audit OK: reward balance, bounded minutes, safe answer indices, finite economy inputs and idempotent completion are enforced.');

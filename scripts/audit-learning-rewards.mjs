import fs from 'node:fs';
import assert from 'node:assert/strict';

const sourceUrl = new URL('../src/learning/sessionEngine.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');

assert.match(source, /Readonly<Record<ActivityKind, Readonly<Omit<LearningCompletionReward, 'minutes'>>>>/, 'reward definitions must be exhaustively typed by ActivityKind');
assert.match(source, /learn: \{ xp: 12, nexCoins: 2 \}/, 'learn reward must remain intentionally modest');
assert.match(source, /practice: \{ xp: 14, nexCoins: 3 \}/, 'practice reward must exceed passive learning');
assert.match(source, /lab: \{ xp: 25, nexCoins: 5 \}/, 'lab reward must recognize applied work');
assert.match(source, /checkpoint: \{ xp: 30, nexCoins: 6 \}/, 'checkpoint reward must recognize mastery evidence');
assert.match(source, /project: \{ xp: 40, nexCoins: 8 \}/, 'project reward must recognize authentic production');
assert.match(source, /boss: \{ xp: 45, nexCoins: 9 \}/, 'boss reward must remain the highest completion reward');
assert.match(source, /if \(!Number\.isFinite\(durationMin\)\) return 1;/, 'invalid lesson duration must never poison progress totals');
assert.match(source, /Math\.max\(1, Math\.min\(15, Math\.round\(durationMin\)\)\)/, 'credited learning minutes must remain bounded');
assert.match(source, /if \(state\.completedLessons\.includes\(lesson\.id\)\) return state;/, 'lesson completion rewards must be idempotent');
assert.match(source, /rewardProgress\(state, \{ \.\.\.reward, now \}\)/, 'learning completion must pass through the shared streak/daily-goal reward engine');
assert.match(source, /completedLessons: \[\.\.\.rewarded\.completedLessons, lesson\.id\]/, 'rewarded lessons must be persisted as completed atomically with the reward state');

console.log('Learning rewards audit OK: typed reward balance, finite bounded minutes and idempotent completion are enforced.');

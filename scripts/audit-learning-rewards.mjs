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
assert.match(source, /function hasLatestCorrectLessonEvidence\(state: LocalState, lesson: Lesson\): boolean/, 'completion rewards must use a dedicated latest-correct-evidence gate');
assert.match(source, /if \(skillIds\.length === 0\) return false;/, 'lessons without skill evidence must not be rewardable through the completion boundary');
assert.match(source, /return skillIds\.every\(\(skillId\) => \{/, 'every declared lesson skill must carry matching completion evidence');
assert.match(source, /for \(let index = evidence\.length - 1; index >= 0; index -= 1\)/, 'completion evidence must be resolved from newest to oldest');
assert.match(source, /if \(attempt\?\.lessonId !== lesson\.id\) continue;/, 'completion evidence must belong to the exact lesson');
assert.match(source, /return attempt\.correct === true;/, 'the latest matching lesson evidence must be correct');
assert.match(source, /if \(state\.completedLessons\.includes\(lesson\.id\)\) return state;/, 'lesson completion rewards must be idempotent');
assert.match(source, /if \(safeAttemptCount\(state\.lessonAttempts\[lesson\.id\]\) < 1\) return state;/, 'lesson completion rewards must require a recorded attempt');
assert.match(source, /if \(!hasLatestCorrectLessonEvidence\(state, lesson\)\) return state;/, 'a failed retry after an older success must not unlock completion XP or NexCoins');
assert.match(source, /rewardProgress\(state, \{ \.\.\.reward, now \}\)/, 'learning completion must pass through the shared streak/daily-goal reward engine');
assert.match(source, /completedLessons: \[\.\.\.rewarded\.completedLessons, lesson\.id\]/, 'rewarded lessons must be persisted as completed atomically with the reward state');

const completionFunction = source.slice(source.indexOf('export function rewardLearningCompletion'), source.indexOf('export function recordLessonOutcome'));
assert.ok(completionFunction.indexOf('completedLessons.includes(lesson.id)') < completionFunction.indexOf('safeAttemptCount(state.lessonAttempts[lesson.id])'), 'idempotence must be checked before attempt evidence to keep replays side-effect free');
assert.ok(completionFunction.indexOf('safeAttemptCount(state.lessonAttempts[lesson.id])') < completionFunction.indexOf('hasLatestCorrectLessonEvidence(state, lesson)'), 'attempt existence must be checked before scanning latest mastery evidence');
assert.ok(completionFunction.indexOf('hasLatestCorrectLessonEvidence(state, lesson)') < completionFunction.indexOf('rewardProgress(state'), 'latest correct lesson evidence must be verified before any XP, NexCoin, streak or minute mutation');

assert.match(localStateSource, /requestedNow instanceof Date && Number\.isFinite\(requestedNow\.getTime\(\)\)/, 'invalid reward timestamps must fall back before streak dates are computed');
assert.match(localStateSource, /const minutes = finiteNumber\(reward\.minutes, 0, 0, 240\);/, 'reward minutes must reject NaN or Infinity and remain bounded per activity');
assert.match(localStateSource, /const xp = finiteInteger\(reward\.xp, 0, 0, 1_000_000\);/, 'XP rewards must be finite non-negative integers with a corruption ceiling');
assert.match(localStateSource, /const nexCoins = finiteInteger\(reward\.nexCoins, 0, 0, 1_000_000\);/, 'NexCoin rewards must be finite non-negative integers with a corruption ceiling');
assert.match(localStateSource, /function safeProgressTotal\(current: unknown, increment: number\): number/, 'cumulative progression must use a shared safe-total helper');
assert.match(localStateSource, /Math\.min\(Number\.MAX_SAFE_INTEGER, normalizedCurrent \+ normalizedIncrement\)/, 'cumulative progression must saturate before exceeding safe integer precision');
assert.match(localStateSource, /const dailyGoal = finiteInteger\(active\.dailyGoal, initialState\.dailyGoal, 5, 240\);/, 'runtime daily-goal state must be normalized before reward calculations');
assert.match(localStateSource, /const currentDailyCompleted = finiteNumber\(active\.dailyCompleted, 0, 0, dailyGoal\);/, 'runtime daily progress must be normalized before adding learning minutes');
assert.match(localStateSource, /xp: safeProgressTotal\(active\.xp, xpAward\)/, 'XP totals must use saturating safe addition');
assert.match(localStateSource, /nexCoins: safeProgressTotal\(active\.nexCoins, nexCoinAward\)/, 'NexCoin totals must use saturating safe addition');
assert.match(localStateSource, /totalLearningMinutes: safeProgressTotal\(active\.totalLearningMinutes, minutes\)/, 'learning-minute totals must use saturating safe addition');
assert.doesNotMatch(localStateSource, /xp: active\.xp \+ xp/, 'raw cumulative XP addition must not bypass safe integer bounds');
assert.doesNotMatch(localStateSource, /nexCoins: active\.nexCoins \+ nexCoins/, 'raw cumulative NexCoin addition must not bypass safe integer bounds');
assert.doesNotMatch(localStateSource, /Math\.max\(0, reward\.(?:xp|nexCoins|minutes) \?\? 0\)/, 'raw Math.max sanitization must not reintroduce NaN poisoning');

console.log('Learning rewards audit OK: reward balance, bounded minutes, safe answer indices, latest-correct-evidence completion, saturating progression totals and idempotence are enforced.');

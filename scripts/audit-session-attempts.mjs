import fs from 'node:fs';
import assert from 'node:assert/strict';

const sourceUrl = new URL('../src/learning/sessionEngine.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');

assert.match(source, /function safeAttemptCount\(value: unknown\): number/, 'session engine must normalize persisted attempt counters');
assert.match(source, /typeof value !== 'number' \|\| !Number\.isFinite\(value\)/, 'non-finite attempt counters must fall back safely');
assert.match(source, /Math\.max\(0, Math\.min\(10_000, Math\.floor\(value\)\)\)/, 'attempt counters must be finite, integer, non-negative and bounded');
assert.match(source, /safeAttemptCount\(state\.lessonAttempts\[lesson\.id\]\) \+ 1/, 'new attempts must build from the sanitized persisted counter');
assert.match(source, /Math\.min\(10_000, safeAttemptCount\(state\.lessonAttempts\[lesson\.id\]\) \+ 1\)/, 'incrementing a saturated counter must stay bounded');
assert.doesNotMatch(source, /\(state\.lessonAttempts\[lesson\.id\] \?\? 0\) \+ 1/, 'raw persisted attempt counters must not flow directly into pedagogy gating');
assert.match(source, /export function recordLessonOutcome\(/, 'attempt recording must have a reward-free outcome path shared by UI and indexed answers');
assert.match(source, /return recordLessonOutcome\(state, lesson, correct, errorTag, now\);/, 'indexed answers must delegate to the shared attempt outcome path');

const attemptStart = source.indexOf('export function recordLessonOutcome(');
const answerStart = source.indexOf('export function recordLessonAnswer(');
assert.ok(attemptStart >= 0 && answerStart > attemptStart, 'attempt outcome section must be discoverable');
const attemptSection = source.slice(attemptStart, answerStart);
assert.doesNotMatch(attemptSection, /rewardProgress\(/, 'answer attempts must never mint XP, NexCoins, streak progress or learning minutes');
assert.doesNotMatch(attemptSection, /completedLessons:/, 'answer attempts must not mark lessons complete before the completion boundary');
assert.match(attemptSection, /const attemptTime = trustedCompletionTime\(now\);/, 'lesson evidence must clamp caller time before mastery recording');
assert.match(attemptSection, /recordSkillAttempt\(state\.mastery, lesson, correct, attemptTime, normalizedErrorTag\)/, 'mastery evidence must receive the trusted attempt clock');
assert.doesNotMatch(attemptSection, /recordSkillAttempt\(state\.mastery, lesson, correct, now, normalizedErrorTag\)/, 'raw caller time must never reach mastery evidence recording');

const rewardStart = source.indexOf('export function rewardLearningCompletion(');
assert.ok(rewardStart >= 0 && rewardStart < attemptStart, 'completion reward boundary must remain separate from attempt recording');
const rewardSection = source.slice(rewardStart, attemptStart);
assert.match(rewardSection, /state\.completedLessons\.includes\(lesson\.id\)/, 'completion rewards must remain idempotent by lesson id');
assert.match(rewardSection, /const rewardTime = trustedCompletionTime\(now\);/, 'completion rewards must bind caller time to the trusted reward clock before evidence checks');
assert.match(rewardSection, /rewardProgress\(state, \{ \.\.\.reward, now: rewardTime \}\)/, 'only the completion boundary should mint the learning reward through the trusted clock');
assert.doesNotMatch(rewardSection, /rewardProgress\(state, \{ \.\.\.reward, now \}\)/, 'raw caller time must never reach the progression reward boundary');

console.log('Session attempt audit OK: attempts are bounded and reward-free, while mastery evidence and completion rewards share the trusted clock boundary.');

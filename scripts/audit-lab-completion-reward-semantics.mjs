import fs from 'node:fs';
import assert from 'node:assert/strict';

const sourceUrl = new URL('../src/ui/NexCodeApp.tsx', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');

const start = source.indexOf('function completeLab(draft: LabDraft)');
const end = source.indexOf('function toggleChapterOffline', start);
assert.ok(start >= 0 && end > start, 'completeLab must remain present and auditable');
const completeLab = source.slice(start, end);

assert.match(completeLab, /const completed = labLesson;/, 'Lab completion must preserve the original lesson identity and activity kind');
assert.match(completeLab, /rewardLearningCompletion\(current, completed\)/, 'Lab completion must reward the original lesson through the shared completion gate');
assert.match(completeLab, /labDrafts: \{ \.\.\.rewarded\.labDrafts, \[completed\.id\]: draft \}/, 'validated Lab work must still be persisted atomically with completion');
assert.match(completeLab, /setActiveLesson\(completed\); setLabLesson\(null\);/, 'returning from the Lab must keep the original lesson semantics in the active flow');
assert.doesNotMatch(completeLab, /activityKind:\s*'lab'/, 'normal learn/practice/review lessons must never be rewritten into Lab activities to inflate rewards');
assert.doesNotMatch(completeLab, /recordLessonOutcome\(/, 'successful Lab validation must not create a duplicate mastery attempt after the quiz already recorded evidence');

console.log('Lab completion reward semantics audit OK: original activity kind, single mastery evidence and authentic XP/NexCoin rewards are preserved.');

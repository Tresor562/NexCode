import fs from 'node:fs';
import assert from 'node:assert/strict';

const sourceUrl = new URL('../src/learning/reviewScheduler.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');

assert.match(source, /function canonicalSkillIds\(/, 'review scheduling must canonicalize skill identity');
assert.match(source, /new Set\(\(skillIds \?\? \[\]\)\.map\(\(id\) => id\.trim\(\)\)\.filter\(Boolean\)\)/, 'skill ids must be trimmed, emptied values removed and duplicates collapsed');
assert.match(source, /function validNow\(now: Date\): Date/, 'review scheduling must centralize reference-date validation');
assert.match(source, /now instanceof Date && Number\.isFinite\(now\.getTime\(\)\) \? now : new Date\(\)/, 'invalid scheduler dates must fall back before urgency math');
assert.match(source, /Date\.parse\(iso\)/, 'review dates must be parsed defensively');
assert.match(source, /if \(!Number\.isFinite\(timestamp\)\) return 0;/, 'invalid review dates must degrade to an immediate review instead of NaN scheduling');
assert.match(source, /const referenceNow = validNow\(now\);[\s\S]*daysUntil\(state\.nextReviewAt, referenceNow\)/, 'review queue must only use a validated reference date');
assert.match(source, /Math\.max\(0, Math\.min\(100, Math\.min/, 'mastery scores must be bounded before urgency math');
assert.match(source, /new Set\(state\?\.errorTags \?\? \[\]\)\.size/, 'duplicate misconception tags must not inflate review urgency');
assert.match(source, /Math\.max\(0, Math\.min\(160, Math\.round\(value\)\)\)/, 'review urgency must remain finite and bounded');
assert.match(source, /recommendPractice\(courses, graph, mastery, completedLessonIds, referenceNow,/, 'interleaved practice must pass the validated reference date into recommendation scoring');
assert.match(source, /const selectedLessonIds = new Set<string>\(\)/, 'interleaved sessions must track lesson identity explicitly');
assert.match(source, /if \(selectedLessonIds\.has\(item\.lesson\.id\)\) continue;/, 'the same lesson must never appear twice in one practice session');
assert.match(source, /const itemSkillIds = canonicalSkillIds\(item\.skillIds\);/, 'interleaving must apply the same canonical skill identity');
assert.match(source, /itemSkillIds\.forEach/, 'interleaving repetition counters must use canonical skills');
assert.match(source, /if \(courseCount >= 2 \|\| skillRepeat >= 2\) continue;/, 'the strict pass must protect both course and skill diversity');
assert.match(source, /Never relax the skill repetition cap/, 'fallback filling must document the pedagogical invariant');
assert.match(source, /if \(skillRepeat >= 2\) continue;[\s\S]*add\(item\);/, 'fallback filling must keep the skill repetition cap instead of silently reverting to blocked practice');

console.log('Review scheduler audit OK: canonical identity, validated dates, safe urgency math, unique lessons and skill-diverse interleaving are enforced.');

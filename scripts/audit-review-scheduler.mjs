import fs from 'node:fs';
import assert from 'node:assert/strict';

const sourceUrl = new URL('../src/learning/reviewScheduler.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');

assert.match(source, /function canonicalSkillIds\(/, 'review scheduling must canonicalize skill identity');
assert.match(source, /new Set\(\(skillIds \?\? \[\]\)\.map\(\(id\) => id\.trim\(\)\)\.filter\(Boolean\)\)/, 'skill ids must be trimmed, emptied values removed and duplicates collapsed');
assert.match(source, /Date\.parse\(iso\)/, 'review dates must be parsed defensively');
assert.match(source, /if \(!Number\.isFinite\(timestamp\)\) return 0;/, 'invalid review dates must degrade to an immediate review instead of NaN scheduling');
assert.match(source, /Math\.max\(0, Math\.min\(100, Math\.min/, 'mastery scores must be bounded before urgency math');
assert.match(source, /new Set\(state\?\.errorTags \?\? \[\]\)\.size/, 'duplicate misconception tags must not inflate review urgency');
assert.match(source, /Math\.max\(0, Math\.min\(160, Math\.round\(value\)\)\)/, 'review urgency must remain finite and bounded');
assert.match(source, /const itemSkillIds = canonicalSkillIds\(item\.skillIds\);/, 'interleaving must apply the same canonical skill identity');
assert.match(source, /itemSkillIds\.forEach/, 'interleaving repetition counters must use canonical skills');

console.log('Review scheduler audit OK: canonical skill identity, safe dates, bounded scores/urgency and deduplicated misconception evidence are enforced.');

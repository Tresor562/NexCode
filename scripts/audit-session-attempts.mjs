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

console.log('Session attempt audit OK: persisted lesson attempt counters are finite, bounded and safe for Lab gating.');

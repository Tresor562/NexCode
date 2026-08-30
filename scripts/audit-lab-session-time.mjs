import fs from 'node:fs';
import assert from 'node:assert/strict';

const sourceUrl = new URL('../src/learning/labSession.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');

assert.match(source, /function safeSessionDate\(value: Date\)/, 'Lab sessions must centralize timestamp validation');
assert.match(source, /Number\.isFinite\(value\.getTime\(\)\) \? value : new Date\(\)/, 'invalid Lab dates must fall back before serialization');
assert.match(source, /const sessionDate = safeSessionDate\(now\);/, 'Lab session creation must sanitize its reference date');
assert.match(source, /id: `\$\{courseId\}:\$\{lesson\.id\}:\$\{sessionDate\.getTime\(\)\}`/, 'Lab session ids must use the sanitized timestamp');
assert.match(source, /openedAt: sessionDate\.toISOString\(\)/, 'Lab opening timestamps must be serialized from a valid date');
assert.match(source, /const savedAt = safeSessionDate\(now\)\.toISOString\(\);/, 'Lab autosave must sanitize dates before ISO serialization');
assert.match(source, /updatedAt: savedAt/, 'Lab draft timestamps must share the canonical autosave timestamp');
assert.match(source, /lastAutosaveAt: savedAt/, 'Lab session autosave metadata must share the canonical autosave timestamp');
assert.doesNotMatch(source, /openedAt: now\.toISOString\(\)/, 'Lab session creation must not serialize unchecked dates');
assert.doesNotMatch(source, /lastAutosaveAt: now\.toISOString\(\)/, 'Lab autosave must not serialize unchecked dates');

console.log('Lab session time audit OK: invalid dates cannot corrupt session ids, opening timestamps or autosave metadata.');

import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/learningFeedback.ts', import.meta.url), 'utf8');

const expectations = [
  ['dedicated notification timestamp', 'let sharedLastNotificationFeedbackAt: number | undefined;'],
  ['notification-only timestamp write', "if (kind === 'notification') sharedLastNotificationFeedbackAt = current;"],
  ['notification-based semantic candidate', 'if (sharedLastNotificationFeedbackAt !== undefined)'],
  ['notification rollback recovery', 'current < sharedLastNotificationFeedbackAt'],
  ['notification candidate delta', 'semanticCandidate = current - sharedLastNotificationFeedbackAt;'],
  ['semantic association window', 'semanticCandidate <= SEMANTIC_AUDIO_ASSOCIATION_WINDOW_MS'],
  ['semantic candidate classification', 'const isSemanticCandidate = semanticCandidate >= 0 && semanticCandidate <= SEMANTIC_AUDIO_ASSOCIATION_WINDOW_MS;'],
  ['sound cooldown bypass parameter', 'bypassOwnCooldown = false'],
  ['ordinary sound cooldown remains enforced', 'if (!bypassOwnCooldown && elapsed < FEEDBACK_COOLDOWN_MS[kind]) return false;'],
  ['semantic sound receives narrow cooldown priority', "canTrigger('sound', true, isSemanticCandidate)"],
  ['semantic protection uses the classified candidate', 'if (isSemanticCandidate) {'],
];

const missing = expectations.filter(([, marker]) => !source.includes(marker));
if (missing.length) {
  console.error('Semantic audio association audit failed:');
  for (const [label] of missing) console.error(`- missing ${label}`);
  process.exit(1);
}

if (/semanticCandidate\s*=\s*sharedLastStrongFeedbackAt/.test(source) || /sharedLastStrongFeedbackAt[^\n]*\?\s*current\s*-\s*sharedLastStrongFeedbackAt/.test(source)) {
  console.error('Semantic audio association audit failed: generic strong impacts must not identify semantic success/error audio.');
  process.exit(1);
}

if (/kind === 'notification' \|\| kind === 'impact'\) sharedLastNotificationFeedbackAt/.test(source)) {
  console.error('Semantic audio association audit failed: impact feedback must not stamp the semantic notification channel.');
  process.exit(1);
}

if (/canTrigger\('sound', true, true\)/.test(source)) {
  console.error('Semantic audio association audit failed: the sound cooldown must never be bypassed unconditionally.');
  process.exit(1);
}

if (/if \(!bypassOwnCooldown[^\n]+FEEDBACK_COOLDOWN_MS\[kind\][\s\S]{0,120}kind === 'selection'/.test(source)) {
  console.error('Semantic audio association audit failed: semantic priority must stay scoped to the sound channel rather than weakening tactile cooldowns.');
  process.exit(1);
}

console.log('Semantic audio association audit passed: success/error audio is tied only to notification haptics, can preempt a just-fired weak tap without weakening ordinary sound/tactile cooldowns, and keeps the semantic protection window after acceptance.');

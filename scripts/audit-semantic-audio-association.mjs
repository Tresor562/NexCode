import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/learningFeedback.ts', import.meta.url), 'utf8');

const expectations = [
  ['dedicated notification timestamp', 'let sharedLastNotificationFeedbackAt: number | undefined;'],
  ['notification-only timestamp write', "if (kind === 'notification') sharedLastNotificationFeedbackAt = current;"],
  ['notification-based semantic candidate', 'if (sharedLastNotificationFeedbackAt !== undefined)'],
  ['notification rollback recovery', 'current < sharedLastNotificationFeedbackAt'],
  ['notification candidate delta', 'semanticCandidate = current - sharedLastNotificationFeedbackAt;'],
  ['semantic association window', 'semanticCandidate <= SEMANTIC_AUDIO_ASSOCIATION_WINDOW_MS'],
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

console.log('Semantic audio association audit passed: success/error audio is associated only with notification haptics, while generic impacts keep their tactile cadence without hijacking the audio protection window.');

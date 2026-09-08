import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/learningFeedback.ts', import.meta.url), 'utf8');

const expectations = [
  ['dedicated notification timestamp', 'let sharedLastNotificationFeedbackAt: number | undefined;'],
  ['notification-only timestamp write', 'sharedLastNotificationFeedbackAt = current;'],
  ['notification opens same-turn association', 'openSemanticAudioAssociationWindow();'],
  ['microtask-scoped association flag', 'let sharedSemanticAudioAssociationOpen = false;'],
  ['association generation', 'let sharedSemanticAudioAssociationGeneration = 0;'],
  ['association microtask close', 'Promise.resolve().then(() => {'],
  ['generation-safe association close', 'if (sharedSemanticAudioAssociationGeneration === generation) {'],
  ['notification-based semantic candidate', 'if (sharedSemanticAudioAssociationOpen && sharedLastNotificationFeedbackAt !== undefined)'],
  ['notification rollback recovery', 'current < sharedLastNotificationFeedbackAt'],
  ['notification candidate delta', 'semanticCandidate = current - sharedLastNotificationFeedbackAt;'],
  ['semantic association window', 'semanticCandidate <= SEMANTIC_AUDIO_ASSOCIATION_WINDOW_MS'],
  ['semantic candidate classification', 'const isSemanticCandidate = semanticCandidate >= 0 && semanticCandidate <= SEMANTIC_AUDIO_ASSOCIATION_WINDOW_MS;'],
  ['sound cooldown bypass parameter', 'bypassOwnCooldown = false'],
  ['ordinary sound cooldown remains enforced', 'if (!bypassOwnCooldown && elapsed < FEEDBACK_COOLDOWN_MS[kind]) return false;'],
  ['semantic sound receives narrow cooldown priority', "canTrigger('sound', true, isSemanticCandidate)"],
  ['semantic protection uses the classified candidate', 'if (isSemanticCandidate) {'],
  ['semantic association consumed on acceptance', 'sharedSemanticAudioAssociationOpen = false;'],
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

if (/kind === 'notification' \|\| kind === 'impact'[^\n]*sharedLastNotificationFeedbackAt/.test(source)) {
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

if (!/kind === 'notification'\) \{[\s\S]{0,160}sharedLastNotificationFeedbackAt = current;[\s\S]{0,120}openSemanticAudioAssociationWindow\(\);/.test(source)) {
  console.error('Semantic audio association audit failed: only an accepted notification may open the semantic audio association turn.');
  process.exit(1);
}

if (!/openSemanticAudioAssociationWindow\(\)[\s\S]{0,700}Promise\.resolve\(\)\.then\(\(\) => \{[\s\S]{0,180}sharedSemanticAudioAssociationOpen = false;/.test(source)) {
  console.error('Semantic audio association audit failed: the semantic permit must expire before a later UI event can inherit notification priority.');
  process.exit(1);
}

if (!/sharedSemanticAudioAssociationOpen && sharedLastNotificationFeedbackAt !== undefined/.test(source)) {
  console.error('Semantic audio association audit failed: elapsed milliseconds alone must not classify an unrelated tap as semantic audio.');
  process.exit(1);
}

console.log('Semantic audio association audit passed: success/error audio is tied to the accepted notification turn, expires before later UI events, can preempt a just-fired weak tap without weakening ordinary sound/tactile cooldowns, and keeps the semantic protection window after acceptance.');

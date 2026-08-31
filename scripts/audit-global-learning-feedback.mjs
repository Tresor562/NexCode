import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/learningFeedback.ts', import.meta.url), 'utf8');
const lessonSource = fs.readFileSync(new URL('../src/ui/LessonFlowScreen.tsx', import.meta.url), 'utf8');

const expectations = [
  ['shared cooldown map', 'const sharedLastTriggeredAt = new Map<LearningFeedbackKind, number>();'],
  ['shared map read', 'const previous = sharedLastTriggeredAt.get(kind);'],
  ['shared map write', 'sharedLastTriggeredAt.set(kind, current);'],
  ['foreground gate', 'if (!appActive) return false;'],
  ['selection cooldown', "selection: 45"],
  ['impact cooldown', "impact: 120"],
  ['success cooldown', "success: 180"],
  ['error cooldown', "error: 180"],
  ['sound cooldown', "sound: 90"],
  ['global audio generation', 'let sharedAudioRequestGeneration = 0;'],
  ['audio supersession', 'const generation = supersedeAudio();'],
  ['cross-player stale audio guard', 'if (sharedAudioRequestGeneration !== generation) return;'],
  ['generation overflow guard', 'sharedAudioRequestGeneration >= Number.MAX_SAFE_INTEGER'],
  ['background audio invalidation', 'if (!appActive) {\n        supersedeAudio();\n        return;\n      }'],
  ['cooldown before supersession', "if (!canTrigger('sound', true)) return;\n      const generation = supersedeAudio();"],
];

const missing = expectations.filter(([, marker]) => !source.includes(marker));
if (missing.length) {
  console.error('Global learning feedback audit failed:');
  for (const [label] of missing) console.error(`- missing ${label}`);
  process.exit(1);
}

const factoryStart = source.indexOf('export function createLearningFeedbackGate');
const sharedMapStart = source.indexOf('const sharedLastTriggeredAt');
const sharedAudioStart = source.indexOf('let sharedAudioRequestGeneration');
if (sharedMapStart < 0 || factoryStart < 0 || sharedMapStart > factoryStart) {
  console.error('Global learning feedback audit failed: cooldown state must live outside individual gate instances.');
  process.exit(1);
}
if (sharedAudioStart < 0 || sharedAudioStart > factoryStart) {
  console.error('Global learning feedback audit failed: audio replay generation must be shared across every gate and player.');
  process.exit(1);
}

if (source.includes('const lastTriggeredAt = new Map<LearningFeedbackKind, number>();')) {
  console.error('Global learning feedback audit failed: per-instance cooldown map was reintroduced.');
  process.exit(1);
}
if (source.includes('new WeakMap<ReplayableAudioPlayer, number>()')) {
  console.error('Global learning feedback audit failed: per-player audio generations can allow stale cross-cue overlap.');
  process.exit(1);
}
if (/player\.seekTo\(0\)\.then\(\(\) => player\.play\(\)\)/.test(source)) {
  console.error('Global learning feedback audit failed: asynchronous audio seek may not replay without a stale-generation guard.');
  process.exit(1);
}
if (/const generation = supersedeAudio\(\);\s*if \(!canTrigger\('sound'/.test(source)) {
  console.error('Global learning feedback audit failed: a cooldown-rejected tap must not supersede an already accepted lesson cue.');
  process.exit(1);
}

const lessonExpectations = [
  ['lesson shared gate import', "createLearningFeedbackGate"],
  ['lesson gate instance', 'const feedback = useRef(createLearningFeedbackGate()).current;'],
  ['lesson sound routing', 'feedback.sound(appActive, player);'],
  ['lesson selection routing', 'feedback.selection(appActive);'],
  ['lesson notification routing', 'feedback.notification(appActive, tone);'],
  ['lesson impact routing', 'feedback.impact(appActive, tone);'],
];
const missingLesson = lessonExpectations.filter(([, marker]) => !lessonSource.includes(marker));
if (missingLesson.length) {
  console.error('Global learning feedback audit failed in LessonFlowScreen:');
  for (const [label] of missingLesson) console.error(`- missing ${label}`);
  process.exit(1);
}
if (lessonSource.includes("from 'expo-haptics'")) {
  console.error('Global learning feedback audit failed: LessonFlowScreen must not bypass the shared haptic gate.');
  process.exit(1);
}
if (/player\.seekTo\(0\)[\s\S]{0,80}player\.play\(\)/.test(lessonSource)) {
  console.error('Global learning feedback audit failed: LessonFlowScreen must not bypass stale-audio supersession.');
  process.exit(1);
}

console.log('Global learning feedback audit passed: cooldowns, foreground invalidation, accepted-cue preservation, lesson routing, and cross-player stale-audio supersession are enforced.');

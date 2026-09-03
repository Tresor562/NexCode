import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/learningFeedback.ts', import.meta.url), 'utf8');
const lessonSource = fs.readFileSync(new URL('../src/ui/LessonFlowScreen.tsx', import.meta.url), 'utf8');

const expectations = [
  ['shared cooldown map', 'const sharedLastTriggeredAt = new Map<LearningFeedbackKind, number>();'],
  ['shared map read', 'const previous = sharedLastTriggeredAt.get(kind);'],
  ['shared map write', 'sharedLastTriggeredAt.set(kind, current);'],
  ['foreground gate', 'if (!appActive || !nativeAppIsActive()) return false;'],
  ['native foreground source', "import { AppState } from 'react-native';"],
  ['native foreground predicate', "return AppState.currentState === 'active';"],
  ['native lifecycle audio invalidation', "AppState.addEventListener('change', (nextState) => {\n  if (nextState !== 'active') supersedeAudio();\n});"],
  ['non-finite current clock guard', 'if (!Number.isFinite(current)) return false;'],
  ['non-finite previous clock recovery', 'if (!Number.isFinite(previous)) {\n        sharedLastTriggeredAt.set(kind, current);\n        return false;\n      }'],
  ['clock rollback guard', 'if (elapsed < 0) {\n        sharedLastTriggeredAt.set(kind, current);\n        return false;\n      }'],
  ['selection cooldown', "selection: 45"],
  ['shared notification cooldown', "notification: 180"],
  ['shared notification kind', "const SHARED_NOTIFICATION_KIND: LearningFeedbackKind = 'notification';"],
  ['notification routing through shared kind', 'if (!canTrigger(SHARED_NOTIFICATION_KIND, appActive)) return;'],
  ['impact cooldown', "impact: 120"],
  ['sound cooldown', "sound: 90"],
  ['global audio generation', 'let sharedAudioRequestGeneration = 0;'],
  ['audio supersession', 'const generation = supersedeAudio();'],
  ['cross-player stale audio guard', 'if (sharedAudioRequestGeneration !== generation) return;'],
  ['generation overflow guard', 'sharedAudioRequestGeneration >= Number.MAX_SAFE_INTEGER'],
  ['background audio invalidation', 'if (!appActive || !nativeAppIsActive()) {\n        supersedeAudio();\n        return;\n      }'],
  ['cooldown before supersession', "if (!canTrigger('sound', true)) return;\n      const generation = supersedeAudio();"],
  ['sync-safe audio seek boundary', 'Promise.resolve()\n        .then(() => {'],
  ['foreground recheck before async seek', 'if (!nativeAppIsActive()) return false;'],
  ['foreground recheck before play', 'if (!nativeAppIsActive()) return;\n          player.play();'],
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
const lifecycleInvalidationStart = source.indexOf("AppState.addEventListener('change'");
if (sharedMapStart < 0 || factoryStart < 0 || sharedMapStart > factoryStart) {
  console.error('Global learning feedback audit failed: cooldown state must live outside individual gate instances.');
  process.exit(1);
}
if (sharedAudioStart < 0 || sharedAudioStart > factoryStart) {
  console.error('Global learning feedback audit failed: audio replay generation must be shared across every gate and player.');
  process.exit(1);
}
if (lifecycleInvalidationStart < 0 || lifecycleInvalidationStart > factoryStart) {
  console.error('Global learning feedback audit failed: app lifecycle invalidation must be module-wide so every feedback gate shares it.');
  process.exit(1);
}

if (source.includes('const lastTriggeredAt = new Map<LearningFeedbackKind, number>();')) {
  console.error('Global learning feedback audit failed: per-instance cooldown map was reintroduced.');
  process.exit(1);
}
if (source.includes("success: 180") || source.includes("error: 180")) {
  console.error('Global learning feedback audit failed: success/error haptics must share one notification cooldown channel.');
  process.exit(1);
}
if (/canTrigger\(tone, appActive\)/.test(source)) {
  console.error('Global learning feedback audit failed: semantic success/error tones must not create independent haptic cooldowns.');
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
if (/elapsed < 0\) return false/.test(source)) {
  console.error('Global learning feedback audit failed: clock rollback must reset the cooldown baseline before rejecting the cue.');
  process.exit(1);
}
if (/sharedLastTriggeredAt\.set\(kind, current\);\s*return true;/.test(source) && !source.includes('if (!Number.isFinite(current)) return false;')) {
  console.error('Global learning feedback audit failed: invalid timestamps must be rejected before they can poison the shared cooldown state.');
  process.exit(1);
}
if (/const generation = supersedeAudio\(\);\s*player\.seekTo\(0\)/.test(source)) {
  console.error('Global learning feedback audit failed: seekTo must be entered through a promise boundary so synchronous native throws are contained.');
  process.exit(1);
}
if (!/function canTrigger\(kind: LearningFeedbackKind, appActive: boolean\) \{[\s\S]{0,900}if \(!appActive \|\| !nativeAppIsActive\(\)\) return false;/.test(source)) {
  console.error('Global learning feedback audit failed: all haptic and audio feedback must verify native foreground state inside the shared trigger gate.');
  process.exit(1);
}

const soundStart = source.indexOf('sound(appActive: boolean, player: ReplayableAudioPlayer)');
const soundCancellationStart = source.indexOf('if (!appActive || !nativeAppIsActive()) {', soundStart);
const soundCooldownStart = source.indexOf("if (!canTrigger('sound', true)) return;", soundStart);
const soundGenerationStart = source.indexOf('const generation = supersedeAudio();', soundStart);
if (
  soundStart < 0 ||
  soundCancellationStart < soundStart ||
  soundCooldownStart < soundCancellationStart ||
  soundGenerationStart < soundCooldownStart ||
  !source.slice(soundCancellationStart, soundCooldownStart).includes('supersedeAudio();')
) {
  console.error('Global learning feedback audit failed: a sound request observed outside native foreground must invalidate older pending cues before the cooldown gate.');
  process.exit(1);
}
if (!/if \(!nativeAppIsActive\(\)\) return false;[\s\S]{0,180}seekTo\(0\)/.test(source)) {
  console.error('Global learning feedback audit failed: native foreground state must be rechecked before starting an accepted asynchronous seek.');
  process.exit(1);
}
if (!/sharedAudioRequestGeneration !== generation[\s\S]{0,120}!nativeAppIsActive\(\)[\s\S]{0,80}player\.play\(\)/.test(source)) {
  console.error('Global learning feedback audit failed: accepted audio must recheck native foreground state after seek and before playback.');
  process.exit(1);
}
if (!/AppState\.addEventListener\('change',[\s\S]{0,120}nextState !== 'active'[\s\S]{0,80}supersedeAudio\(\)/.test(source)) {
  console.error('Global learning feedback audit failed: background transitions must supersede accepted audio before a later foreground resume.');
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

console.log('Global learning feedback audit passed: shared notification haptics, cooldowns, native lifecycle gating, finite-clock recovery, clock rollback recovery, lifecycle invalidation, native-foreground request cancellation, native foreground rechecks, sync-safe audio replay, accepted-cue preservation, lesson routing, and cross-player stale-audio supersession are enforced.');

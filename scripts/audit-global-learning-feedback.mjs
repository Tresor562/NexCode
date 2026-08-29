import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/learningFeedback.ts', import.meta.url), 'utf8');

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
  ['shared audio generation', 'const sharedAudioGeneration = new WeakMap<ReplayableAudioPlayer, number>();'],
  ['audio supersession', 'const generation = supersedeAudio(player);'],
  ['stale audio guard', 'if (sharedAudioGeneration.get(player) !== generation) return;'],
];

const missing = expectations.filter(([, marker]) => !source.includes(marker));
if (missing.length) {
  console.error('Global learning feedback audit failed:');
  for (const [label] of missing) console.error(`- missing ${label}`);
  process.exit(1);
}

const factoryStart = source.indexOf('export function createLearningFeedbackGate');
const sharedMapStart = source.indexOf('const sharedLastTriggeredAt');
const sharedAudioStart = source.indexOf('const sharedAudioGeneration');
if (sharedMapStart < 0 || factoryStart < 0 || sharedMapStart > factoryStart) {
  console.error('Global learning feedback audit failed: cooldown state must live outside individual gate instances.');
  process.exit(1);
}
if (sharedAudioStart < 0 || sharedAudioStart > factoryStart) {
  console.error('Global learning feedback audit failed: audio replay generations must be shared across gate instances.');
  process.exit(1);
}

if (source.includes('const lastTriggeredAt = new Map<LearningFeedbackKind, number>();')) {
  console.error('Global learning feedback audit failed: per-instance cooldown map was reintroduced.');
  process.exit(1);
}
if (/player\.seekTo\(0\)\.then\(\(\) => player\.play\(\)\)/.test(source)) {
  console.error('Global learning feedback audit failed: asynchronous audio seek may not replay without a stale-generation guard.');
  process.exit(1);
}

console.log('Global learning feedback audit passed: cooldowns and stale-audio supersession are enforced across controls.');

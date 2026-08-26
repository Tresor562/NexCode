import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/motionPreferences.ts', import.meta.url), 'utf8');

const checks = [
  ['shared external store', source.includes('useSyncExternalStore')],
  ['single native listener lifecycle', source.includes('if (listeners.size === 1) startNativeListeners()') && source.includes('if (listeners.size === 0) stopNativeListeners()')],
  ['foreground state refreshed before subscribe', source.includes("publish({ appActive: AppState.currentState === 'active' })")],
  ['app state listener updates shared snapshot', source.includes("AppState.addEventListener('change'")],
  ['reduce-motion native event updates shared snapshot', source.includes("AccessibilityInfo.addEventListener('reduceMotionChanged'")],
  ['shared reduced-motion hydration helper', source.includes('function hydrateReduceMotion(generation: number)')],
  ['reduced-motion preference refreshed on app resume', source.includes('hydrateReduceMotion(generation)')],
  ['late hydration guarded by listener generation', source.includes('generation === listenerGeneration')],
  ['late hydration guarded by native event revision', source.includes('hydrationRevision === reduceMotionRevision')],
  ['failed hydration also guarded by native event revision', source.includes('.catch(() => {') && source.match(/hydrationRevision === reduceMotionRevision/g)?.length >= 2],
  ['unknown reduced-motion state fails safe', source.includes('if (!reduceMotionKnown) publish({ reduceMotion: true })')],
  ['app resume disables motion until OS refresh', source.includes('reduceMotionKnown = false;\n        publish({ reduceMotion: true });\n        hydrateReduceMotion(generation);')],
  ['failed OS preference read keeps motion disabled', source.includes('.catch(() => {') && source.includes('publish({ reduceMotion: true })')],
  ['native event marks preference known', source.includes('reduceMotionKnown = true;\n      publish({ reduceMotion: enabled });')],
  ['listener teardown invalidates cached preference', source.includes('reduceMotionKnown = false;\n  nativeSubscriptions.forEach')],
  ['native subscriptions removed when unused', source.includes('subscription.remove()')],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`Motion preferences audit failed: ${failed.join(', ')}`);
  process.exit(1);
}

console.log(`Motion preferences audit OK: ${checks.length} lifecycle and accessibility guards protected.`);

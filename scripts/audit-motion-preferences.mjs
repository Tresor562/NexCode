import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/motionPreferences.ts', import.meta.url), 'utf8');

const checks = [
  ['shared external store', source.includes('useSyncExternalStore')],
  ['first render fails safe before native hydration', /let snapshot: MotionSnapshot = \{[\s\S]*reduceMotion: true,/.test(source)],
  ['single native listener lifecycle', source.includes('if (listeners.size === 1) startNativeListeners()') && source.includes('if (listeners.size === 0) stopNativeListeners()')],
  ['foreground state refreshed before subscribe', source.includes("publish({ appActive: AppState.currentState === 'active' })")],
  ['app state listener updates shared snapshot', source.includes("AppState.addEventListener('change'")],
  ['reduce-motion native event updates shared snapshot', source.includes("AccessibilityInfo.addEventListener('reduceMotionChanged'")],
  ['shared reduced-motion hydration helper', source.includes('function hydrateReduceMotion(generation: number, attempt = 0)')],
  ['hydration is explicitly foreground guarded', source.includes('function canHydrateReduceMotion') && source.includes('snapshot.appActive')],
  ['initial hydration waits for active app', source.includes('if (snapshot.appActive) hydrateReduceMotion(generation)')],
  ['lifecycle transitions invalidate in-flight hydration', source.includes('function invalidateReduceMotionHydration()') && source.includes('reduceMotionRevision += 1;')],
  ['background transition invalidates stale hydration', source.includes('if (appActiveChanged) invalidateReduceMotionHydration();\n        publish({ reduceMotion: true });')],
  ['foreground transition invalidates stale hydration', source.includes('if (appActiveChanged) invalidateReduceMotionHydration();\n      publish({ reduceMotion: true });\n      hydrateReduceMotion(generation);')],
  ['background transition returns to fail-safe motion state', source.includes('publish({ reduceMotion: true });\n        return;')],
  ['reduced-motion preference refreshed on app resume', source.includes('hydrateReduceMotion(generation)')],
  ['late hydration guarded by listener generation', source.includes('generation === listenerGeneration')],
  ['late hydration guarded by native event revision', source.includes('hydrationRevision === reduceMotionRevision')],
  ['failed hydration also guarded by foreground lifecycle', source.includes('.catch(() => {') && source.includes('canHydrateReduceMotion(generation, hydrationRevision)')],
  ['unknown reduced-motion state fails safe', source.includes('if (!reduceMotionKnown) publish({ reduceMotion: true })')],
  ['app resume disables motion until OS refresh', source.includes('publish({ reduceMotion: true });\n      hydrateReduceMotion(generation);')],
  ['failed OS preference read keeps motion disabled', source.includes('.catch(() => {') && source.includes('publish({ reduceMotion: true })')],
  ['transient failed hydration retries once', source.includes('if (attempt === 0)') && source.includes('hydrateReduceMotion(generation, 1)') && source.includes('}, 1200)')],
  ['hydration retry remains lifecycle guarded', source.includes('hydrationRetryTimer = setTimeout') && source.includes('canHydrateReduceMotion(generation, hydrationRevision)')],
  ['hydration retry cleared on native event', source.includes('reduceMotionRevision += 1;\n      clearHydrationRetry();')],
  ['hydration retry cleared on teardown', source.includes('reduceMotionKnown = false;\n  clearHydrationRetry();\n  nativeSubscriptions.forEach')],
  ['native event marks preference known', source.includes('reduceMotionKnown = true;\n      publish({ reduceMotion: enabled });')],
  ['listener teardown invalidates cached preference', source.includes('reduceMotionKnown = false;\n  clearHydrationRetry();\n  nativeSubscriptions.forEach')],
  ['native subscriptions removed when unused', source.includes('subscription.remove()')],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`Motion preferences audit failed: ${failed.join(', ')}`);
  process.exit(1);
}

console.log(`Motion preferences audit OK: ${checks.length} lifecycle and accessibility guards protected.`);

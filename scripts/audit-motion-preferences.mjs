import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/motionPreferences.ts', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../src/ui/NexCodeApp.tsx', import.meta.url), 'utf8');

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
  ['background accessibility event stays fail-safe', source.includes('if (!snapshot.appActive) {\n        reduceMotionKnown = false;\n        publish({ reduceMotion: true });\n        return;\n      }')],
  ['reduced-motion preference refreshed on app resume', source.includes('hydrateReduceMotion(generation)')],
  ['late hydration guarded by listener generation', source.includes('generation === listenerGeneration')],
  ['late hydration guarded by native event revision', source.includes('hydrationRevision === reduceMotionRevision')],
  ['failed hydration also guarded by foreground lifecycle', source.includes('.catch(() => {') && source.includes('canHydrateReduceMotion(generation, hydrationRevision)')],
  ['unknown reduced-motion state fails safe', source.includes('if (!reduceMotionKnown) publish({ reduceMotion: true })')],
  ['app resume disables motion until OS refresh', source.includes('publish({ reduceMotion: true });\n      hydrateReduceMotion(generation);')],
  ['failed OS preference read keeps motion disabled', source.includes('.catch(() => {') && source.includes('publish({ reduceMotion: true })')],
  ['transient hydration failures use bounded progressive retries', source.includes('const HYDRATION_RETRY_DELAYS_MS = [1200, 3000, 8000] as const;') && source.includes('const retryDelay = HYDRATION_RETRY_DELAYS_MS[attempt];') && source.includes('hydrateReduceMotion(generation, attempt + 1)')],
  ['hydration retries stop after configured backoff budget', source.includes('if (retryDelay !== undefined)') && !source.includes('setInterval(')],
  ['hydration retry remains lifecycle guarded', source.includes('hydrationRetryTimer = setTimeout') && source.includes('canHydrateReduceMotion(generation, hydrationRevision)')],
  ['hydration retry cleared on native event', source.includes('reduceMotionRevision += 1;\n      clearHydrationRetry();')],
  ['hydration retry cleared on teardown', source.includes('reduceMotionKnown = false;\n  clearHydrationRetry();\n  nativeSubscriptions.forEach')],
  ['native event marks preference known', source.includes('reduceMotionKnown = true;\n      publish({ reduceMotion: enabled });')],
  ['listener teardown invalidates cached preference', source.includes('reduceMotionKnown = false;\n  clearHydrationRetry();\n  nativeSubscriptions.forEach')],
  ['listener-free remount stays fail-safe', source.includes("publish({ reduceMotion: true, appActive: AppState.currentState === 'active' });")],
  ['native subscriptions removed when unused', source.includes('subscription.remove()')],
  ['home consumes shared motion preference', appSource.includes("import { useMotionPreferences } from './motionPreferences';") && appSource.includes('const { reduceMotion, appActive } = useMotionPreferences();')],
  ['home entrance is disabled when motion is reduced or app inactive', appSource.includes('if (!entranceEnabled || reduceMotion || !appActive) {') && appSource.includes('entrance.setValue(1);')],
  ['home entrance initial state fails safe when motion is unavailable', appSource.includes('const entranceEnabled = useRef(appActive && !reduceMotion).current;') && appSource.includes('new Animated.Value(entranceEnabled ? 0 : 1)')],
  ['home entrance animation is cancellable on lifecycle or preference changes', appSource.includes('entrance.stopAnimation();') && appSource.includes('return () => animation.stop();')],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`Motion preferences audit failed: ${failed.join(', ')}`);
  process.exit(1);
}

console.log(`Motion preferences audit OK: ${checks.length} lifecycle and accessibility guards protected.`);
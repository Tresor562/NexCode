import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

type MotionSnapshot = {
  reduceMotion: boolean;
  appActive: boolean;
};

type NativeSubscription = { remove: () => void };

let snapshot: MotionSnapshot = {
  // useSyncExternalStore reads once before subscribe() installs native listeners.
  // Start fail-safe so the very first render can never animate before the OS
  // reduced-motion preference has been hydrated.
  reduceMotion: true,
  appActive: AppState.currentState === 'active',
};
let listenersActive = false;
let listenerGeneration = 0;
let reduceMotionRevision = 0;
let reduceMotionKnown = false;
let hydrationRetryTimer: ReturnType<typeof setTimeout> | null = null;
let nativeSubscriptions: NativeSubscription[] = [];
const listeners = new Set<() => void>();

function publish(next: Partial<MotionSnapshot>) {
  const reduceMotion = next.reduceMotion ?? snapshot.reduceMotion;
  const appActive = next.appActive ?? snapshot.appActive;
  if (reduceMotion === snapshot.reduceMotion && appActive === snapshot.appActive) return;
  snapshot = { reduceMotion, appActive };
  listeners.forEach((listener) => listener());
}

function clearHydrationRetry() {
  if (!hydrationRetryTimer) return;
  clearTimeout(hydrationRetryTimer);
  hydrationRetryTimer = null;
}

function canHydrateReduceMotion(generation: number, hydrationRevision: number) {
  return (
    listenersActive &&
    snapshot.appActive &&
    generation === listenerGeneration &&
    hydrationRevision === reduceMotionRevision
  );
}

function invalidateReduceMotionHydration() {
  // App lifecycle transitions form a freshness boundary just like native
  // reduce-motion events. Any async read started before this boundary must never
  // become authoritative if it resolves after a later foreground session starts.
  reduceMotionRevision += 1;
  clearHydrationRetry();
  reduceMotionKnown = false;
}

function hydrateReduceMotion(generation: number, attempt = 0) {
  const hydrationRevision = reduceMotionRevision;
  if (!canHydrateReduceMotion(generation, hydrationRevision)) return;

  AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      // Native events are more current than an async hydration read. The same
      // helper is used on initial subscribe and when the app returns to the
      // foreground so a setting changed while backgrounded cannot leave the
      // shared motion state stale.
      if (canHydrateReduceMotion(generation, hydrationRevision)) {
        clearHydrationRetry();
        reduceMotionKnown = true;
        publish({ reduceMotion: enabled });
      }
    })
    .catch(() => {
      // A native event that arrived after this hydration started is newer than
      // the failed async read. Do not let a late rejection overwrite that newer
      // preference with the fail-safe value.
      if (canHydrateReduceMotion(generation, hydrationRevision)) {
        reduceMotionKnown = false;
        publish({ reduceMotion: true });

        // A single transient native failure should not disable premium motion for
        // the rest of the foreground session. Stay fail-safe while the preference
        // is unknown, then retry once with the same generation/revision guards.
        if (attempt === 0) {
          clearHydrationRetry();
          hydrationRetryTimer = setTimeout(() => {
            hydrationRetryTimer = null;
            if (canHydrateReduceMotion(generation, hydrationRevision)) {
              hydrateReduceMotion(generation, 1);
            }
          }, 1200);
        }
      }
    });
}

function startNativeListeners() {
  if (listenersActive) return;
  listenersActive = true;
  const generation = ++listenerGeneration;

  // AppState can change while no learning-path node is mounted. Refresh the
  // snapshot before subscribing so a newly mounted path never resumes motion or
  // haptics from a stale foreground state.
  publish({ appActive: AppState.currentState === 'active' });

  // AccessibilityInfo only exposes the current reduced-motion value
  // asynchronously. If the last native listener lifecycle ended, the cached
  // value may be stale. Disable motion until the OS confirms the current value.
  if (!reduceMotionKnown) publish({ reduceMotion: true });

  nativeSubscriptions = [
    AppState.addEventListener('change', (nextState) => {
      const appActive = nextState === 'active';
      const appActiveChanged = appActive !== snapshot.appActive;
      publish({ appActive });

      if (!appActive) {
        // Do not spend native work while the application is suspended. Any
        // pending retry and in-flight hydration belong to the previous foreground
        // session, so invalidate them before the next resume can become active.
        if (appActiveChanged) invalidateReduceMotionHydration();
        publish({ reduceMotion: true });
        return;
      }

      // Accessibility events are not guaranteed to be delivered while an app is
      // suspended. Re-read the system preference every time we return to the
      // foreground, while keeping the same generation/revision race guards used
      // for initial hydration. Advancing the revision prevents a Promise started
      // before backgrounding from publishing into this newer foreground session.
      if (appActiveChanged) invalidateReduceMotionHydration();
      publish({ reduceMotion: true });
      hydrateReduceMotion(generation);
    }),
    AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      // Native events are more current than asynchronous hydration reads. Advance
      // a revision so a late Promise cannot overwrite a newer system preference
      // while this listener generation is still active.
      reduceMotionRevision += 1;
      clearHydrationRetry();

      // Keep the shared snapshot fail-safe while backgrounded. Accessibility
      // events are not guaranteed to be complete while suspended, so never let a
      // background event re-enable motion before the foreground refresh confirms
      // the current OS preference.
      if (!snapshot.appActive) {
        reduceMotionKnown = false;
        publish({ reduceMotion: true });
        return;
      }

      reduceMotionKnown = true;
      publish({ reduceMotion: enabled });
    }),
  ];

  if (snapshot.appActive) hydrateReduceMotion(generation);
}

function stopNativeListeners() {
  if (!listenersActive) return;
  listenersActive = false;
  listenerGeneration += 1;
  reduceMotionKnown = false;
  clearHydrationRetry();
  nativeSubscriptions.forEach((subscription) => subscription.remove());
  nativeSubscriptions = [];

  // useSyncExternalStore may render a newly mounted consumer once before
  // subscribe() restarts the native listeners. Never leave an old `false`
  // reduced-motion value cached across that listener-free gap, otherwise a
  // remounted mentor/path can animate for one frame before the OS preference is
  // rehydrated. Keep motion disabled until the next native read proves it safe.
  publish({ reduceMotion: true, appActive: AppState.currentState === 'active' });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) startNativeListeners();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopNativeListeners();
  };
}

function getSnapshot() {
  return snapshot;
}

export function useMotionPreferences(): MotionSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

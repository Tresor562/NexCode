import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

type MotionSnapshot = {
  reduceMotion: boolean;
  appActive: boolean;
};

type NativeSubscription = { remove: () => void };

let snapshot: MotionSnapshot = {
  reduceMotion: false,
  appActive: AppState.currentState === 'active',
};
let listenersActive = false;
let listenerGeneration = 0;
let reduceMotionRevision = 0;
let reduceMotionKnown = false;
let nativeSubscriptions: NativeSubscription[] = [];
const listeners = new Set<() => void>();

function publish(next: Partial<MotionSnapshot>) {
  const reduceMotion = next.reduceMotion ?? snapshot.reduceMotion;
  const appActive = next.appActive ?? snapshot.appActive;
  if (reduceMotion === snapshot.reduceMotion && appActive === snapshot.appActive) return;
  snapshot = { reduceMotion, appActive };
  listeners.forEach((listener) => listener());
}

function hydrateReduceMotion(generation: number) {
  const hydrationRevision = reduceMotionRevision;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      // Native events are more current than an async hydration read. The same
      // helper is used on initial subscribe and when the app returns to the
      // foreground so a setting changed while backgrounded cannot leave the
      // shared motion state stale.
      if (
        listenersActive &&
        generation === listenerGeneration &&
        hydrationRevision === reduceMotionRevision
      ) {
        reduceMotionKnown = true;
        publish({ reduceMotion: enabled });
      }
    })
    .catch(() => {
      // A native event that arrived after this hydration started is newer than
      // the failed async read. Do not let a late rejection overwrite that newer
      // preference with the fail-safe value.
      if (
        listenersActive &&
        generation === listenerGeneration &&
        hydrationRevision === reduceMotionRevision
      ) {
        reduceMotionKnown = false;
        publish({ reduceMotion: true });
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
      publish({ appActive });
      // Accessibility events are not guaranteed to be delivered while an app is
      // suspended. Re-read the system preference every time we return to the
      // foreground, while keeping the same generation/revision race guards used
      // for initial hydration.
      if (appActive) {
        reduceMotionKnown = false;
        publish({ reduceMotion: true });
        hydrateReduceMotion(generation);
      }
    }),
    AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      // Native events are more current than asynchronous hydration reads. Advance
      // a revision so a late Promise cannot overwrite a newer system preference
      // while this listener generation is still active.
      reduceMotionRevision += 1;
      reduceMotionKnown = true;
      publish({ reduceMotion: enabled });
    }),
  ];

  hydrateReduceMotion(generation);
}

function stopNativeListeners() {
  if (!listenersActive) return;
  listenersActive = false;
  listenerGeneration += 1;
  reduceMotionKnown = false;
  nativeSubscriptions.forEach((subscription) => subscription.remove());
  nativeSubscriptions = [];
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

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
let nativeSubscriptions: NativeSubscription[] = [];
const listeners = new Set<() => void>();

function publish(next: Partial<MotionSnapshot>) {
  const reduceMotion = next.reduceMotion ?? snapshot.reduceMotion;
  const appActive = next.appActive ?? snapshot.appActive;
  if (reduceMotion === snapshot.reduceMotion && appActive === snapshot.appActive) return;
  snapshot = { reduceMotion, appActive };
  listeners.forEach((listener) => listener());
}

function startNativeListeners() {
  if (listenersActive) return;
  listenersActive = true;
  const generation = ++listenerGeneration;

  // AppState can change while no learning-path node is mounted. Refresh the
  // snapshot before subscribing so a newly mounted path never resumes motion or
  // haptics from a stale foreground state.
  publish({ appActive: AppState.currentState === 'active' });

  nativeSubscriptions = [
    AppState.addEventListener('change', (nextState) => {
      publish({ appActive: nextState === 'active' });
    }),
    AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      // Native events are more current than the asynchronous hydration read
      // below. Advance a revision so a late Promise cannot overwrite a newer
      // system preference while this listener generation is still active.
      reduceMotionRevision += 1;
      publish({ reduceMotion: enabled });
    }),
  ];

  const hydrationRevision = reduceMotionRevision;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      // A previous async read can resolve after all subscribers unmount and a
      // later subscriber starts a fresh listener set. It can also resolve after
      // a newer reduceMotionChanged event in the same generation. Guard both
      // cases so stale accessibility state never overwrites the latest native
      // preference.
      if (
        listenersActive &&
        generation === listenerGeneration &&
        hydrationRevision === reduceMotionRevision
      ) {
        publish({ reduceMotion: enabled });
      }
    })
    .catch(() => undefined);
}

function stopNativeListeners() {
  if (!listenersActive) return;
  listenersActive = false;
  listenerGeneration += 1;
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

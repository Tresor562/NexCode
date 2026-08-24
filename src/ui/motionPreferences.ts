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

  // AppState can change while no learning-path node is mounted. Refresh the
  // snapshot before subscribing so a newly mounted path never resumes motion or
  // haptics from a stale foreground state.
  publish({ appActive: AppState.currentState === 'active' });

  nativeSubscriptions = [
    AppState.addEventListener('change', (nextState) => {
      publish({ appActive: nextState === 'active' });
    }),
    AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      publish({ reduceMotion: enabled });
    }),
  ];

  AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      if (listenersActive) publish({ reduceMotion: enabled });
    })
    .catch(() => undefined);
}

function stopNativeListeners() {
  if (!listenersActive) return;
  listenersActive = false;
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

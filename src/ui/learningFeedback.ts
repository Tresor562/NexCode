import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';

export type LearningFeedbackKind = 'selection' | 'notification' | 'impact' | 'sound';
export type LearningImpactTone = 'light' | 'medium';
export type LearningNotificationTone = 'success' | 'error';

export type ReplayableAudioPlayer = {
  seekTo: (seconds: number) => Promise<unknown>;
  play: () => void;
};

const FEEDBACK_COOLDOWN_MS: Record<LearningFeedbackKind, number> = {
  selection: 45,
  notification: 180,
  impact: 120,
  sound: 90,
};

// A strong semantic haptic should get a short tactile quiet window. Without this,
// the learner can submit a quiz, receive a success/error notification, then tap the
// next CTA quickly enough to stack a selection tick on top of the stronger cue.
// Premium mobile feedback feels intentional when the strong event gets to land.
const WEAK_FEEDBACK_AFTER_STRONG_COOLDOWN_MS = 160;

// Notification and impact are technically different native APIs, but they both
// occupy the same tactile channel for the learner. Serialize them globally so a
// success/error cue cannot be immediately followed by an impact from an entering
// CTA, robot reaction or animation. That keeps one semantic event = one clear pulse.
const STRONG_FEEDBACK_COOLDOWN_MS = 180;

// Feedback gates are created by many independent controls. Keep the cooldown state
// at module scope so quickly moving between controls cannot produce a burst of
// duplicate vibrations or sounds just because each control owns a different gate.
const sharedLastTriggeredAt = new Map<LearningFeedbackKind, number>();
let sharedLastStrongFeedbackAt: number | undefined;

// Success and error are different semantic tones, but they drive the same physical
// notification channel. Gate them together so a fast correction after a mistake
// cannot stack two strong haptic notifications back-to-back.
const SHARED_NOTIFICATION_KIND: LearningFeedbackKind = 'notification';

// Audio seeking is asynchronous. A slower seek from one cue can resolve after a
// newer cue has already been requested. The generation is global rather than
// per-player because success/error/tap cues use different players but still share
// one audible feedback channel from the learner's perspective. Only the newest
// accepted cue may call play().
let sharedAudioRequestGeneration = 0;

function supersedeAudio(): number {
  sharedAudioRequestGeneration = sharedAudioRequestGeneration >= Number.MAX_SAFE_INTEGER
    ? 1
    : sharedAudioRequestGeneration + 1;
  return sharedAudioRequestGeneration;
}

// Invalidate accepted cues as soon as the native app leaves the foreground. A
// foreground check alone is not enough: an asynchronous seek may start while the
// app is active, remain pending through background, then resolve after the user
// returns. Without a lifecycle generation bump that stale cue would look active
// again and could play late on resume.
AppState.addEventListener('change', (nextState) => {
  if (nextState !== 'active') supersedeAudio();
});

function nativeAppIsActive(): boolean {
  return AppState.currentState === 'active';
}

export function createLearningFeedbackGate(now: () => number = Date.now) {
  function canTrigger(kind: LearningFeedbackKind, appActive: boolean) {
    // React state can lag a native lifecycle transition by a render. Require both
    // the caller's state and the native AppState before firing *any* feedback,
    // not only audio. This prevents haptics from vibrating after the learner has
    // already backgrounded NexCode while the UI still carries a stale active flag.
    if (!appActive || !nativeAppIsActive()) return false;
    const current = now();
    // A mocked or platform clock returning NaN/Infinity must never poison the
    // shared cooldown map. Once NaN is stored, every elapsed comparison becomes
    // false and rapid feedback can bypass throttling indefinitely.
    if (!Number.isFinite(current)) return false;

    if (sharedLastStrongFeedbackAt !== undefined) {
      if (!Number.isFinite(sharedLastStrongFeedbackAt)) {
        sharedLastStrongFeedbackAt = undefined;
      } else {
        const elapsedSinceStrong = current - sharedLastStrongFeedbackAt;
        if (elapsedSinceStrong < 0) {
          sharedLastStrongFeedbackAt = current;
          return false;
        }
        // Weak selection ticks should not chatter after a semantic cue, and strong
        // channels should not race each other merely because they use distinct
        // native APIs. Both rules intentionally share the same global timestamp.
        if (kind === 'selection' && elapsedSinceStrong < WEAK_FEEDBACK_AFTER_STRONG_COOLDOWN_MS) return false;
        if ((kind === 'notification' || kind === 'impact') && elapsedSinceStrong < STRONG_FEEDBACK_COOLDOWN_MS) return false;
      }
    }

    const previous = sharedLastTriggeredAt.get(kind);
    if (previous !== undefined) {
      // Recover defensively from any legacy/corrupted module state without
      // allowing the first valid sample to fire immediately.
      if (!Number.isFinite(previous)) {
        sharedLastTriggeredAt.set(kind, current);
        return false;
      }
      const elapsed = current - previous;
      // Device clocks can move backwards after time sync, timezone corrections or
      // test clock replacement. Treat the first regressed timestamp as a new
      // cooldown baseline instead of allowing a vibration/sound burst.
      if (elapsed < 0) {
        sharedLastTriggeredAt.set(kind, current);
        return false;
      }
      if (elapsed < FEEDBACK_COOLDOWN_MS[kind]) return false;
    }
    sharedLastTriggeredAt.set(kind, current);
    if (kind === 'notification' || kind === 'impact') sharedLastStrongFeedbackAt = current;
    return true;
  }

  return {
    selection(appActive: boolean) {
      if (!canTrigger('selection', appActive)) return;
      Haptics.selectionAsync().catch(() => undefined);
    },
    notification(appActive: boolean, tone: LearningNotificationTone) {
      if (!canTrigger(SHARED_NOTIFICATION_KIND, appActive)) return;
      const type = tone === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success;
      Haptics.notificationAsync(type).catch(() => undefined);
    },
    impact(appActive: boolean, tone: LearningImpactTone) {
      if (!canTrigger('impact', appActive)) return;
      const style = tone === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(style).catch(() => undefined);
    },
    sound(appActive: boolean, player: ReplayableAudioPlayer) {
      // Treat both React and native lifecycle state as authoritative cancellation
      // signals. The module-wide AppState listener normally invalidates pending
      // audio first, but checking here as well closes the race where React still
      // reports active while the native app is already backgrounded.
      if (!appActive || !nativeAppIsActive()) {
        supersedeAudio();
        return;
      }
      // A request rejected only by the sound cooldown is different: it should not
      // silence an already accepted success/error cue just because the learner taps
      // the next control immediately.
      if (!canTrigger('sound', true)) return;
      const generation = supersedeAudio();
      // Start from a resolved promise so a native/player implementation that
      // throws synchronously from seekTo is handled exactly like a rejected seek.
      // Re-check the native AppState both before and after the asynchronous seek:
      // React state can still say "active" for a render while the OS has already
      // backgrounded the app, and an accepted cue must never leak across that
      // lifecycle boundary.
      Promise.resolve()
        .then(() => {
          if (!nativeAppIsActive()) return false;
          return Promise.resolve(player.seekTo(0)).then(() => true);
        })
        .then((ready) => {
          if (!ready) return;
          if (sharedAudioRequestGeneration !== generation) return;
          if (!nativeAppIsActive()) return;
          player.play();
        })
        .catch(() => undefined);
    },
  };
}
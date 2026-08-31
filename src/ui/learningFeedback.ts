import * as Haptics from 'expo-haptics';

export type LearningFeedbackKind = 'selection' | 'success' | 'error' | 'impact' | 'sound';
export type LearningImpactTone = 'light' | 'medium';
export type LearningNotificationTone = 'success' | 'error';

export type ReplayableAudioPlayer = {
  seekTo: (seconds: number) => Promise<unknown>;
  play: () => void;
};

const FEEDBACK_COOLDOWN_MS: Record<LearningFeedbackKind, number> = {
  selection: 45,
  success: 180,
  error: 180,
  impact: 120,
  sound: 90,
};

// Feedback gates are created by many independent controls. Keep the cooldown state
// at module scope so quickly moving between controls cannot produce a burst of
// duplicate vibrations or sounds just because each control owns a different gate.
const sharedLastTriggeredAt = new Map<LearningFeedbackKind, number>();

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

export function createLearningFeedbackGate(now: () => number = Date.now) {
  function canTrigger(kind: LearningFeedbackKind, appActive: boolean) {
    if (!appActive) return false;
    const current = now();
    const previous = sharedLastTriggeredAt.get(kind);
    if (previous !== undefined) {
      const elapsed = current - previous;
      if (elapsed >= 0 && elapsed < FEEDBACK_COOLDOWN_MS[kind]) return false;
    }
    sharedLastTriggeredAt.set(kind, current);
    return true;
  }

  return {
    selection(appActive: boolean) {
      if (!canTrigger('selection', appActive)) return;
      Haptics.selectionAsync().catch(() => undefined);
    },
    notification(appActive: boolean, tone: LearningNotificationTone) {
      if (!canTrigger(tone, appActive)) return;
      const type = tone === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success;
      Haptics.notificationAsync(type).catch(() => undefined);
    },
    impact(appActive: boolean, tone: LearningImpactTone) {
      if (!canTrigger('impact', appActive)) return;
      const style = tone === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(style).catch(() => undefined);
    },
    sound(appActive: boolean, player: ReplayableAudioPlayer) {
      // Moving the app out of the foreground must invalidate any seek that may
      // still resolve after the transition. A request rejected only by the sound
      // cooldown is different: it should not silence an already accepted success
      // or error cue just because the learner taps the next control immediately.
      if (!appActive) {
        supersedeAudio();
        return;
      }
      if (!canTrigger('sound', true)) return;
      const generation = supersedeAudio();
      player.seekTo(0)
        .then(() => {
          if (sharedAudioRequestGeneration !== generation) return;
          player.play();
        })
        .catch(() => undefined);
    },
  };
}

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

// Audio seeking is asynchronous. A slower seek from feedback A can resolve after
// feedback B has already started and replay the obsolete cue. Keep one generation
// per player so only the newest requested replay is allowed to call play().
const sharedAudioGeneration = new WeakMap<ReplayableAudioPlayer, number>();

function supersedeAudio(player: ReplayableAudioPlayer): number {
  const generation = (sharedAudioGeneration.get(player) ?? 0) + 1;
  sharedAudioGeneration.set(player, generation);
  return generation;
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
      // Supersede first, even when this request is rejected by the foreground or
      // cooldown gate. A later interaction must be able to invalidate an older
      // seek that is still resolving rather than letting stale audio leak through.
      const generation = supersedeAudio(player);
      if (!canTrigger('sound', appActive)) return;
      player.seekTo(0)
        .then(() => {
          if (sharedAudioGeneration.get(player) !== generation) return;
          player.play();
        })
        .catch(() => undefined);
    },
  };
}

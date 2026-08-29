import * as Haptics from 'expo-haptics';

export type LearningFeedbackKind = 'selection' | 'success' | 'error' | 'impact';

export type ReplayableAudioPlayer = {
  seekTo: (seconds: number) => Promise<unknown>;
  play: () => void;
};

const FEEDBACK_COOLDOWN_MS: Record<LearningFeedbackKind, number> = {
  selection: 45,
  success: 180,
  error: 180,
  impact: 120,
};

export function createLearningFeedbackGate(now: () => number = Date.now) {
  const lastTriggeredAt = new Map<LearningFeedbackKind, number>();

  function canTrigger(kind: LearningFeedbackKind, appActive: boolean) {
    if (!appActive) return false;
    const current = now();
    const previous = lastTriggeredAt.get(kind);
    if (previous !== undefined && current - previous < FEEDBACK_COOLDOWN_MS[kind]) return false;
    lastTriggeredAt.set(kind, current);
    return true;
  }

  return {
    selection(appActive: boolean) {
      if (!canTrigger('selection', appActive)) return;
      Haptics.selectionAsync().catch(() => undefined);
    },
    notification(appActive: boolean, type: Haptics.NotificationFeedbackType) {
      const kind: LearningFeedbackKind = type === Haptics.NotificationFeedbackType.Error ? 'error' : 'success';
      if (!canTrigger(kind, appActive)) return;
      Haptics.notificationAsync(type).catch(() => undefined);
    },
    impact(appActive: boolean, style: Haptics.ImpactFeedbackStyle) {
      if (!canTrigger('impact', appActive)) return;
      Haptics.impactAsync(style).catch(() => undefined);
    },
    sound(appActive: boolean, player: ReplayableAudioPlayer) {
      if (!appActive) return;
      player.seekTo(0).then(() => player.play()).catch(() => undefined);
    },
  };
}

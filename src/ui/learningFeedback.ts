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

export function createLearningFeedbackGate(now: () => number = Date.now) {
  const lastTriggeredAt = new Map<LearningFeedbackKind, number>();

  function canTrigger(kind: LearningFeedbackKind, appActive: boolean) {
    if (!appActive) return false;
    const current = now();
    const previous = lastTriggeredAt.get(kind);
    if (previous !== undefined) {
      const elapsed = current - previous;
      if (elapsed >= 0 && elapsed < FEEDBACK_COOLDOWN_MS[kind]) return false;
    }
    lastTriggeredAt.set(kind, current);
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
      if (!canTrigger('sound', appActive)) return;
      player.seekTo(0).then(() => player.play()).catch(() => undefined);
    },
  };
}

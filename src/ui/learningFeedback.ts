import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';

export type LearningFeedbackKind = 'selection' | 'notification' | 'impact' | 'sound';
export type LearningImpactTone = 'light' | 'medium';
export type LearningNotificationTone = 'success' | 'error';

type StrongLearningFeedbackKind = 'notification' | 'impact';

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

const WEAK_FEEDBACK_AFTER_STRONG_COOLDOWN_MS = 160;
const STRONG_FEEDBACK_COOLDOWN_MS = 180;
const SEMANTIC_AUDIO_ASSOCIATION_WINDOW_MS = 40;
const SEMANTIC_AUDIO_PROTECTION_MS = 180;

const sharedLastTriggeredAt = new Map<LearningFeedbackKind, number>();
let sharedLastStrongFeedbackAt: number | undefined;
let sharedLastStrongFeedbackKind: StrongLearningFeedbackKind | undefined;
let sharedLastNotificationFeedbackAt: number | undefined;
let sharedSemanticAudioProtectedFrom: number | undefined;
let sharedSemanticAudioProtectedUntil: number | undefined;

// A semantic success/error sound belongs to the synchronous notification turn that
// requested it. The millisecond window remains as a defensive clock bound, while
// this microtask-scoped permit prevents a later tap event from inheriting semantic
// priority merely because it happened very quickly after a notification.
let sharedSemanticAudioAssociationOpen = false;
let sharedSemanticAudioAssociationGeneration = 0;

const SHARED_NOTIFICATION_KIND: LearningFeedbackKind = 'notification';
let sharedAudioRequestGeneration = 0;

function clearSemanticAudioProtection() {
  sharedSemanticAudioProtectedFrom = undefined;
  sharedSemanticAudioProtectedUntil = undefined;
}

function openSemanticAudioAssociationWindow() {
  sharedSemanticAudioAssociationOpen = true;
  sharedSemanticAudioAssociationGeneration = sharedSemanticAudioAssociationGeneration >= Number.MAX_SAFE_INTEGER
    ? 1
    : sharedSemanticAudioAssociationGeneration + 1;
  const generation = sharedSemanticAudioAssociationGeneration;

  Promise.resolve().then(() => {
    if (sharedSemanticAudioAssociationGeneration === generation) {
      sharedSemanticAudioAssociationOpen = false;
    }
  });
}

function supersedeAudio(): number {
  clearSemanticAudioProtection();
  // Any newer audio/lifecycle request terminates the semantic notification turn.
  // Keeping that permit alive after a superseding request could let a foregrounded
  // app or a later interaction inherit success/error priority from stale feedback.
  sharedSemanticAudioAssociationOpen = false;
  sharedLastNotificationFeedbackAt = undefined;
  sharedAudioRequestGeneration = sharedAudioRequestGeneration >= Number.MAX_SAFE_INTEGER
    ? 1
    : sharedAudioRequestGeneration + 1;
  return sharedAudioRequestGeneration;
}

AppState.addEventListener('change', (nextState) => {
  if (nextState !== 'active') supersedeAudio();
});

function nativeAppIsActive(): boolean {
  return AppState.currentState === 'active';
}

export function createLearningFeedbackGate(now: () => number = Date.now) {
  function canTrigger(kind: LearningFeedbackKind, appActive: boolean, bypassOwnCooldown = false) {
    if (!appActive || !nativeAppIsActive()) return false;
    const current = now();
    if (!Number.isFinite(current)) return false;

    if (sharedLastStrongFeedbackAt !== undefined) {
      if (!Number.isFinite(sharedLastStrongFeedbackAt)) {
        sharedLastStrongFeedbackAt = undefined;
        sharedLastStrongFeedbackKind = undefined;
      } else {
        const elapsedSinceStrong = current - sharedLastStrongFeedbackAt;
        if (elapsedSinceStrong < 0) {
          sharedLastStrongFeedbackAt = current;
          sharedLastStrongFeedbackKind = undefined;
          return false;
        }
        if (kind === 'selection' && elapsedSinceStrong < WEAK_FEEDBACK_AFTER_STRONG_COOLDOWN_MS) return false;

        // Semantic outcome feedback outranks the physical press that usually
        // precedes it. A submit button may emit an impact immediately before the
        // answer is graded; suppressing the success/error notification makes the
        // lesson feel unresponsive. Keep the inverse protection though: once a
        // notification lands, a trailing impact cannot muddy that result cue.
        const semanticNotificationPreemptsImpact = kind === 'notification' && sharedLastStrongFeedbackKind === 'impact';
        if (
          (kind === 'notification' || kind === 'impact') &&
          elapsedSinceStrong < STRONG_FEEDBACK_COOLDOWN_MS &&
          !semanticNotificationPreemptsImpact
        ) return false;
      }
    }

    const previous = sharedLastTriggeredAt.get(kind);
    if (previous !== undefined) {
      if (!Number.isFinite(previous)) {
        sharedLastTriggeredAt.set(kind, current);
        return false;
      }
      const elapsed = current - previous;
      if (elapsed < 0) {
        sharedLastTriggeredAt.set(kind, current);
        return false;
      }
      if (!bypassOwnCooldown && elapsed < FEEDBACK_COOLDOWN_MS[kind]) return false;
    }
    sharedLastTriggeredAt.set(kind, current);
    if (kind === 'notification' || kind === 'impact') {
      sharedLastStrongFeedbackAt = current;
      sharedLastStrongFeedbackKind = kind;
    }
    if (kind === 'notification') {
      sharedLastNotificationFeedbackAt = current;
      openSemanticAudioAssociationWindow();
    }
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
      if (!appActive || !nativeAppIsActive()) {
        supersedeAudio();
        return;
      }

      const current = now();
      if (!Number.isFinite(current)) {
        // A malformed/rolled-over clock must not leave an older async seek eligible
        // to play later. Treat this request as a lifecycle boundary and invalidate it.
        supersedeAudio();
        return;
      }

      if (sharedSemanticAudioProtectedFrom !== undefined && sharedSemanticAudioProtectedUntil !== undefined) {
        if (
          !Number.isFinite(sharedSemanticAudioProtectedFrom) ||
          !Number.isFinite(sharedSemanticAudioProtectedUntil) ||
          current < sharedSemanticAudioProtectedFrom ||
          current >= sharedSemanticAudioProtectedUntil
        ) {
          clearSemanticAudioProtection();
        } else {
          return;
        }
      }

      let semanticCandidate = Number.POSITIVE_INFINITY;
      if (sharedSemanticAudioAssociationOpen && sharedLastNotificationFeedbackAt !== undefined) {
        if (!Number.isFinite(sharedLastNotificationFeedbackAt) || current < sharedLastNotificationFeedbackAt) {
          sharedLastNotificationFeedbackAt = undefined;
          sharedSemanticAudioAssociationOpen = false;
        } else {
          semanticCandidate = current - sharedLastNotificationFeedbackAt;
        }
      }
      const isSemanticCandidate = semanticCandidate >= 0 && semanticCandidate <= SEMANTIC_AUDIO_ASSOCIATION_WINDOW_MS;

      if (!canTrigger('sound', true, isSemanticCandidate)) return;
      const generation = supersedeAudio();

      if (isSemanticCandidate) {
        sharedSemanticAudioAssociationOpen = false;
        sharedSemanticAudioProtectedFrom = current;
        sharedSemanticAudioProtectedUntil = current + SEMANTIC_AUDIO_PROTECTION_MS;
      }

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

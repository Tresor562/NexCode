import { ActivityKind, Course, Lesson } from '../data/curriculumCore';
import { LocalState, rewardProgress } from '../lib/localState';
import { buildSkillGraph, recordSkillAttempt } from './skillGraph';
import { recommendPractice } from './practiceEngine';

export type AttemptResult = {
  state: LocalState;
  correct: boolean;
  masteryChanged: boolean;
  shouldOpenLab: boolean;
  feedback: string;
};

export type LearningCompletionReward = {
  xp: number;
  nexCoins: number;
  minutes: number;
};

const completionRewards: Readonly<Record<ActivityKind, Readonly<Omit<LearningCompletionReward, 'minutes'>>>> = {
  learn: { xp: 12, nexCoins: 2 },
  practice: { xp: 14, nexCoins: 3 },
  review: { xp: 10, nexCoins: 2 },
  lab: { xp: 25, nexCoins: 5 },
  checkpoint: { xp: 30, nexCoins: 6 },
  boss: { xp: 45, nexCoins: 9 },
  project: { xp: 40, nexCoins: 8 },
};

const MAX_EVIDENCE_CLOCK_SKEW_MS = 5 * 60 * 1000;

function normalizeSelectedIndex(lesson: Lesson, selectedIndex: number | null): number | null {
  if (!Number.isInteger(selectedIndex)) return null;
  if ((selectedIndex as number) < 0 || (selectedIndex as number) >= lesson.choices.length) return null;
  return selectedIndex;
}

function inferErrorTag(lesson: Lesson, selectedIndex: number | null) {
  const skill = lesson.skillIds?.[0] ?? lesson.id;
  if (selectedIndex === null) return `${skill}.no-answer`;
  return `${skill}.choice-${selectedIndex}`;
}

function safeLearningMinutes(durationMin: number): number {
  if (!Number.isFinite(durationMin)) return 1;
  return Math.max(1, Math.min(15, Math.round(durationMin)));
}

function safeAttemptCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10_000, Math.floor(value)));
}

function trustedCompletionTime(value: Date, systemNow = new Date()): Date {
  const safeSystemNow = systemNow instanceof Date && Number.isFinite(systemNow.getTime()) ? systemNow : new Date();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return safeSystemNow;
  const clockSkewMs = value.getTime() - safeSystemNow.getTime();
  return Math.abs(clockSkewMs) <= MAX_EVIDENCE_CLOCK_SKEW_MS ? value : safeSystemNow;
}

function validEvidenceTime(value: unknown, now: Date): number | null {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  const nowMs = now.getTime();
  if (!Number.isFinite(time) || !Number.isFinite(nowMs)) return null;
  if (time > nowMs + MAX_EVIDENCE_CLOCK_SKEW_MS) return null;
  return time;
}

function hasLatestCorrectLessonEvidence(state: LocalState, lesson: Lesson, now: Date): boolean {
  const skillIds = [...new Set((lesson.skillIds ?? []).map((skillId) => skillId.trim()).filter(Boolean))];
  if (skillIds.length === 0) return false;
  const expectedActivityKind = lesson.activityKind ?? 'learn';

  // recordSkillAttempt writes the lesson attempt into every declared skill. A
  // completion therefore requires each skill to agree that the latest evidence
  // for this lesson is correct. Looking backwards avoids trusting an older win
  // after the learner has since failed the same activity, and requiring every
  // declared skill makes partially-corrupted mastery state fail closed.
  //
  // Evidence is also bound to the current activity kind and to a plausible
  // timestamp. This matters after cloud restores or curriculum migrations: a
  // stale/forged record with the same lesson id must not unlock XP/NexCoins for
  // a different activity, and future-dated evidence must never become a durable
  // reward token simply because it sorts last in persisted mastery history.
  return skillIds.every((skillId) => {
    const evidence = state.mastery[skillId]?.evidence ?? [];
    for (let index = evidence.length - 1; index >= 0; index -= 1) {
      const attempt = evidence[index];
      if (attempt?.lessonId !== lesson.id) continue;
      if (attempt.activityKind !== expectedActivityKind) return false;
      if (validEvidenceTime(attempt.at, now) === null) return false;
      return attempt.correct === true;
    }
    return false;
  });
}

export function learningCompletionReward(lesson: Lesson): LearningCompletionReward {
  const reward = completionRewards[lesson.activityKind ?? 'learn'];
  return {
    ...reward,
    minutes: safeLearningMinutes(lesson.durationMin),
  };
}

export function rewardLearningCompletion(state: LocalState, lesson: Lesson, now = new Date()): LocalState {
  if (state.completedLessons.includes(lesson.id)) return state;
  const rewardTime = trustedCompletionTime(now);
  // Completion rewards require both a recorded attempt and the latest correct
  // evidence produced by recordLessonOutcome for every declared lesson skill.
  // A failed retry must never become rewardable because an older success still
  // exists deeper in the mastery history. The caller-provided clock is bounded
  // against the real system clock before evidence validation so either a future
  // or regressed device clock cannot legitimize misplaced mastery evidence.
  if (safeAttemptCount(state.lessonAttempts[lesson.id]) < 1) return state;
  if (!hasLatestCorrectLessonEvidence(state, lesson, rewardTime)) return state;
  const reward = learningCompletionReward(lesson);
  const rewarded = rewardProgress(state, { ...reward, now: rewardTime });
  return {
    ...rewarded,
    completedLessons: [...rewarded.completedLessons, lesson.id],
  };
}

export function recordLessonOutcome(
  state: LocalState,
  lesson: Lesson,
  correct: boolean,
  errorTag: string | undefined,
  now = new Date(),
): AttemptResult {
  const attempts = Math.min(10_000, safeAttemptCount(state.lessonAttempts[lesson.id]) + 1);
  const normalizedErrorTag = correct ? undefined : errorTag?.trim() || `${lesson.skillIds?.[0] ?? lesson.id}.incorrect`;
  // The same trusted clock boundary used for rewards must also protect mastery
  // evidence. Otherwise a device clock far in the future or past can write a
  // latest attempt that distorts review scheduling while reward progression uses
  // a different timeline. Bounding before recordSkillAttempt keeps mastery,
  // review dates, cloud sync and the eventual reward on one plausible clock.
  const attemptTime = trustedCompletionTime(now);
  const mastery = recordSkillAttempt(state.mastery, lesson, correct, attemptTime, normalizedErrorTag);
  const previousScore = (lesson.skillIds ?? []).reduce((sum, id) => sum + (state.mastery[id]?.score ?? 0), 0);
  const nextScore = (lesson.skillIds ?? []).reduce((sum, id) => sum + (mastery[id]?.score ?? 0), 0);
  const previousErrors = state.lessonErrorTags[lesson.id] ?? [];
  const lessonErrorTags = normalizedErrorTag
    ? { ...state.lessonErrorTags, [lesson.id]: [...new Set([...previousErrors, normalizedErrorTag])].slice(-6) }
    : state.lessonErrorTags;
  const shouldOpenLab = lesson.activityKind === 'lab' || attempts >= 2 || (correct && ['practice', 'review'].includes(lesson.activityKind ?? 'learn'));

  return {
    correct,
    masteryChanged: nextScore !== previousScore,
    shouldOpenLab,
    feedback: correct
      ? shouldOpenLab
        ? 'Bonne réponse. Passe maintenant dans le Lab pour transformer cette compréhension en compétence utilisable.'
        : lesson.explanation
      : `La notion n’est pas encore stable. ${lesson.explanation}`,
    state: {
      ...state,
      mastery,
      lessonAttempts: { ...state.lessonAttempts, [lesson.id]: attempts },
      lessonErrorTags,
    },
  };
}

export function recordLessonAnswer(
  state: LocalState,
  lesson: Lesson,
  selectedIndex: number | null,
  now = new Date(),
): AttemptResult {
  const answerIndex = normalizeSelectedIndex(lesson, selectedIndex);
  const correct = answerIndex !== null && answerIndex === lesson.correctIndex;
  const errorTag = correct ? undefined : inferErrorTag(lesson, answerIndex);
  return recordLessonOutcome(state, lesson, correct, errorTag, now);
}

export function completeLearningActivity(state: LocalState, lesson: Lesson, now = new Date()): LocalState {
  return rewardLearningCompletion(state, lesson, now);
}

export function adaptiveQueue(courses: Course[], state: LocalState, now = new Date(), limit = 8) {
  const graph = buildSkillGraph(courses);
  return recommendPractice(courses, graph, state.mastery, state.completedLessons, now, limit);
}

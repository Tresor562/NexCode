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

export function learningCompletionReward(lesson: Lesson): LearningCompletionReward {
  const reward = completionRewards[lesson.activityKind ?? 'learn'];
  return {
    ...reward,
    minutes: safeLearningMinutes(lesson.durationMin),
  };
}

export function rewardLearningCompletion(state: LocalState, lesson: Lesson, now = new Date()): LocalState {
  if (state.completedLessons.includes(lesson.id)) return state;
  const reward = learningCompletionReward(lesson);
  const rewarded = rewardProgress(state, { ...reward, now });
  return {
    ...rewarded,
    completedLessons: [...rewarded.completedLessons, lesson.id],
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
  const attempts = (state.lessonAttempts[lesson.id] ?? 0) + 1;
  const errorTag = correct ? undefined : inferErrorTag(lesson, answerIndex);
  const mastery = recordSkillAttempt(state.mastery, lesson, correct, now, errorTag);
  const previousScore = (lesson.skillIds ?? []).reduce((sum, id) => sum + (state.mastery[id]?.score ?? 0), 0);
  const nextScore = (lesson.skillIds ?? []).reduce((sum, id) => sum + (mastery[id]?.score ?? 0), 0);
  const previousErrors = state.lessonErrorTags[lesson.id] ?? [];
  const lessonErrorTags = {
    ...state.lessonErrorTags,
    [lesson.id]: errorTag ? [...new Set([...previousErrors, errorTag])].slice(-6) : previousErrors,
  };
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

export function completeLearningActivity(state: LocalState, lesson: Lesson, now = new Date()): LocalState {
  return rewardLearningCompletion(state, lesson, now);
}

export function adaptiveQueue(courses: Course[], state: LocalState, now = new Date(), limit = 8) {
  const graph = buildSkillGraph(courses);
  return recommendPractice(courses, graph, state.mastery, state.completedLessons, now, limit);
}

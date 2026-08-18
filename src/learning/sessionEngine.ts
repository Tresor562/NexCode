import { Course, Lesson } from '../data/curriculumCore';
import { LocalState } from '../lib/localState';
import { buildSkillGraph, recordSkillAttempt } from './skillGraph';
import { recommendPractice } from './practiceEngine';

export type AttemptResult = {
  state: LocalState;
  correct: boolean;
  masteryChanged: boolean;
  shouldOpenLab: boolean;
  feedback: string;
};

function inferErrorTag(lesson: Lesson, selectedIndex: number | null) {
  const skill = lesson.skillIds?.[0] ?? lesson.id;
  if (selectedIndex === null) return `${skill}.no-answer`;
  return `${skill}.choice-${selectedIndex}`;
}

export function recordLessonAnswer(
  state: LocalState,
  lesson: Lesson,
  selectedIndex: number | null,
  now = new Date(),
): AttemptResult {
  const correct = selectedIndex === lesson.correctIndex;
  const attempts = (state.lessonAttempts[lesson.id] ?? 0) + 1;
  const errorTag = correct ? undefined : inferErrorTag(lesson, selectedIndex);
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

export function completeLearningActivity(state: LocalState, lesson: Lesson): LocalState {
  const alreadyCompleted = state.completedLessons.includes(lesson.id);
  if (alreadyCompleted) return state;
  const xpByKind: Record<string, number> = {
    learn: 10,
    practice: 12,
    lab: 20,
    review: 14,
    checkpoint: 25,
    boss: 35,
    project: 30,
  };
  const minutes = Math.min(lesson.durationMin, 15);
  return {
    ...state,
    xp: state.xp + (xpByKind[lesson.activityKind ?? 'learn'] ?? 10),
    dailyCompleted: Math.min(state.dailyGoal, state.dailyCompleted + minutes),
    completedLessons: [...state.completedLessons, lesson.id],
  };
}

export function adaptiveQueue(courses: Course[], state: LocalState, now = new Date(), limit = 8) {
  const graph = buildSkillGraph(courses);
  return recommendPractice(courses, graph, state.mastery, state.completedLessons, now, limit);
}

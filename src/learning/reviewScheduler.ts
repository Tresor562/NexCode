import { Course, Lesson } from '../data/curriculumCore';
import { MasteryMap, SkillNode } from './skillGraph';
import { recommendPractice } from './practiceEngine';

export type ReviewWindow = 'overdue' | 'today' | 'soon' | 'later';

export type ReviewItem = {
  lesson: Lesson;
  courseId: string;
  window: ReviewWindow;
  urgency: number;
  skillIds: string[];
  reason: string;
};

function canonicalSkillIds(skillIds: string[] | undefined) {
  return [...new Set((skillIds ?? []).map((id) => id.trim()).filter(Boolean))];
}

function daysUntil(iso: string | undefined, now: Date) {
  if (!iso) return 0;
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return 0;
  return (timestamp - now.getTime()) / 86_400_000;
}

function windowFor(days: number): ReviewWindow {
  if (days < 0) return 'overdue';
  if (days <= 1) return 'today';
  if (days <= 4) return 'soon';
  return 'later';
}

function boundedUrgency(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(160, Math.round(value)));
}

export function buildReviewQueue(courses: Course[], mastery: MasteryMap, now = new Date()): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const course of courses) {
    for (const lesson of course.starterLessons) {
      const skillIds = canonicalSkillIds(lesson.skillIds);
      const states = skillIds
        .map((id) => mastery[id])
        .filter((state): state is NonNullable<typeof state> => Boolean(state));
      if (!states.length) continue;
      const nextDays = Math.min(...states.map((state) => daysUntil(state.nextReviewAt, now)));
      const weakest = Math.max(0, Math.min(100, Math.min(...states.map((state) => Number.isFinite(state.score) ? state.score : 0))));
      const recurringErrors = states.reduce((total, state) => total + new Set(state?.errorTags ?? []).size, 0);
      const window = windowFor(nextDays);
      const urgency = boundedUrgency((window === 'overdue' ? 100 : window === 'today' ? 80 : window === 'soon' ? 45 : 10) + recurringErrors * 6 + Math.max(0, 55 - weakest));
      if (window === 'later' && weakest >= 70 && recurringErrors === 0) continue;
      items.push({
        lesson,
        courseId: course.id,
        window,
        urgency,
        skillIds,
        reason: recurringErrors > 0
          ? 'Erreur récurrente : rappeler puis varier le contexte.'
          : weakest < 55
            ? 'Maîtrise fragile : récupération active avant nouvelle notion.'
            : 'Révision espacée arrivée à échéance.',
      });
    }
  }
  return items.sort((a, b) => b.urgency - a.urgency || a.lesson.id.localeCompare(b.lesson.id));
}

export function interleavedPracticeSession(
  courses: Course[],
  graph: SkillNode[],
  mastery: MasteryMap,
  completedLessonIds: string[],
  minutes: 5 | 10 | 20 | 45,
  now = new Date(),
) {
  const target = minutes <= 5 ? 2 : minutes <= 10 ? 4 : minutes <= 20 ? 7 : 12;
  const recommendations = recommendPractice(courses, graph, mastery, completedLessonIds, now, Math.max(target * 3, 12));
  const selected = [] as typeof recommendations;
  const usedCourses = new Map<string, number>();
  const usedSkills = new Map<string, number>();
  for (const item of recommendations) {
    const courseCount = usedCourses.get(item.courseId) ?? 0;
    const itemSkillIds = canonicalSkillIds(item.skillIds);
    const skillRepeat = Math.max(0, ...itemSkillIds.map((id) => usedSkills.get(id) ?? 0));
    if (courseCount >= 2 || skillRepeat >= 2) continue;
    selected.push(item);
    usedCourses.set(item.courseId, courseCount + 1);
    itemSkillIds.forEach((id) => usedSkills.set(id, (usedSkills.get(id) ?? 0) + 1));
    if (selected.length >= target) break;
  }
  for (const item of recommendations) {
    if (selected.length >= target) break;
    if (!selected.some((entry) => entry.lesson.id === item.lesson.id)) selected.push(item);
  }
  return selected;
}

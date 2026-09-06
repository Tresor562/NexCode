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

const DAY_MS = 86_400_000;
// recordSkillAttempt currently schedules at most 21 days ahead. Keep one day of
// tolerance for timezone/device-boundary effects, but fail closed if restored or
// cloud state tries to postpone a review beyond any interval NexCode can mint.
const MAX_REVIEW_HORIZON_MS = 22 * DAY_MS;

function canonicalSkillIds(skillIds: string[] | undefined) {
  return [...new Set((skillIds ?? []).map((id) => id.trim()).filter(Boolean))];
}

function canonicalErrorTags(errorTags: unknown[]) {
  return [...new Set(errorTags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().toLocaleLowerCase())
    .filter(Boolean))];
}

function validNow(now: Date): Date {
  return now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
}

function daysUntil(iso: string | undefined, now: Date) {
  if (!iso) return 0;
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return 0;
  const delay = timestamp - now.getTime();
  if (delay > MAX_REVIEW_HORIZON_MS) return 0;
  return delay / DAY_MS;
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
  const referenceNow = validNow(now);
  const items: ReviewItem[] = [];
  for (const course of courses) {
    for (const lesson of course.starterLessons) {
      const skillIds = canonicalSkillIds(lesson.skillIds);
      const states = skillIds
        .map((id) => mastery[id])
        .filter((state): state is NonNullable<typeof state> => Boolean(state));
      if (!states.length) continue;
      const nextDays = Math.min(...states.map((state) => daysUntil(state.nextReviewAt, referenceNow)));
      const weakest = Math.max(0, Math.min(100, Math.min(...states.map((state) => Number.isFinite(state.score) ? state.score : 0))));
      // One misconception can be attached to several skills touched by the same
      // lesson. Count semantic error identity across the whole lesson, not once
      // per skill, otherwise multi-skill lessons receive artificially inflated
      // urgency and can crowd genuinely overdue reviews out of a short session.
      const recurringErrors = canonicalErrorTags(states.flatMap((state) => state.errorTags ?? [])).length;
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
  const referenceNow = validNow(now);
  const target = minutes <= 5 ? 2 : minutes <= 10 ? 4 : minutes <= 20 ? 7 : 12;
  const recommendations = recommendPractice(courses, graph, mastery, completedLessonIds, referenceNow, Math.max(target * 3, 12));
  const selected = [] as typeof recommendations;
  const selectedLessonIds = new Set<string>();
  const usedCourses = new Map<string, number>();
  const usedSkills = new Map<string, number>();

  function add(item: (typeof recommendations)[number]) {
    const itemSkillIds = canonicalSkillIds(item.skillIds);
    selected.push(item);
    selectedLessonIds.add(item.lesson.id);
    usedCourses.set(item.courseId, (usedCourses.get(item.courseId) ?? 0) + 1);
    itemSkillIds.forEach((id) => usedSkills.set(id, (usedSkills.get(id) ?? 0) + 1));
  }

  for (const item of recommendations) {
    if (selectedLessonIds.has(item.lesson.id)) continue;
    const courseCount = usedCourses.get(item.courseId) ?? 0;
    const itemSkillIds = canonicalSkillIds(item.skillIds);
    const skillRepeat = Math.max(0, ...itemSkillIds.map((id) => usedSkills.get(id) ?? 0));
    if (courseCount >= 2 || skillRepeat >= 2) continue;
    add(item);
    if (selected.length >= target) break;
  }

  // If course diversity alone prevents us from filling the requested session,
  // relax only the per-course cap. Never relax the skill repetition cap: doing
  // so turns an "interleaved" session back into blocked practice of one concept.
  for (const item of recommendations) {
    if (selected.length >= target) break;
    if (selectedLessonIds.has(item.lesson.id)) continue;
    const itemSkillIds = canonicalSkillIds(item.skillIds);
    const skillRepeat = Math.max(0, ...itemSkillIds.map((id) => usedSkills.get(id) ?? 0));
    if (skillRepeat >= 2) continue;
    add(item);
  }

  return selected;
}

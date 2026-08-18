import { Course, Lesson, MasteryBand } from '../data/curriculumCore';

export type SkillNode = {
  id: string;
  title: string;
  courseId: string;
  prerequisiteIds: string[];
  lessonIds: string[];
};

export type SkillMastery = {
  skillId: string;
  score: number;
  band: MasteryBand;
  attempts: number;
  correctAttempts: number;
  lastPracticedAt?: string;
  nextReviewAt?: string;
  errorTags: string[];
};

export type MasteryMap = Record<string, SkillMastery>;

export function masteryBand(score: number): MasteryBand {
  if (score >= 85) return 'mastered';
  if (score >= 55) return 'practicing';
  if (score > 0) return 'learning';
  return 'new';
}

export function buildSkillGraph(courses: Course[]): SkillNode[] {
  const nodes = new Map<string, SkillNode>();
  for (const course of courses) {
    for (const lesson of course.starterLessons) {
      for (const skillId of lesson.skillIds ?? []) {
        const current = nodes.get(skillId);
        const prerequisiteIds = lesson.prerequisiteSkillIds ?? [];
        if (current) {
          current.lessonIds.push(lesson.id);
          current.prerequisiteIds = [...new Set([...current.prerequisiteIds, ...prerequisiteIds])];
        } else {
          nodes.set(skillId, {
            id: skillId,
            title: lesson.title,
            courseId: course.id,
            prerequisiteIds,
            lessonIds: [lesson.id],
          });
        }
      }
    }
  }
  return [...nodes.values()];
}

export function recordSkillAttempt(
  map: MasteryMap,
  lesson: Lesson,
  correct: boolean,
  now = new Date(),
  errorTag?: string,
): MasteryMap {
  const next = { ...map };
  for (const skillId of lesson.skillIds ?? []) {
    const previous = next[skillId] ?? {
      skillId,
      score: 0,
      band: 'new' as const,
      attempts: 0,
      correctAttempts: 0,
      errorTags: [],
    };
    const attempts = previous.attempts + 1;
    const correctAttempts = previous.correctAttempts + (correct ? 1 : 0);
    const quality = correct ? 1 : 0;
    const score = Math.max(0, Math.min(100, Math.round(previous.score * 0.7 + quality * 30)));
    const reviewDays = correct ? (score >= 85 ? 7 : score >= 55 ? 3 : 1) : 1;
    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + reviewDays);
    next[skillId] = {
      ...previous,
      score,
      band: masteryBand(score),
      attempts,
      correctAttempts,
      lastPracticedAt: now.toISOString(),
      nextReviewAt: nextReview.toISOString(),
      errorTags: errorTag && !correct ? [...new Set([...previous.errorTags, errorTag])] : previous.errorTags,
    };
  }
  return next;
}

export function courseMastery(course: Course, mastery: MasteryMap): number {
  if (course.skillIds.length === 0) return 0;
  const total = course.skillIds.reduce((sum, id) => sum + (mastery[id]?.score ?? 0), 0);
  return Math.round(total / course.skillIds.length);
}

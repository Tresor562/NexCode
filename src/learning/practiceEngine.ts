import { Course, Lesson } from '../data/curriculumCore';
import { MasteryMap, SkillNode } from './skillGraph';

export type PracticeReason = 'due-review' | 'weak-skill' | 'new-skill' | 'checkpoint' | 'interleaving';
export type PracticeRecommendation = {
  lesson: Lesson;
  courseId: string;
  reason: PracticeReason;
  priority: number;
  message: string;
};

function isDue(iso: string | undefined, now: Date) {
  return Boolean(iso && new Date(iso).getTime() <= now.getTime());
}

export function recommendPractice(
  courses: Course[],
  graph: SkillNode[],
  mastery: MasteryMap,
  completedLessonIds: string[],
  now = new Date(),
  limit = 6,
): PracticeRecommendation[] {
  const recommendations: PracticeRecommendation[] = [];
  const graphById = new Map(graph.map((node) => [node.id, node]));

  for (const course of courses) {
    for (const lesson of course.starterLessons) {
      const skills = lesson.skillIds ?? [];
      const completed = completedLessonIds.includes(lesson.id);
      const skillStates = skills.map((id) => mastery[id]).filter(Boolean);
      const due = skillStates.some((state) => isDue(state?.nextReviewAt, now));
      const weakest = skillStates.length
        ? Math.min(...skillStates.map((state) => state?.score ?? 0))
        : 0;
      const prereqsReady = (lesson.prerequisiteSkillIds ?? []).every(
        (id) => (mastery[id]?.score ?? 0) >= 55 || !graphById.has(id),
      );

      if (completed && due) {
        recommendations.push({
          lesson,
          courseId: course.id,
          reason: 'due-review',
          priority: 100 - weakest,
          message: 'Révision espacée : cette compétence est arrivée à échéance.',
        });
      } else if (completed && weakest < 55 && skillStates.length > 0) {
        recommendations.push({
          lesson,
          courseId: course.id,
          reason: 'weak-skill',
          priority: 85 - weakest,
          message: 'Renforcement : cette notion n’est pas encore suffisamment stable.',
        });
      } else if (!completed && prereqsReady) {
        recommendations.push({
          lesson,
          courseId: course.id,
          reason: 'new-skill',
          priority: 45,
          message: 'Nouvelle notion : tes prérequis sont suffisants pour avancer.',
        });
      }
    }
  }

  const deduped = new Map<string, PracticeRecommendation>();
  for (const item of recommendations.sort((a, b) => b.priority - a.priority)) {
    if (!deduped.has(item.lesson.id)) deduped.set(item.lesson.id, item);
  }

  // Interleave courses so a learner does not grind one concept endlessly.
  const result: PracticeRecommendation[] = [];
  const usedCourses = new Set<string>();
  for (const item of deduped.values()) {
    if (!usedCourses.has(item.courseId) || result.length >= Math.ceil(limit / 2)) {
      result.push(item);
      usedCourses.add(item.courseId);
    }
    if (result.length >= limit) break;
  }
  if (result.length < limit) {
    for (const item of deduped.values()) {
      if (!result.some((entry) => entry.lesson.id === item.lesson.id)) result.push(item);
      if (result.length >= limit) break;
    }
  }
  return result;
}

export function shouldRecommendLab(lesson: Lesson, attempts: number, correct: boolean) {
  if (lesson.labMission) return true;
  return attempts >= 2 || correct;
}

export function labPromptForLesson(lesson: Lesson) {
  if (lesson.labMission) return lesson.labMission;
  return {
    id: `${lesson.id}.lab`,
    title: `Pratique : ${lesson.title}`,
    instructions: `Réutilise la notion « ${lesson.title} » dans le Lab. Modifie l’exemple, observe le résultat puis explique ce qui change.`,
    language: 'JavaScript' as const,
    starterCode: lesson.example,
    successCriteria: ['Modifier au moins une valeur', 'Obtenir un résultat cohérent', 'Pouvoir expliquer le changement'],
  };
}

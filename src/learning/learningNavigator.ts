import { ActivityKind, Course, Lesson } from '../data/curriculumCore';
import { MasteryMap } from './skillGraph';
import { courseMasterySnapshot } from './masteryEngine';

export type LearningFilter = {
  query?: string;
  kinds?: ActivityKind[];
  difficulty?: Array<1 | 2 | 3 | 4 | 5>;
  courseIds?: string[];
  onlyIncomplete?: boolean;
  onlyDueReview?: boolean;
};

export type LearningSearchResult = {
  course: Course;
  lesson: Lesson;
  chapterId: string;
  unitId: string;
  score: number;
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function searchLearningActivities(
  courses: Course[],
  filter: LearningFilter,
  completedLessonIds: string[],
  mastery: MasteryMap,
  now = new Date(),
): LearningSearchResult[] {
  const query = normalize(filter.query?.trim() ?? '');
  const results: LearningSearchResult[] = [];
  for (const course of courses) {
    if (filter.courseIds?.length && !filter.courseIds.includes(course.id)) continue;
    for (const chapter of course.chapters) {
      for (const unit of chapter.units) {
        for (const lessonId of unit.lessonIds) {
          const lesson = course.starterLessons.find((item) => item.id === lessonId);
          if (!lesson) continue;
          if (filter.onlyIncomplete && completedLessonIds.includes(lesson.id)) continue;
          if (filter.kinds?.length && !filter.kinds.includes(lesson.activityKind ?? 'learn')) continue;
          if (filter.difficulty?.length && !filter.difficulty.includes(lesson.difficulty ?? 1)) continue;
          if (filter.onlyDueReview) {
            const due = (lesson.skillIds ?? []).some((skillId) => {
              const next = mastery[skillId]?.nextReviewAt;
              return Boolean(next && new Date(next).getTime() <= now.getTime());
            });
            if (!due) continue;
          }
          const haystack = normalize(`${course.title} ${course.language} ${chapter.title} ${unit.title} ${lesson.title} ${lesson.concept} ${(lesson.skillIds ?? []).join(' ')}`);
          if (query && !haystack.includes(query)) continue;
          const score = query
            ? (normalize(lesson.title).includes(query) ? 50 : 0)
              + (normalize(chapter.title).includes(query) ? 20 : 0)
              + (normalize(course.title).includes(query) ? 10 : 0)
            : 1;
          results.push({ course, lesson, chapterId: chapter.id, unitId: unit.id, score });
        }
      }
    }
  }
  return results.sort((a, b) => b.score - a.score || a.lesson.title.localeCompare(b.lesson.title));
}

export function courseNavigationSummary(course: Course, completedLessonIds: string[], mastery: MasteryMap) {
  const masterySnapshot = courseMasterySnapshot(course, mastery);
  const completed = course.starterLessons.filter((lesson) => completedLessonIds.includes(lesson.id)).length;
  const chapters = course.chapters.map((chapter) => {
    const chapterCompleted = chapter.lessonIds.filter((id) => completedLessonIds.includes(id)).length;
    const nextLessonId = chapter.lessonIds.find((id) => !completedLessonIds.includes(id));
    return {
      id: chapter.id,
      title: chapter.title,
      completed: chapterCompleted,
      total: chapter.lessonIds.length,
      progress: chapter.lessonIds.length ? Math.round((chapterCompleted / chapter.lessonIds.length) * 100) : 0,
      nextLessonId,
      estimatedMinutes: chapter.estimatedMinutes,
      hasLab: chapter.labLessonIds.length > 0,
      hasCheckpoint: chapter.checkpointLessonIds.length > 0,
    };
  });
  return {
    courseId: course.id,
    completed,
    total: course.starterLessons.length,
    progress: course.starterLessons.length ? Math.round((completed / course.starterLessons.length) * 100) : 0,
    mastery: masterySnapshot.score,
    dueForReview: masterySnapshot.dueForReview,
    chapters,
  };
}

export function learningEmptyState(filter: LearningFilter) {
  if (filter.onlyDueReview) return 'Aucune révision n’est due pour le moment. Continue une nouvelle activité ou pratique dans le Lab.';
  if (filter.query?.trim()) return 'Aucune activité ne correspond à cette recherche. Essaie une compétence, un langage ou un chapitre.';
  return 'Aucune activité disponible avec ces filtres. Retire un filtre pour élargir les résultats.';
}

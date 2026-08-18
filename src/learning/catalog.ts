import { Chapter, Course, Lesson } from '../data/curriculumCore';

export type CatalogFilters = {
  query?: string;
  category?: string;
  level?: string;
  downloadedCourseIds?: string[];
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function searchCourses(courses: Course[], filters: CatalogFilters) {
  const query = normalize(filters.query?.trim() ?? '');
  return courses.filter((course) => {
    if (filters.category && course.category !== filters.category) return false;
    if (filters.level && course.level !== filters.level) return false;
    if (filters.downloadedCourseIds && !filters.downloadedCourseIds.includes(course.id)) return false;
    if (!query) return true;
    const haystack = normalize([
      course.title,
      course.description,
      course.language,
      course.category,
      ...course.chapters.map((chapter) => chapter.title),
    ].join(' '));
    return haystack.includes(query);
  });
}

export function chapterProgress(chapter: Chapter, completedLessonIds: string[]) {
  if (chapter.lessonIds.length === 0) return 0;
  const completed = chapter.lessonIds.filter((id) => completedLessonIds.includes(id)).length;
  return Math.round((completed / chapter.lessonIds.length) * 100);
}

export function nextLessonInCourse(course: Course, completedLessonIds: string[]): Lesson | undefined {
  return course.starterLessons.find((lesson) => !completedLessonIds.includes(lesson.id));
}

export function nextChapter(course: Course, completedLessonIds: string[]): Chapter | undefined {
  return course.chapters.find((chapter) => chapterProgress(chapter, completedLessonIds) < 100);
}

export function offlineChapterSizeMb(course: Course, chapter: Chapter) {
  if (course.lessons === 0) return 0;
  return Math.max(1, Math.round(course.offlineSizeMb * (chapter.lessonIds.length / course.lessons)));
}

export function curriculumMetrics(courses: Course[]) {
  const lessons = courses.reduce((sum, course) => sum + course.lessons, 0);
  const chapters = courses.reduce((sum, course) => sum + course.chapters.length, 0);
  const units = courses.reduce(
    (sum, course) => sum + course.chapters.reduce((chapterSum, chapter) => chapterSum + chapter.units.length, 0),
    0,
  );
  const skills = new Set(courses.flatMap((course) => course.skillIds)).size;
  return { courses: courses.length, chapters, units, lessons, skills };
}

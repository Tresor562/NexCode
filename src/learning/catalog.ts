import { Chapter, Course, CourseStage, Lesson, LearningUnit } from '../data/curriculumCore';

export type CatalogFilters = {
  query?: string;
  category?: string;
  level?: string;
  downloadedCourseIds?: string[];
};

export type ActivitySearchResult = {
  course: Course;
  chapter: Chapter;
  unit: LearningUnit;
  lesson: Lesson;
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function searchCourses(courses: Course[], filters: CatalogFilters) {
  const query = normalize(filters.query?.trim() ?? '');
  return courses.filter((course) => {
    if (filters.category && course.category !== filters.category) return false;
    if (filters.level && course.level !== filters.level) return false;
    if (filters.downloadedCourseIds && !filters.downloadedCourseIds.includes(course.id)) return false;
    if (!query) return true;
    const haystack = normalize([
      course.title, course.description, course.language, course.category,
      ...course.chapters.map((chapter) => chapter.title),
      ...course.starterLessons.flatMap((lesson) => [lesson.title, lesson.concept]),
    ].join(' '));
    return haystack.includes(query);
  });
}

export function searchActivities(courses: Course[], query: string, limit = 30): ActivitySearchResult[] {
  const needle = normalize(query.trim());
  if (!needle) return [];
  const results: ActivitySearchResult[] = [];
  for (const course of courses) {
    const lessonById = new Map(course.starterLessons.map((lesson) => [lesson.id, lesson]));
    for (const chapter of course.chapters) {
      for (const unit of chapter.units) {
        for (const lessonId of unit.lessonIds) {
          const lesson = lessonById.get(lessonId);
          if (!lesson) continue;
          const haystack = normalize(`${course.title} ${chapter.title} ${unit.title} ${lesson.title} ${lesson.concept}`);
          if (haystack.includes(needle)) results.push({ course, chapter, unit, lesson });
          if (results.length >= limit) return results;
        }
      }
    }
  }
  return results;
}

export function chapterProgress(chapter: Chapter, completedLessonIds: string[]) {
  if (chapter.lessonIds.length === 0) return 0;
  const completed = chapter.lessonIds.filter((id) => completedLessonIds.includes(id)).length;
  return Math.round((completed / chapter.lessonIds.length) * 100);
}

export function unitProgress(unit: LearningUnit, completedLessonIds: string[]) {
  if (unit.lessonIds.length === 0) return 0;
  const completed = unit.lessonIds.filter((id) => completedLessonIds.includes(id)).length;
  return Math.round((completed / unit.lessonIds.length) * 100);
}

export function stageProgress(course: Course, stage: CourseStage, completedLessonIds: string[]) {
  const chapters = course.chapters.filter((chapter) => stage.chapterIds.includes(chapter.id));
  const lessonIds = chapters.flatMap((chapter) => chapter.lessonIds);
  if (lessonIds.length === 0) return 0;
  const completed = lessonIds.filter((id) => completedLessonIds.includes(id)).length;
  return Math.round((completed / lessonIds.length) * 100);
}

export function nextLessonInCourse(course: Course, completedLessonIds: string[]): Lesson | undefined {
  return course.starterLessons.find((lesson) => !completedLessonIds.includes(lesson.id));
}

export function nextChapter(course: Course, completedLessonIds: string[]): Chapter | undefined {
  return course.chapters.find((chapter) => chapterProgress(chapter, completedLessonIds) < 100);
}

export function nextUnit(course: Course, completedLessonIds: string[]): LearningUnit | undefined {
  for (const chapter of course.chapters) {
    const unit = chapter.units.find((item) => unitProgress(item, completedLessonIds) < 100);
    if (unit) return unit;
  }
  return undefined;
}

export function offlineChapterSizeMb(course: Course, chapter: Chapter) {
  if (course.lessons === 0) return 0;
  return Math.max(1, Math.round(course.offlineSizeMb * (chapter.lessonIds.length / course.lessons)));
}

export function offlineStageSizeMb(course: Course, stage: CourseStage) {
  return course.chapters
    .filter((chapter) => stage.chapterIds.includes(chapter.id))
    .reduce((sum, chapter) => sum + offlineChapterSizeMb(course, chapter), 0);
}

export function curriculumMetrics(courses: Course[]) {
  const lessons = courses.reduce((sum, course) => sum + course.lessons, 0);
  const chapters = courses.reduce((sum, course) => sum + course.chapters.length, 0);
  const units = courses.reduce((sum, course) => sum + course.chapters.reduce((chapterSum, chapter) => chapterSum + chapter.units.length, 0), 0);
  const stages = courses.reduce((sum, course) => sum + course.stages.length, 0);
  const skills = new Set(courses.flatMap((course) => course.skillIds)).size;
  const labs = courses.reduce((sum, course) => sum + course.starterLessons.filter((lesson) => lesson.activityKind === 'lab').length, 0);
  const checkpoints = courses.reduce(
    (sum, course) => sum + course.starterLessons.filter((lesson) => ['checkpoint', 'boss'].includes(lesson.activityKind ?? '')).length,
    0,
  );
  return { courses: courses.length, stages, chapters, units, lessons, skills, labs, checkpoints };
}

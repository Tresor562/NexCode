import { Course, CourseStage, Chapter, LearningUnit, Lesson } from '../data/curriculumCore';

export type CurriculumActivityRef = {
  courseId: string;
  stageId: string;
  chapterId: string;
  unitId: string;
  lesson: Lesson;
};

export type CurriculumRegistry = {
  coursesById: Map<string, Course>;
  stagesById: Map<string, CourseStage & { courseId: string }>;
  chaptersById: Map<string, Chapter & { courseId: string; stageId: string }>;
  unitsById: Map<string, LearningUnit & { courseId: string; stageId: string; chapterId: string }>;
  activitiesById: Map<string, CurriculumActivityRef>;
};

export type CurriculumIssue = {
  code:
    | 'duplicate-course'
    | 'duplicate-stage'
    | 'duplicate-chapter'
    | 'duplicate-unit'
    | 'duplicate-activity'
    | 'missing-stage-chapter'
    | 'missing-chapter-activity'
    | 'missing-unit-activity'
    | 'activity-outside-unit'
    | 'empty-stage'
    | 'empty-chapter'
    | 'empty-unit';
  id: string;
  message: string;
};

export function buildCurriculumRegistry(courses: Course[]): CurriculumRegistry {
  const registry: CurriculumRegistry = {
    coursesById: new Map(),
    stagesById: new Map(),
    chaptersById: new Map(),
    unitsById: new Map(),
    activitiesById: new Map(),
  };

  for (const course of courses) {
    registry.coursesById.set(course.id, course);
    const lessonById = new Map(course.starterLessons.map((lesson) => [lesson.id, lesson]));
    const chapterById = new Map(course.chapters.map((chapter) => [chapter.id, chapter]));

    for (const stage of course.stages) {
      registry.stagesById.set(stage.id, { ...stage, courseId: course.id });
      for (const chapterId of stage.chapterIds) {
        const chapter = chapterById.get(chapterId);
        if (!chapter) continue;
        registry.chaptersById.set(chapter.id, { ...chapter, courseId: course.id, stageId: stage.id });
        for (const unit of chapter.units) {
          registry.unitsById.set(unit.id, {
            ...unit,
            courseId: course.id,
            stageId: stage.id,
            chapterId: chapter.id,
          });
          for (const lessonId of unit.lessonIds) {
            const lesson = lessonById.get(lessonId);
            if (!lesson) continue;
            registry.activitiesById.set(lesson.id, {
              courseId: course.id,
              stageId: stage.id,
              chapterId: chapter.id,
              unitId: unit.id,
              lesson,
            });
          }
        }
      }
    }
  }

  return registry;
}

export function auditCurriculumHierarchy(courses: Course[]): CurriculumIssue[] {
  const issues: CurriculumIssue[] = [];
  const seenCourses = new Set<string>();
  const seenStages = new Set<string>();
  const seenChapters = new Set<string>();
  const seenUnits = new Set<string>();
  const seenActivities = new Set<string>();

  for (const course of courses) {
    if (seenCourses.has(course.id)) {
      issues.push({ code: 'duplicate-course', id: course.id, message: `Course id duplicated: ${course.id}` });
    }
    seenCourses.add(course.id);

    const lessons = new Map(course.starterLessons.map((lesson) => [lesson.id, lesson]));
    const chapterIds = new Set(course.chapters.map((chapter) => chapter.id));
    const coveredActivities = new Set<string>();

    for (const lesson of course.starterLessons) {
      if (seenActivities.has(lesson.id)) {
        issues.push({ code: 'duplicate-activity', id: lesson.id, message: `Activity id duplicated: ${lesson.id}` });
      }
      seenActivities.add(lesson.id);
    }

    for (const stage of course.stages) {
      if (seenStages.has(stage.id)) issues.push({ code: 'duplicate-stage', id: stage.id, message: `Stage id duplicated: ${stage.id}` });
      seenStages.add(stage.id);
      if (stage.chapterIds.length === 0) issues.push({ code: 'empty-stage', id: stage.id, message: `Stage has no chapters: ${stage.id}` });
      for (const chapterId of stage.chapterIds) {
        if (!chapterIds.has(chapterId)) {
          issues.push({ code: 'missing-stage-chapter', id: chapterId, message: `Stage ${stage.id} references missing chapter ${chapterId}` });
        }
      }
    }

    for (const chapter of course.chapters) {
      if (seenChapters.has(chapter.id)) issues.push({ code: 'duplicate-chapter', id: chapter.id, message: `Chapter id duplicated: ${chapter.id}` });
      seenChapters.add(chapter.id);
      if (chapter.lessonIds.length === 0) issues.push({ code: 'empty-chapter', id: chapter.id, message: `Chapter has no activities: ${chapter.id}` });
      for (const lessonId of chapter.lessonIds) {
        if (!lessons.has(lessonId)) {
          issues.push({ code: 'missing-chapter-activity', id: lessonId, message: `Chapter ${chapter.id} references missing activity ${lessonId}` });
        }
      }
      for (const unit of chapter.units) {
        if (seenUnits.has(unit.id)) issues.push({ code: 'duplicate-unit', id: unit.id, message: `Unit id duplicated: ${unit.id}` });
        seenUnits.add(unit.id);
        if (unit.lessonIds.length === 0) issues.push({ code: 'empty-unit', id: unit.id, message: `Unit has no activities: ${unit.id}` });
        for (const lessonId of unit.lessonIds) {
          coveredActivities.add(lessonId);
          if (!lessons.has(lessonId)) {
            issues.push({ code: 'missing-unit-activity', id: lessonId, message: `Unit ${unit.id} references missing activity ${lessonId}` });
          }
        }
      }
    }

    for (const lesson of course.starterLessons) {
      if (!coveredActivities.has(lesson.id)) {
        issues.push({ code: 'activity-outside-unit', id: lesson.id, message: `Activity ${lesson.id} is not assigned to a unit` });
      }
    }
  }

  return issues;
}

export function activitiesForChapter(registry: CurriculumRegistry, chapterId: string): CurriculumActivityRef[] {
  return [...registry.activitiesById.values()].filter((activity) => activity.chapterId === chapterId);
}

export function activitiesForStage(registry: CurriculumRegistry, stageId: string): CurriculumActivityRef[] {
  return [...registry.activitiesById.values()].filter((activity) => activity.stageId === stageId);
}

export function nextActivityInCourse(registry: CurriculumRegistry, courseId: string, completedIds: string[]): CurriculumActivityRef | undefined {
  const course = registry.coursesById.get(courseId);
  if (!course) return undefined;
  for (const stage of course.stages.sort((a, b) => a.order - b.order)) {
    for (const chapterId of stage.chapterIds) {
      const chapter = registry.chaptersById.get(chapterId);
      if (!chapter) continue;
      for (const unit of chapter.units) {
        for (const lessonId of unit.lessonIds) {
          if (!completedIds.includes(lessonId)) return registry.activitiesById.get(lessonId);
        }
      }
    }
  }
  return undefined;
}

import { ActivityKind, Chapter, Course, CourseStage, LearningUnit, Lesson } from '../data/curriculumCore';

export type CurriculumActivityRef = {
  courseId: string;
  stageId: string;
  chapterId: string;
  unitId: string;
  lessonId: string;
  kind: ActivityKind;
  order: number;
};

export type CurriculumUnitNode = LearningUnit & {
  activities: CurriculumActivityRef[];
};

export type CurriculumChapterNode = Omit<Chapter, 'units'> & {
  order: number;
  units: CurriculumUnitNode[];
};

export type CurriculumStageNode = CourseStage & {
  chapters: CurriculumChapterNode[];
};

export type CurriculumTree = {
  courseId: string;
  version: number;
  stages: CurriculumStageNode[];
  activityCount: number;
};

function lessonMap(course: Course) {
  return new Map(course.starterLessons.map((lesson) => [lesson.id, lesson]));
}

export function buildCurriculumTree(course: Course): CurriculumTree {
  const byLesson = lessonMap(course);
  let order = 0;
  const stages: CurriculumStageNode[] = course.stages.map((stage) => {
    const chapters: CurriculumChapterNode[] = stage.chapterIds
      .map((id) => course.chapters.find((chapter) => chapter.id === id))
      .filter((chapter): chapter is Chapter => Boolean(chapter))
      .map((chapter, chapterIndex) => ({
        ...chapter,
        order: chapterIndex + 1,
        units: chapter.units.map((unit): CurriculumUnitNode => ({
          ...unit,
          activities: unit.lessonIds
            .map((lessonId) => byLesson.get(lessonId))
            .filter((lesson): lesson is Lesson => Boolean(lesson))
            .map((lesson) => ({
              courseId: course.id,
              stageId: stage.id,
              chapterId: chapter.id,
              unitId: unit.id,
              lessonId: lesson.id,
              kind: lesson.activityKind ?? 'learn',
              order: ++order,
            })),
        })),
      }));
    return { ...stage, chapters };
  });
  return { courseId: course.id, version: course.curriculumVersion, stages, activityCount: order };
}

export function curriculumActivityPath(course: Course, lessonId: string) {
  const tree = buildCurriculumTree(course);
  for (const stage of tree.stages) {
    for (const chapter of stage.chapters) {
      for (const unit of chapter.units) {
        const activity = unit.activities.find((item) => item.lessonId === lessonId);
        if (activity) return { stage, chapter, unit, activity };
      }
    }
  }
  return undefined;
}

export function nextCurriculumActivity(course: Course, lessonId: string) {
  const tree = buildCurriculumTree(course);
  const activities = tree.stages.flatMap((stage) =>
    stage.chapters.flatMap((chapter) => chapter.units.flatMap((unit) => unit.activities)),
  );
  const index = activities.findIndex((item) => item.lessonId === lessonId);
  return index >= 0 ? activities[index + 1] : undefined;
}

export function curriculumStructureIssues(course: Course): string[] {
  const issues: string[] = [];
  const knownLessonIds = new Set<string>();
  const knownChapterIds = new Set<string>();
  const knownUnitIds = new Set<string>();
  const stagedChapterIds = new Set<string>();
  const lessonLocations = new Map<string, string[]>();

  for (const lesson of course.starterLessons) {
    if (knownLessonIds.has(lesson.id)) issues.push(`${lesson.id}: identifiant d’activité dupliqué`);
    knownLessonIds.add(lesson.id);
  }

  for (const chapter of course.chapters) {
    if (knownChapterIds.has(chapter.id)) issues.push(`${chapter.id}: identifiant de chapitre dupliqué`);
    knownChapterIds.add(chapter.id);
  }

  for (const stage of course.stages) {
    if (stage.chapterIds.length === 0) issues.push(`${stage.id}: stage vide`);
    const chapterIdsInStage = new Set<string>();
    for (const chapterId of stage.chapterIds) {
      if (chapterIdsInStage.has(chapterId)) issues.push(`${stage.id}: chapitre ${chapterId} répété dans le stage`);
      chapterIdsInStage.add(chapterId);
      if (stagedChapterIds.has(chapterId)) issues.push(`${chapterId}: chapitre présent dans plusieurs stages`);
      stagedChapterIds.add(chapterId);
      if (!knownChapterIds.has(chapterId)) issues.push(`${chapterId}: chapitre introuvable`);
    }
  }

  for (const chapter of course.chapters) {
    if (!stagedChapterIds.has(chapter.id)) issues.push(`${chapter.id}: chapitre orphelin hors stages`);
    if (chapter.units.length === 0) issues.push(`${chapter.id}: aucune unité`);

    for (const unit of chapter.units) {
      if (knownUnitIds.has(unit.id)) issues.push(`${unit.id}: identifiant d’unité dupliqué`);
      knownUnitIds.add(unit.id);
      if (unit.lessonIds.length === 0) issues.push(`${unit.id}: aucune activité`);

      const lessonIdsInUnit = new Set<string>();
      for (const lessonId of unit.lessonIds) {
        if (lessonIdsInUnit.has(lessonId)) issues.push(`${unit.id}: activité ${lessonId} répétée dans l’unité`);
        lessonIdsInUnit.add(lessonId);

        const location = `${chapter.id}/${unit.id}`;
        lessonLocations.set(lessonId, [...(lessonLocations.get(lessonId) ?? []), location]);
        if (!knownLessonIds.has(lessonId)) issues.push(`${lessonId}: activité introuvable référencée par ${location}`);
      }
    }
  }

  for (const lesson of course.starterLessons) {
    const locations = lessonLocations.get(lesson.id) ?? [];
    if (locations.length === 0) {
      issues.push(`${lesson.id}: activité orpheline hors unités`);
      continue;
    }
    const uniqueLocations = [...new Set(locations)];
    if (uniqueLocations.length > 1) {
      issues.push(`${lesson.id}: activité présente dans plusieurs unités (${uniqueLocations.join(', ')})`);
    }
  }

  return issues;
}
